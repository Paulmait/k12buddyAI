/**
 * Adaptive Difficulty Edge Function
 * Adjusts content difficulty based on student performance
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Difficulty = 'struggling' | 'average' | 'advanced';

interface PerformanceData {
  correct: number;
  incorrect: number;
  hintsUsed: number;
  averageResponseTime: number;
  streakLength: number;
  recentAccuracy: number;
}

// Thresholds for difficulty adjustment
const THRESHOLDS = {
  PROMOTE_ACCURACY: 0.85,
  DEMOTE_ACCURACY: 0.50,
  FAST_RESPONSE: 10,
  SLOW_RESPONSE: 60,
  MAX_HINTS_BEFORE_DEMOTE: 3,
  MIN_SAMPLES: 5,
  PROMOTE_STREAK: 5,
  MIN_CONFIDENCE: 0.7,
};

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
      case 'record':
        return await handleRecordInteraction(req, supabaseClient, user.id);
      case 'recommend':
        return await handleGetRecommendation(req, supabaseClient, user.id);
      case 'profile':
        return await handleGetProfile(req, supabaseClient, user.id);
      case 'update':
        return await handleUpdateDifficulty(req, supabaseClient, user.id);
      default:
        return new Response(
          JSON.stringify({ error: 'Not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Adaptive difficulty error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Record a learning interaction
async function handleRecordInteraction(
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

  const { subject, wasCorrect, responseTimeSeconds, hintsUsed } = await req.json();

  if (!subject || wasCorrect === undefined) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { error } = await supabase
    .from('learning_interactions')
    .insert({
      student_id: userId,
      subject,
      was_correct: wasCorrect,
      response_time_seconds: responseTimeSeconds || 0,
      hints_used: hintsUsed || 0,
    });

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to record interaction' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if we should recommend a difficulty change
  const performance = await getPerformanceData(supabase, userId, subject);
  const currentDifficulty = await getCurrentDifficulty(supabase, userId, subject);
  const recommendation = calculateRecommendation(currentDifficulty, performance);

  return new Response(
    JSON.stringify({
      recorded: true,
      recommendation: recommendation.shouldAdjust ? recommendation : null,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get difficulty recommendation
async function handleGetRecommendation(
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

  if (!subject) {
    return new Response(
      JSON.stringify({ error: 'Subject required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const performance = await getPerformanceData(supabase, userId, subject);
  const currentDifficulty = await getCurrentDifficulty(supabase, userId, subject);
  const recommendation = calculateRecommendation(currentDifficulty, performance);

  return new Response(
    JSON.stringify({
      ...recommendation,
      performance,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get learning profile
async function handleGetProfile(
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

  const { data: profile } = await supabase
    .from('learning_profiles')
    .select('*')
    .eq('student_id', userId)
    .single();

  if (!profile) {
    // Create default profile
    const { data: newProfile } = await supabase
      .from('learning_profiles')
      .insert({
        student_id: userId,
        overall_difficulty: 'average',
        subject_difficulties: {},
        performance_history: [],
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({ profile: newProfile }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ profile }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Update difficulty for a subject
async function handleUpdateDifficulty(
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

  const { subject, difficulty } = await req.json();

  if (!subject || !difficulty) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!['struggling', 'average', 'advanced'].includes(difficulty)) {
    return new Response(
      JSON.stringify({ error: 'Invalid difficulty level' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get current profile
  const { data: profile } = await supabase
    .from('learning_profiles')
    .select('subject_difficulties')
    .eq('student_id', userId)
    .single();

  const updatedDifficulties = {
    ...(profile?.subject_difficulties || {}),
    [subject]: difficulty,
  };

  // Upsert profile
  const { error } = await supabase
    .from('learning_profiles')
    .upsert({
      student_id: userId,
      subject_difficulties: updatedDifficulties,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'student_id',
    });

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to update difficulty' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, subject, difficulty }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Helper: Get performance data for a subject
async function getPerformanceData(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  subject: string,
  windowMinutes: number = 60
): Promise<PerformanceData> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('learning_interactions')
    .select('was_correct, response_time_seconds, hints_used')
    .eq('student_id', userId)
    .eq('subject', subject)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) {
    return {
      correct: 0,
      incorrect: 0,
      hintsUsed: 0,
      averageResponseTime: 0,
      streakLength: 0,
      recentAccuracy: 0,
    };
  }

  const correct = data.filter(d => d.was_correct).length;
  const incorrect = data.filter(d => !d.was_correct).length;
  const totalHints = data.reduce((sum, d) => sum + (d.hints_used || 0), 0);
  const avgTime = data.reduce((sum, d) => sum + (d.response_time_seconds || 0), 0) / data.length;

  // Calculate streak
  let streak = 0;
  for (const interaction of data) {
    if (interaction.was_correct) {
      streak++;
    } else {
      break;
    }
  }

  // Recent accuracy (last 10)
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
}

// Helper: Get current difficulty for a subject
async function getCurrentDifficulty(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  subject: string
): Promise<Difficulty> {
  const { data: profile } = await supabase
    .from('learning_profiles')
    .select('overall_difficulty, subject_difficulties')
    .eq('student_id', userId)
    .single();

  if (!profile) return 'average';

  const subjectDiff = profile.subject_difficulties?.[subject];
  if (subjectDiff) return subjectDiff as Difficulty;

  return (profile.overall_difficulty as Difficulty) || 'average';
}

// Helper: Calculate difficulty recommendation
function calculateRecommendation(
  currentDifficulty: Difficulty,
  performance: PerformanceData
): {
  currentDifficulty: Difficulty;
  recommendedDifficulty: Difficulty;
  confidence: number;
  reason: string;
  shouldAdjust: boolean;
} {
  const totalInteractions = performance.correct + performance.incorrect;

  // Not enough data
  if (totalInteractions < THRESHOLDS.MIN_SAMPLES) {
    return {
      currentDifficulty,
      recommendedDifficulty: currentDifficulty,
      confidence: 0,
      reason: 'Not enough data to make a recommendation',
      shouldAdjust: false,
    };
  }

  const accuracy = performance.correct / totalInteractions;
  let recommendedDifficulty = currentDifficulty;
  let confidence = 0;
  let reason = '';
  let shouldAdjust = false;

  // Check for promotion
  if (
    accuracy >= THRESHOLDS.PROMOTE_ACCURACY &&
    performance.averageResponseTime <= THRESHOLDS.FAST_RESPONSE &&
    performance.hintsUsed === 0
  ) {
    recommendedDifficulty = promoteDifficulty(currentDifficulty);
    confidence = Math.min(1, accuracy * (totalInteractions / 20));
    reason = 'Excellent performance! Ready for more challenging content.';
    shouldAdjust = recommendedDifficulty !== currentDifficulty && confidence >= THRESHOLDS.MIN_CONFIDENCE;
  }
  // Check for demotion
  else if (
    accuracy <= THRESHOLDS.DEMOTE_ACCURACY ||
    performance.hintsUsed >= THRESHOLDS.MAX_HINTS_BEFORE_DEMOTE ||
    performance.averageResponseTime >= THRESHOLDS.SLOW_RESPONSE
  ) {
    recommendedDifficulty = demoteDifficulty(currentDifficulty);
    confidence = Math.min(1, (1 - accuracy) * (totalInteractions / 20));
    reason = "Let's practice with some easier problems to build confidence.";
    shouldAdjust = recommendedDifficulty !== currentDifficulty && confidence >= THRESHOLDS.MIN_CONFIDENCE;
  }
  // Check streak
  else if (performance.streakLength >= THRESHOLDS.PROMOTE_STREAK) {
    recommendedDifficulty = promoteDifficulty(currentDifficulty);
    confidence = 0.6 + (performance.streakLength - THRESHOLDS.PROMOTE_STREAK) * 0.1;
    reason = 'Great streak! You might be ready for harder problems.';
    shouldAdjust = recommendedDifficulty !== currentDifficulty && confidence >= THRESHOLDS.MIN_CONFIDENCE;
  }
  else {
    reason = 'Current difficulty level seems appropriate.';
    confidence = 0.5;
  }

  return {
    currentDifficulty,
    recommendedDifficulty,
    confidence: Math.round(confidence * 100) / 100,
    reason,
    shouldAdjust,
  };
}

function promoteDifficulty(current: Difficulty): Difficulty {
  switch (current) {
    case 'struggling': return 'average';
    case 'average': return 'advanced';
    case 'advanced': return 'advanced';
    default: return 'average';
  }
}

function demoteDifficulty(current: Difficulty): Difficulty {
  switch (current) {
    case 'struggling': return 'struggling';
    case 'average': return 'struggling';
    case 'advanced': return 'average';
    default: return 'average';
  }
}
