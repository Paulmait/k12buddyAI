/**
 * Adaptive Difficulty System
 * Adjusts content difficulty based on student performance
 */

import { supabase } from './supabase';
import type { Difficulty } from '../types';

// ============ Types ============

export interface PerformanceData {
  correct: number;
  incorrect: number;
  hintsUsed: number;
  averageResponseTime: number; // in seconds
  streakLength: number;
  recentAccuracy: number; // 0-1
}

export interface DifficultyRecommendation {
  currentDifficulty: Difficulty;
  recommendedDifficulty: Difficulty;
  confidence: number; // 0-1
  reason: string;
  shouldAdjust: boolean;
}

export interface LearningProfile {
  studentId: string;
  overallDifficulty: Difficulty;
  subjectDifficulties: Record<string, Difficulty>;
  performanceHistory: PerformanceWindow[];
  lastUpdated: string;
}

interface PerformanceWindow {
  startTime: string;
  endTime: string;
  correct: number;
  total: number;
  difficulty: Difficulty;
}

// ============ Constants ============

// Thresholds for difficulty adjustment
const THRESHOLDS = {
  // Accuracy thresholds
  PROMOTE_ACCURACY: 0.85, // >85% correct → consider increasing difficulty
  DEMOTE_ACCURACY: 0.50, // <50% correct → consider decreasing difficulty

  // Response time thresholds (seconds)
  FAST_RESPONSE: 10, // Quick responses suggest material is easy
  SLOW_RESPONSE: 60, // Slow responses suggest struggle

  // Hint usage thresholds
  MAX_HINTS_BEFORE_DEMOTE: 3, // Too many hints suggests difficulty is too high

  // Minimum samples for adjustment
  MIN_SAMPLES: 5, // Need at least 5 interactions before adjusting

  // Streak thresholds
  PROMOTE_STREAK: 5, // 5 correct in a row → consider promoting
  STRUGGLE_STREAK: 3, // 3 wrong in a row → consider demoting

  // Confidence required to make adjustment
  MIN_CONFIDENCE: 0.7,
};

// ============ Difficulty Management ============

/**
 * Calculate recommended difficulty based on performance
 */
export function calculateDifficultyRecommendation(
  currentDifficulty: Difficulty,
  performance: PerformanceData
): DifficultyRecommendation {
  const totalInteractions = performance.correct + performance.incorrect;

  // Not enough data yet
  if (totalInteractions < THRESHOLDS.MIN_SAMPLES) {
    return {
      currentDifficulty,
      recommendedDifficulty: currentDifficulty,
      confidence: 0,
      reason: 'Not enough data to make a recommendation',
      shouldAdjust: false,
    };
  }

  const accuracy = totalInteractions > 0
    ? performance.correct / totalInteractions
    : 0;

  let recommendedDifficulty = currentDifficulty;
  let confidence = 0;
  let reason = '';
  let shouldAdjust = false;

  // Check for promotion (increase difficulty)
  if (
    accuracy >= THRESHOLDS.PROMOTE_ACCURACY &&
    performance.averageResponseTime <= THRESHOLDS.FAST_RESPONSE &&
    performance.hintsUsed === 0
  ) {
    recommendedDifficulty = promoteDifficulty(currentDifficulty);
    confidence = calculateConfidence(accuracy, totalInteractions, true);
    reason = 'Excellent performance! Ready for more challenging content.';
    shouldAdjust = recommendedDifficulty !== currentDifficulty && confidence >= THRESHOLDS.MIN_CONFIDENCE;
  }
  // Check for demotion (decrease difficulty)
  else if (
    accuracy <= THRESHOLDS.DEMOTE_ACCURACY ||
    performance.hintsUsed >= THRESHOLDS.MAX_HINTS_BEFORE_DEMOTE ||
    performance.averageResponseTime >= THRESHOLDS.SLOW_RESPONSE
  ) {
    recommendedDifficulty = demoteDifficulty(currentDifficulty);
    confidence = calculateConfidence(1 - accuracy, totalInteractions, false);
    reason = "Let's practice with some easier problems to build confidence.";
    shouldAdjust = recommendedDifficulty !== currentDifficulty && confidence >= THRESHOLDS.MIN_CONFIDENCE;
  }
  // Check streak-based adjustments
  else if (performance.streakLength >= THRESHOLDS.PROMOTE_STREAK) {
    recommendedDifficulty = promoteDifficulty(currentDifficulty);
    confidence = 0.6 + (performance.streakLength - THRESHOLDS.PROMOTE_STREAK) * 0.1;
    reason = 'Great streak! You might be ready for harder problems.';
    shouldAdjust = recommendedDifficulty !== currentDifficulty && confidence >= THRESHOLDS.MIN_CONFIDENCE;
  }
  // Maintain current difficulty
  else {
    reason = 'Current difficulty level seems appropriate.';
    confidence = 0.5;
  }

  return {
    currentDifficulty,
    recommendedDifficulty,
    confidence: Math.min(1, confidence),
    reason,
    shouldAdjust,
  };
}

/**
 * Promote to next difficulty level
 */
function promoteDifficulty(current: Difficulty): Difficulty {
  switch (current) {
    case 'struggling':
      return 'average';
    case 'average':
      return 'advanced';
    case 'advanced':
      return 'advanced'; // Already at max
    default:
      return 'average';
  }
}

/**
 * Demote to previous difficulty level
 */
function demoteDifficulty(current: Difficulty): Difficulty {
  switch (current) {
    case 'struggling':
      return 'struggling'; // Already at min
    case 'average':
      return 'struggling';
    case 'advanced':
      return 'average';
    default:
      return 'average';
  }
}

/**
 * Calculate confidence in the recommendation
 */
function calculateConfidence(
  performanceSignal: number,
  sampleSize: number,
  isPromotion: boolean
): number {
  // Base confidence from performance signal
  let confidence = performanceSignal;

  // Adjust for sample size (more data = more confidence)
  const sampleFactor = Math.min(1, sampleSize / 20);
  confidence *= sampleFactor;

  // Be more conservative with promotions
  if (isPromotion) {
    confidence *= 0.9;
  }

  return Math.min(1, Math.max(0, confidence));
}

// ============ Performance Tracking ============

/**
 * Record an interaction for difficulty tracking
 */
export async function recordInteraction(
  studentId: string,
  subject: string,
  wasCorrect: boolean,
  responseTimeSeconds: number,
  hintsUsed: number
): Promise<void> {
  try {
    await supabase
      .from('learning_interactions')
      .insert({
        student_id: studentId,
        subject,
        was_correct: wasCorrect,
        response_time_seconds: responseTimeSeconds,
        hints_used: hintsUsed,
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Error recording interaction:', error);
  }
}

/**
 * Get performance data for a student and subject
 */
export async function getPerformanceData(
  studentId: string,
  subject: string,
  windowMinutes: number = 60
): Promise<PerformanceData> {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('learning_interactions')
      .select('was_correct, response_time_seconds, hints_used')
      .eq('student_id', studentId)
      .eq('subject', subject)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return getDefaultPerformanceData();
    }

    const correct = data.filter(d => d.was_correct).length;
    const incorrect = data.filter(d => !d.was_correct).length;
    const totalHints = data.reduce((sum, d) => sum + (d.hints_used || 0), 0);
    const avgTime = data.length > 0
      ? data.reduce((sum, d) => sum + (d.response_time_seconds || 0), 0) / data.length
      : 0;

    // Calculate current streak
    let streak = 0;
    for (const interaction of data) {
      if (interaction.was_correct) {
        streak++;
      } else {
        break;
      }
    }

    // Recent accuracy (last 10 interactions)
    const recent = data.slice(0, 10);
    const recentCorrect = recent.filter(d => d.was_correct).length;
    const recentAccuracy = recent.length > 0 ? recentCorrect / recent.length : 0;

    return {
      correct,
      incorrect,
      hintsUsed: totalHints,
      averageResponseTime: avgTime,
      streakLength: streak,
      recentAccuracy,
    };
  } catch (error) {
    console.error('Error getting performance data:', error);
    return getDefaultPerformanceData();
  }
}

function getDefaultPerformanceData(): PerformanceData {
  return {
    correct: 0,
    incorrect: 0,
    hintsUsed: 0,
    averageResponseTime: 0,
    streakLength: 0,
    recentAccuracy: 0,
  };
}

/**
 * Get or create learning profile for a student
 */
export async function getLearningProfile(studentId: string): Promise<LearningProfile | null> {
  try {
    const { data, error } = await supabase
      .from('learning_profiles')
      .select('*')
      .eq('student_id', studentId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error getting learning profile:', error);
      return null;
    }

    if (data) {
      return {
        studentId: data.student_id,
        overallDifficulty: data.overall_difficulty,
        subjectDifficulties: data.subject_difficulties || {},
        performanceHistory: data.performance_history || [],
        lastUpdated: data.updated_at,
      };
    }

    // Create new profile
    const newProfile: LearningProfile = {
      studentId,
      overallDifficulty: 'average',
      subjectDifficulties: {},
      performanceHistory: [],
      lastUpdated: new Date().toISOString(),
    };

    await supabase
      .from('learning_profiles')
      .insert({
        student_id: studentId,
        overall_difficulty: newProfile.overallDifficulty,
        subject_difficulties: newProfile.subjectDifficulties,
        performance_history: newProfile.performanceHistory,
      });

    return newProfile;
  } catch (error) {
    console.error('Error in getLearningProfile:', error);
    return null;
  }
}

/**
 * Update difficulty for a subject
 */
export async function updateSubjectDifficulty(
  studentId: string,
  subject: string,
  newDifficulty: Difficulty
): Promise<boolean> {
  try {
    const profile = await getLearningProfile(studentId);
    if (!profile) return false;

    const updatedDifficulties = {
      ...profile.subjectDifficulties,
      [subject]: newDifficulty,
    };

    const { error } = await supabase
      .from('learning_profiles')
      .update({
        subject_difficulties: updatedDifficulties,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId);

    return !error;
  } catch (error) {
    console.error('Error updating difficulty:', error);
    return false;
  }
}

/**
 * Get recommended difficulty for a subject
 */
export async function getRecommendedDifficulty(
  studentId: string,
  subject: string
): Promise<Difficulty> {
  const profile = await getLearningProfile(studentId);
  if (!profile) return 'average';

  // Check subject-specific difficulty first
  if (profile.subjectDifficulties[subject]) {
    return profile.subjectDifficulties[subject];
  }

  // Fall back to overall difficulty
  return profile.overallDifficulty;
}

export default {
  calculateDifficultyRecommendation,
  recordInteraction,
  getPerformanceData,
  getLearningProfile,
  updateSubjectDifficulty,
  getRecommendedDifficulty,
  THRESHOLDS,
};
