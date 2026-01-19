/**
 * Spaced Repetition Edge Function
 * Handles review cards and SM-2 algorithm
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SM-2 Algorithm Constants
const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const NEW_CARD_INTERVALS = [1, 6]; // days for first two reviews

type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

interface ReviewCard {
  id: string;
  student_id: string;
  subject: string;
  topic: string;
  question: string;
  answer: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
  last_review_date: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'cards':
        return await handleCards(req, supabaseClient, user.id);
      case 'review':
        return await handleReview(req, supabaseClient, user.id);
      case 'due':
        return await handleDueCards(req, supabaseClient, user.id);
      case 'stats':
        return await handleStats(req, supabaseClient, user.id);
      case 'generate':
        return await handleGenerateCards(req, supabaseClient, user.id);
      default:
        return new Response(
          JSON.stringify({ error: 'Not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Spaced repetition error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Create a new review card
async function handleCards(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  if (req.method === 'POST') {
    const body = await req.json();
    const { subject, topic, question, answer } = body;

    if (!subject || !topic || !question || !answer) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('review_cards')
      .insert({
        student_id: userId,
        subject,
        topic,
        question,
        answer,
        ease_factor: DEFAULT_EASE_FACTOR,
        interval_days: 0,
        repetitions: 0,
        next_review_date: today,
      })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to create card' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ card: data }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const subject = url.searchParams.get('subject');

    let query = supabase
      .from('review_cards')
      .select('*')
      .eq('student_id', userId)
      .order('next_review_date', { ascending: true });

    if (subject) {
      query = query.eq('subject', subject);
    }

    const { data, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch cards' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ cards: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Review a card with SM-2 algorithm
async function handleReview(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { cardId, quality, responseTimeMs } = await req.json();

  if (!cardId || quality === undefined || quality < 0 || quality > 5) {
    return new Response(
      JSON.stringify({ error: 'Invalid review data' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get current card
  const { data: card, error: fetchError } = await supabase
    .from('review_cards')
    .select('*')
    .eq('id', cardId)
    .eq('student_id', userId)
    .single();

  if (fetchError || !card) {
    return new Response(
      JSON.stringify({ error: 'Card not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Calculate SM-2 updates
  const updates = calculateSM2(card, quality as ReviewQuality);

  // Update the card
  const { data: updatedCard, error: updateError } = await supabase
    .from('review_cards')
    .update({
      ease_factor: updates.easeFactor,
      interval_days: updates.interval,
      repetitions: updates.repetitions,
      next_review_date: updates.nextReviewDate,
      last_review_date: new Date().toISOString(),
    })
    .eq('id', cardId)
    .select()
    .single();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Failed to update card' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Record review in history
  await supabase.from('review_history').insert({
    card_id: cardId,
    student_id: userId,
    quality,
    response_time_ms: responseTimeMs || 0,
    ease_factor_after: updates.easeFactor,
    interval_after: updates.interval,
  });

  // Award XP for reviewing
  const xpAmount = quality >= 3 ? 5 : 2;
  await supabase.rpc('award_xp', {
    p_student_id: userId,
    p_amount: xpAmount,
    p_source: 'review_card',
    p_description: `Reviewed ${card.subject} card`,
  });

  return new Response(
    JSON.stringify({
      card: updatedCard,
      xpAwarded: xpAmount,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get cards due for review
async function handleDueCards(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(req.url);
  const subject = url.searchParams.get('subject');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  let query = supabase
    .from('review_cards')
    .select('*')
    .eq('student_id', userId);

  if (subject) {
    query = query.eq('subject', subject);
  }

  const { data: cards, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch cards' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const categorized = {
    overdue: [] as ReviewCard[],
    dueToday: [] as ReviewCard[],
    upcoming: [] as ReviewCard[],
    newCards: [] as ReviewCard[],
  };

  for (const card of cards || []) {
    if (card.repetitions === 0) {
      categorized.newCards.push(card);
    } else if (card.next_review_date < today) {
      categorized.overdue.push(card);
    } else if (card.next_review_date === today) {
      categorized.dueToday.push(card);
    } else if (card.next_review_date === tomorrow) {
      categorized.upcoming.push(card);
    }
  }

  // Sort overdue by date (oldest first)
  categorized.overdue.sort((a, b) =>
    a.next_review_date.localeCompare(b.next_review_date)
  );

  // Sort due today by ease factor (hardest first)
  categorized.dueToday.sort((a, b) => a.ease_factor - b.ease_factor);

  return new Response(
    JSON.stringify({
      overdue: categorized.overdue.slice(0, limit),
      dueToday: categorized.dueToday.slice(0, limit),
      upcoming: categorized.upcoming.slice(0, 5),
      newCards: categorized.newCards.slice(0, limit),
      totalDue: categorized.overdue.length + categorized.dueToday.length,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get study statistics
async function handleStats(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const today = new Date().toISOString().split('T')[0];

  // Get all cards
  const { data: cards } = await supabase
    .from('review_cards')
    .select('ease_factor, interval_days')
    .eq('student_id', userId);

  // Get today's reviews
  const { count: reviewedToday } = await supabase
    .from('review_history')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', userId)
    .gte('created_at', `${today}T00:00:00`);

  const totalCards = cards?.length || 0;
  const masteredCards = cards?.filter(c => c.interval_days >= 21).length || 0;
  const avgEaseFactor = totalCards > 0
    ? cards!.reduce((sum, c) => sum + c.ease_factor, 0) / totalCards
    : DEFAULT_EASE_FACTOR;

  return new Response(
    JSON.stringify({
      totalCards,
      masteredCards,
      learningCards: totalCards - masteredCards,
      cardsReviewedToday: reviewedToday || 0,
      averageEaseFactor: Math.round(avgEaseFactor * 100) / 100,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Auto-generate cards from chat interactions
async function handleGenerateCards(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { subject, topic, questions } = await req.json();

  if (!subject || !topic || !questions || !Array.isArray(questions)) {
    return new Response(
      JSON.stringify({ error: 'Invalid input' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const createdCards = [];

  for (const qa of questions) {
    if (!qa.question || !qa.answer) continue;

    // Check for duplicates
    const { data: existing } = await supabase
      .from('review_cards')
      .select('id')
      .eq('student_id', userId)
      .eq('subject', subject)
      .ilike('question', `%${qa.question.substring(0, 50)}%`)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { data: card, error } = await supabase
      .from('review_cards')
      .insert({
        student_id: userId,
        subject,
        topic,
        question: qa.question,
        answer: qa.answer,
        ease_factor: DEFAULT_EASE_FACTOR,
        interval_days: 0,
        repetitions: 0,
        next_review_date: today,
      })
      .select()
      .single();

    if (!error && card) {
      createdCards.push(card);
    }
  }

  return new Response(
    JSON.stringify({
      created: createdCards.length,
      cards: createdCards,
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// SM-2 Algorithm Implementation
function calculateSM2(
  card: ReviewCard,
  quality: ReviewQuality
): {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
} {
  let { ease_factor: easeFactor, interval_days: interval, repetitions } = card;

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
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval,
    repetitions,
    nextReviewDate: nextDate.toISOString().split('T')[0],
  };
}
