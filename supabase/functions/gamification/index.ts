import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseClient, getSupabaseServiceClient } from '../_shared/supabase.ts';

// XP values for different actions
const XP_VALUES = {
  chat_message: 5,
  scan_image: 10,
  complete_challenge: 25,
  streak_3: 25,
  streak_7: 50,
  streak_14: 100,
  streak_30: 200,
  level_up: 50,
} as const;

interface AwardXPRequest {
  student_id: string;
  action: 'chat' | 'scan' | 'challenge' | 'streak_bonus' | 'badge';
  amount?: number;
  description?: string;
}

interface UpdateStreakRequest {
  student_id: string;
}

interface CheckBadgesRequest {
  student_id: string;
}

interface GetStatsRequest {
  student_id: string;
}

interface LevelInfo {
  level: number;
  xp_required: number;
  title: string;
  icon: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient(req);
    const serviceClient = getSupabaseServiceClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'award-xp':
        return await handleAwardXP(req, serviceClient);
      case 'update-streak':
        return await handleUpdateStreak(req, serviceClient);
      case 'check-badges':
        return await handleCheckBadges(req, serviceClient);
      case 'stats':
        return await handleGetStats(req, supabase);
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown endpoint' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Gamification error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Award XP to a student
async function handleAwardXP(
  req: Request,
  serviceClient: ReturnType<typeof getSupabaseServiceClient>
): Promise<Response> {
  const body: AwardXPRequest = await req.json();
  const { student_id, action, amount, description } = body;

  // Calculate XP amount
  let xpAmount = amount;
  if (!xpAmount) {
    switch (action) {
      case 'chat':
        xpAmount = XP_VALUES.chat_message;
        break;
      case 'scan':
        xpAmount = XP_VALUES.scan_image;
        break;
      case 'challenge':
        xpAmount = XP_VALUES.complete_challenge;
        break;
      default:
        xpAmount = 5;
    }
  }

  // Get current XP record
  const { data: xpRecord, error: xpError } = await serviceClient
    .from('student_xp')
    .select('*, level_definitions!inner(*)')
    .eq('student_id', student_id)
    .single();

  if (xpError || !xpRecord) {
    // Initialize gamification if not exists
    await serviceClient.from('student_xp').insert({
      student_id,
      total_xp: 0,
      current_level: 1,
      xp_to_next_level: 100,
    });
  }

  const currentXP = xpRecord?.total_xp || 0;
  const currentLevel = xpRecord?.current_level || 1;
  const newTotalXP = currentXP + xpAmount;

  // Check for level up
  const { data: nextLevel } = await serviceClient
    .from('level_definitions')
    .select('*')
    .eq('level', currentLevel + 1)
    .single();

  let leveledUp = false;
  let newLevel = currentLevel;
  let xpToNext = xpRecord?.xp_to_next_level || 100;

  if (nextLevel && newTotalXP >= nextLevel.xp_required) {
    leveledUp = true;
    newLevel = nextLevel.level;

    // Get next level after that for xp_to_next_level
    const { data: futureLevel } = await serviceClient
      .from('level_definitions')
      .select('xp_required')
      .eq('level', newLevel + 1)
      .single();

    xpToNext = futureLevel ? futureLevel.xp_required - newTotalXP : 0;
  } else if (nextLevel) {
    xpToNext = nextLevel.xp_required - newTotalXP;
  }

  // Update XP record
  await serviceClient
    .from('student_xp')
    .upsert({
      student_id,
      total_xp: newTotalXP,
      current_level: newLevel,
      xp_to_next_level: Math.max(xpToNext, 0),
    });

  // Log XP event
  await serviceClient.from('xp_events').insert({
    student_id,
    xp_amount: xpAmount,
    source: action,
    description: description || `Earned ${xpAmount} XP from ${action}`,
  });

  // Update daily activity
  const today = new Date().toISOString().split('T')[0];
  await serviceClient
    .from('daily_activity')
    .upsert(
      {
        student_id,
        activity_date: today,
        chat_messages: action === 'chat' ? 1 : 0,
        scans_completed: action === 'scan' ? 1 : 0,
        xp_earned: xpAmount,
      },
      {
        onConflict: 'student_id,activity_date',
      }
    );

  // If leveled up, award bonus XP
  if (leveledUp) {
    await serviceClient.from('xp_events').insert({
      student_id,
      xp_amount: XP_VALUES.level_up,
      source: 'level_up',
      description: `Level up bonus! Reached level ${newLevel}`,
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      xp_awarded: xpAmount,
      total_xp: newTotalXP,
      current_level: newLevel,
      xp_to_next_level: xpToNext,
      leveled_up: leveledUp,
      new_level: leveledUp ? newLevel : null,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Update student streak
async function handleUpdateStreak(
  req: Request,
  serviceClient: ReturnType<typeof getSupabaseServiceClient>
): Promise<Response> {
  const body: UpdateStreakRequest = await req.json();
  const { student_id } = body;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Get current streak record
  const { data: streakRecord } = await serviceClient
    .from('student_streaks')
    .select('*')
    .eq('student_id', student_id)
    .single();

  let currentStreak = streakRecord?.current_streak || 0;
  let longestStreak = streakRecord?.longest_streak || 0;
  const lastActivity = streakRecord?.last_activity_date;

  // Check if already updated today
  if (lastActivity === todayStr) {
    return new Response(
      JSON.stringify({
        success: true,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        streak_continued: false,
        message: 'Already active today',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Calculate new streak
  let streakBonusAwarded = false;
  let bonusXP = 0;

  if (lastActivity === yesterdayStr) {
    // Continue streak
    currentStreak += 1;
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    // Check for streak milestones
    if (currentStreak === 3) {
      bonusXP = XP_VALUES.streak_3;
      streakBonusAwarded = true;
    } else if (currentStreak === 7) {
      bonusXP = XP_VALUES.streak_7;
      streakBonusAwarded = true;
    } else if (currentStreak === 14) {
      bonusXP = XP_VALUES.streak_14;
      streakBonusAwarded = true;
    } else if (currentStreak === 30) {
      bonusXP = XP_VALUES.streak_30;
      streakBonusAwarded = true;
    }
  } else if (!lastActivity) {
    // First activity ever
    currentStreak = 1;
    longestStreak = 1;
  } else {
    // Streak broken, start over
    currentStreak = 1;
  }

  // Update streak record
  await serviceClient
    .from('student_streaks')
    .upsert({
      student_id,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_activity_date: todayStr,
    });

  // Award streak bonus XP if milestone reached
  if (streakBonusAwarded && bonusXP > 0) {
    await serviceClient.from('xp_events').insert({
      student_id,
      xp_amount: bonusXP,
      source: 'streak',
      description: `${currentStreak}-day streak bonus!`,
    });

    // Update total XP
    const { data: xpRecord } = await serviceClient
      .from('student_xp')
      .select('total_xp')
      .eq('student_id', student_id)
      .single();

    if (xpRecord) {
      await serviceClient
        .from('student_xp')
        .update({ total_xp: xpRecord.total_xp + bonusXP })
        .eq('student_id', student_id);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      streak_continued: lastActivity === yesterdayStr,
      streak_bonus_awarded: streakBonusAwarded,
      bonus_xp: bonusXP,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Check and award badges
async function handleCheckBadges(
  req: Request,
  serviceClient: ReturnType<typeof getSupabaseServiceClient>
): Promise<Response> {
  const body: CheckBadgesRequest = await req.json();
  const { student_id } = body;

  // Get student stats
  const { data: xpRecord } = await serviceClient
    .from('student_xp')
    .select('total_xp, current_level')
    .eq('student_id', student_id)
    .single();

  const { data: streakRecord } = await serviceClient
    .from('student_streaks')
    .select('current_streak')
    .eq('student_id', student_id)
    .single();

  // Count total messages
  const { count: messageCount } = await serviceClient
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'user')
    .in('session_id',
      serviceClient.from('chat_sessions').select('id').eq('student_id', student_id)
    );

  // Count total scans
  const { count: scanCount } = await serviceClient
    .from('student_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', student_id)
    .eq('upload_type', 'scan');

  // Get already earned badges
  const { data: earnedBadges } = await serviceClient
    .from('student_badges')
    .select('badge_id')
    .eq('student_id', student_id);

  const earnedBadgeIds = new Set(earnedBadges?.map(b => b.badge_id) || []);

  // Get all badge definitions
  const { data: allBadges } = await serviceClient
    .from('badge_definitions')
    .select('*');

  const newBadges: Array<{ id: string; code: string; name: string; xp_reward: number }> = [];

  // Check each badge criteria
  for (const badge of allBadges || []) {
    if (earnedBadgeIds.has(badge.id)) continue;

    const criteria = badge.criteria as { type: string; value: number | string };
    let earned = false;

    switch (criteria.type) {
      case 'streak':
        earned = (streakRecord?.current_streak || 0) >= (criteria.value as number);
        break;
      case 'messages':
        earned = (messageCount || 0) >= (criteria.value as number);
        break;
      case 'scans':
        earned = (scanCount || 0) >= (criteria.value as number);
        break;
      case 'level':
        earned = (xpRecord?.current_level || 1) >= (criteria.value as number);
        break;
      case 'xp':
        earned = (xpRecord?.total_xp || 0) >= (criteria.value as number);
        break;
    }

    if (earned) {
      // Award badge
      await serviceClient.from('student_badges').insert({
        student_id,
        badge_id: badge.id,
      });

      // Award badge XP
      await serviceClient.from('xp_events').insert({
        student_id,
        xp_amount: badge.xp_reward,
        source: 'badge',
        description: `Earned badge: ${badge.name}`,
      });

      // Update total XP
      if (xpRecord) {
        await serviceClient
          .from('student_xp')
          .update({ total_xp: xpRecord.total_xp + badge.xp_reward })
          .eq('student_id', student_id);

        xpRecord.total_xp += badge.xp_reward;
      }

      newBadges.push({
        id: badge.id,
        code: badge.code,
        name: badge.name,
        xp_reward: badge.xp_reward,
      });
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      new_badges: newBadges,
      badges_earned: newBadges.length,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get student gamification stats
async function handleGetStats(
  req: Request,
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<Response> {
  const url = new URL(req.url);
  const student_id = url.searchParams.get('student_id');

  if (!student_id) {
    return new Response(
      JSON.stringify({ error: 'student_id required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get XP and level info
  const { data: xpRecord } = await supabase
    .from('student_xp')
    .select('total_xp, current_level, xp_to_next_level')
    .eq('student_id', student_id)
    .single();

  // Get level info
  const { data: levelInfo } = await supabase
    .from('level_definitions')
    .select('*')
    .eq('level', xpRecord?.current_level || 1)
    .single();

  // Get streak info
  const { data: streakRecord } = await supabase
    .from('student_streaks')
    .select('current_streak, longest_streak, last_activity_date')
    .eq('student_id', student_id)
    .single();

  // Get earned badges
  const { data: earnedBadges } = await supabase
    .from('student_badges')
    .select('*, badge_definitions(*)')
    .eq('student_id', student_id)
    .order('earned_at', { ascending: false });

  // Get active challenges
  const { data: challenges } = await supabase
    .from('challenges')
    .select('*')
    .eq('active', true)
    .eq('type', 'daily');

  const { data: studentChallenges } = await supabase
    .from('student_challenges')
    .select('*')
    .eq('student_id', student_id);

  // Merge challenge progress
  const challengeProgress = challenges?.map(c => {
    const progress = studentChallenges?.find(sc => sc.challenge_id === c.id);
    return {
      ...c,
      progress: progress?.progress || 0,
      completed: progress?.completed || false,
    };
  }) || [];

  // Get recent XP events
  const { data: recentXP } = await supabase
    .from('xp_events')
    .select('*')
    .eq('student_id', student_id)
    .order('created_at', { ascending: false })
    .limit(10);

  return new Response(
    JSON.stringify({
      xp: {
        total: xpRecord?.total_xp || 0,
        level: xpRecord?.current_level || 1,
        xp_to_next_level: xpRecord?.xp_to_next_level || 100,
        level_title: levelInfo?.title || 'Curious Learner',
        level_icon: levelInfo?.icon || '🌱',
      },
      streak: {
        current: streakRecord?.current_streak || 0,
        longest: streakRecord?.longest_streak || 0,
        last_activity: streakRecord?.last_activity_date,
      },
      badges: earnedBadges?.map(b => ({
        id: b.badge_id,
        code: b.badge_definitions.code,
        name: b.badge_definitions.name,
        description: b.badge_definitions.description,
        icon: b.badge_definitions.icon,
        rarity: b.badge_definitions.rarity,
        earned_at: b.earned_at,
      })) || [],
      challenges: challengeProgress,
      recent_xp: recentXP || [],
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
