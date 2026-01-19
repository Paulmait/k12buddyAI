/**
 * Spaced Repetition System (SRS)
 * Implements SM-2 algorithm for optimal learning retention
 */

import { supabase } from './supabase';

// ============ Types ============

export interface ReviewCard {
  id: string;
  studentId: string;
  subject: string;
  topic: string;
  question: string;
  answer: string;
  easeFactor: number; // 1.3 - 2.5
  interval: number; // days
  repetitions: number;
  nextReviewDate: string;
  lastReviewDate: string | null;
  createdAt: string;
}

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;
// 0 - Complete blackout
// 1 - Incorrect; remembered upon seeing answer
// 2 - Incorrect; answer seemed easy to recall
// 3 - Correct with serious difficulty
// 4 - Correct after hesitation
// 5 - Perfect response

export interface ReviewResult {
  card: ReviewCard;
  quality: ReviewQuality;
  responseTimeMs: number;
  reviewedAt: string;
}

export interface DueCards {
  overdue: ReviewCard[];
  dueToday: ReviewCard[];
  upcoming: ReviewCard[];
  newCards: ReviewCard[];
}

export interface StudyStats {
  totalCards: number;
  masteredCards: number; // interval > 21 days
  learningCards: number; // interval < 21 days
  cardsReviewedToday: number;
  streakDays: number;
  averageEaseFactor: number;
}

// ============ SM-2 Algorithm ============

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const NEW_CARD_INTERVALS = [1, 6]; // days for first two reviews

/**
 * Calculate the next review parameters using SM-2 algorithm
 */
export function calculateNextReview(
  card: ReviewCard,
  quality: ReviewQuality
): Partial<ReviewCard> {
  let { easeFactor, interval, repetitions } = card;

  // Quality < 3 means incorrect - reset
  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    // Correct response
    if (repetitions === 0) {
      interval = NEW_CARD_INTERVALS[0];
    } else if (repetitions === 1) {
      interval = NEW_CARD_INTERVALS[1];
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor);

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewDate: nextReviewDate.toISOString().split('T')[0],
    lastReviewDate: new Date().toISOString(),
  };
}

/**
 * Map response quality to user-friendly options
 */
export function getQualityOptions(): { quality: ReviewQuality; label: string; description: string }[] {
  return [
    { quality: 0, label: 'Forgot', description: "I didn't remember at all" },
    { quality: 1, label: 'Hard', description: 'Wrong, but remembered after seeing answer' },
    { quality: 2, label: 'Difficult', description: 'Wrong, but it was on the tip of my tongue' },
    { quality: 3, label: 'Okay', description: 'Correct, but it was hard' },
    { quality: 4, label: 'Good', description: 'Correct after thinking' },
    { quality: 5, label: 'Easy', description: 'Correct immediately' },
  ];
}

// ============ Card Management ============

/**
 * Create a new review card
 */
export async function createCard(
  studentId: string,
  subject: string,
  topic: string,
  question: string,
  answer: string
): Promise<ReviewCard | null> {
  try {
    const card: Partial<ReviewCard> = {
      studentId,
      subject,
      topic,
      question,
      answer,
      easeFactor: DEFAULT_EASE_FACTOR,
      interval: 0,
      repetitions: 0,
      nextReviewDate: new Date().toISOString().split('T')[0], // Today
      lastReviewDate: null,
    };

    const { data, error } = await supabase
      .from('review_cards')
      .insert({
        student_id: card.studentId,
        subject: card.subject,
        topic: card.topic,
        question: card.question,
        answer: card.answer,
        ease_factor: card.easeFactor,
        interval_days: card.interval,
        repetitions: card.repetitions,
        next_review_date: card.nextReviewDate,
        last_review_date: card.lastReviewDate,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating card:', error);
      return null;
    }

    return mapDbCardToCard(data);
  } catch (error) {
    console.error('Error in createCard:', error);
    return null;
  }
}

/**
 * Review a card and update its parameters
 */
export async function reviewCard(
  cardId: string,
  quality: ReviewQuality,
  responseTimeMs: number
): Promise<ReviewCard | null> {
  try {
    // Get current card
    const { data: currentCard, error: fetchError } = await supabase
      .from('review_cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (fetchError || !currentCard) {
      console.error('Error fetching card:', fetchError);
      return null;
    }

    const card = mapDbCardToCard(currentCard);
    const updates = calculateNextReview(card, quality);

    // Update the card
    const { data, error } = await supabase
      .from('review_cards')
      .update({
        ease_factor: updates.easeFactor,
        interval_days: updates.interval,
        repetitions: updates.repetitions,
        next_review_date: updates.nextReviewDate,
        last_review_date: updates.lastReviewDate,
      })
      .eq('id', cardId)
      .select()
      .single();

    if (error) {
      console.error('Error updating card:', error);
      return null;
    }

    // Record the review in history
    await supabase
      .from('review_history')
      .insert({
        card_id: cardId,
        student_id: card.studentId,
        quality,
        response_time_ms: responseTimeMs,
        ease_factor_after: updates.easeFactor,
        interval_after: updates.interval,
      });

    return mapDbCardToCard(data);
  } catch (error) {
    console.error('Error in reviewCard:', error);
    return null;
  }
}

/**
 * Get cards due for review
 */
export async function getDueCards(
  studentId: string,
  subject?: string,
  limit: number = 20
): Promise<DueCards> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let query = supabase
      .from('review_cards')
      .select('*')
      .eq('student_id', studentId);

    if (subject) {
      query = query.eq('subject', subject);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.error('Error fetching due cards:', error);
      return { overdue: [], dueToday: [], upcoming: [], newCards: [] };
    }

    const cards = data.map(mapDbCardToCard);

    const overdue: ReviewCard[] = [];
    const dueToday: ReviewCard[] = [];
    const upcoming: ReviewCard[] = [];
    const newCards: ReviewCard[] = [];

    for (const card of cards) {
      if (card.repetitions === 0) {
        newCards.push(card);
      } else if (card.nextReviewDate < today) {
        overdue.push(card);
      } else if (card.nextReviewDate === today) {
        dueToday.push(card);
      } else if (card.nextReviewDate === tomorrow) {
        upcoming.push(card);
      }
    }

    // Sort by priority (overdue first, then by ease factor)
    overdue.sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
    dueToday.sort((a, b) => a.easeFactor - b.easeFactor);

    return {
      overdue: overdue.slice(0, limit),
      dueToday: dueToday.slice(0, limit - overdue.length),
      upcoming: upcoming.slice(0, 5),
      newCards: newCards.slice(0, limit),
    };
  } catch (error) {
    console.error('Error in getDueCards:', error);
    return { overdue: [], dueToday: [], upcoming: [], newCards: [] };
  }
}

/**
 * Get study statistics
 */
export async function getStudyStats(studentId: string): Promise<StudyStats> {
  try {
    const { data: cards } = await supabase
      .from('review_cards')
      .select('ease_factor, interval_days, last_review_date')
      .eq('student_id', studentId);

    const today = new Date().toISOString().split('T')[0];

    const { count: reviewedToday } = await supabase
      .from('review_history')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('created_at', today);

    if (!cards) {
      return {
        totalCards: 0,
        masteredCards: 0,
        learningCards: 0,
        cardsReviewedToday: 0,
        streakDays: 0,
        averageEaseFactor: DEFAULT_EASE_FACTOR,
      };
    }

    const masteredCards = cards.filter(c => c.interval_days >= 21).length;
    const totalEaseFactor = cards.reduce((sum, c) => sum + c.ease_factor, 0);

    return {
      totalCards: cards.length,
      masteredCards,
      learningCards: cards.length - masteredCards,
      cardsReviewedToday: reviewedToday || 0,
      streakDays: 0, // Would need to calculate from review history
      averageEaseFactor: cards.length > 0 ? totalEaseFactor / cards.length : DEFAULT_EASE_FACTOR,
    };
  } catch (error) {
    console.error('Error getting study stats:', error);
    return {
      totalCards: 0,
      masteredCards: 0,
      learningCards: 0,
      cardsReviewedToday: 0,
      streakDays: 0,
      averageEaseFactor: DEFAULT_EASE_FACTOR,
    };
  }
}

/**
 * Auto-generate cards from chat interactions
 */
export async function generateCardsFromChat(
  studentId: string,
  subject: string,
  topic: string,
  questionAnswer: { question: string; answer: string }
): Promise<ReviewCard | null> {
  // Check if similar card already exists
  const { data: existing } = await supabase
    .from('review_cards')
    .select('id')
    .eq('student_id', studentId)
    .eq('subject', subject)
    .ilike('question', `%${questionAnswer.question.substring(0, 50)}%`)
    .limit(1);

  if (existing && existing.length > 0) {
    return null; // Card already exists
  }

  return createCard(
    studentId,
    subject,
    topic,
    questionAnswer.question,
    questionAnswer.answer
  );
}

// ============ Helpers ============

function mapDbCardToCard(dbCard: Record<string, unknown>): ReviewCard {
  return {
    id: dbCard.id as string,
    studentId: dbCard.student_id as string,
    subject: dbCard.subject as string,
    topic: dbCard.topic as string,
    question: dbCard.question as string,
    answer: dbCard.answer as string,
    easeFactor: dbCard.ease_factor as number,
    interval: dbCard.interval_days as number,
    repetitions: dbCard.repetitions as number,
    nextReviewDate: dbCard.next_review_date as string,
    lastReviewDate: dbCard.last_review_date as string | null,
    createdAt: dbCard.created_at as string,
  };
}

export default {
  calculateNextReview,
  getQualityOptions,
  createCard,
  reviewCard,
  getDueCards,
  getStudyStats,
  generateCardsFromChat,
};
