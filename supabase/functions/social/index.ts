/**
 * Social Features Edge Function
 * Handles leaderboards and study groups
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeaderboardRequest {
  type: 'xp' | 'streak' | 'badges';
  scope: 'global' | 'grade' | 'friends';
  period: 'all_time' | 'monthly' | 'weekly' | 'daily';
  limit?: number;
}

serve(async (req) => {
  // Handle CORS preflight
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

    // Get authenticated user
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
      case 'leaderboard':
        return await handleLeaderboard(req, supabaseClient, user.id);
      case 'groups':
        return await handleGroups(req, supabaseClient, user.id);
      case 'join-group':
        return await handleJoinGroup(req, supabaseClient, user.id);
      case 'leave-group':
        return await handleLeaveGroup(req, supabaseClient, user.id);
      default:
        return new Response(
          JSON.stringify({ error: 'Not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Social function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleLeaderboard(
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

  const body: LeaderboardRequest = await req.json();
  const { type = 'xp', scope = 'global', limit = 50 } = body;

  // Get user's grade for filtering
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('grade')
    .eq('id', userId)
    .single();

  // Try to use materialized view first
  let query = supabase
    .from('leaderboard_xp')
    .select('*');

  if (scope === 'grade' && userProfile?.grade) {
    query = query.eq('grade', userProfile.grade);
  }

  query = query.order('global_rank', { ascending: true }).limit(limit);

  const { data: leaderboard, error } = await query;

  if (error) {
    // Fallback to direct query if materialized view doesn't exist
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('student_xp')
      .select(`
        student_id,
        total_xp,
        current_level,
        profiles!inner(display_name, avatar_url, grade)
      `)
      .order('total_xp', { ascending: false })
      .limit(limit);

    if (fallbackError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leaderboard' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entries = (fallbackData || []).map((entry: Record<string, unknown>, index: number) => ({
      rank: index + 1,
      studentId: entry.student_id,
      displayName: (entry.profiles as Record<string, unknown>)?.display_name || 'Student',
      avatarUrl: (entry.profiles as Record<string, unknown>)?.avatar_url,
      grade: (entry.profiles as Record<string, unknown>)?.grade,
      value: entry.total_xp,
      isCurrentUser: entry.student_id === userId,
    }));

    const userRank = entries.findIndex((e: Record<string, unknown>) => e.isCurrentUser) + 1 || null;

    return new Response(
      JSON.stringify({
        type,
        scope,
        entries,
        userRank,
        totalParticipants: entries.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const entries = (leaderboard || []).map((entry: Record<string, unknown>) => ({
    rank: scope === 'grade' ? entry.grade_rank : entry.global_rank,
    studentId: entry.student_id,
    displayName: entry.display_name || 'Student',
    avatarUrl: entry.avatar_url,
    grade: entry.grade,
    value: entry.total_xp,
    isCurrentUser: entry.student_id === userId,
  }));

  const userRank = entries.find((e: Record<string, unknown>) => e.isCurrentUser)?.rank || null;

  return new Response(
    JSON.stringify({
      type,
      scope,
      entries,
      userRank,
      totalParticipants: entries.length,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGroups(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  if (req.method === 'GET') {
    // List groups
    const url = new URL(req.url);
    const subject = url.searchParams.get('subject');
    const grade = url.searchParams.get('grade');

    let query = supabase
      .from('study_groups')
      .select(`
        *,
        study_group_members!left(user_id)
      `)
      .eq('is_private', false)
      .order('member_count', { ascending: false });

    if (subject) query = query.eq('subject', subject);
    if (grade) query = query.eq('grade_level', grade);

    const { data, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch groups' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const groups = (data || []).map((group: Record<string, unknown>) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      subject: group.subject,
      gradeLevel: group.grade_level,
      memberCount: group.member_count,
      maxMembers: group.max_members,
      isPrivate: group.is_private,
      createdAt: group.created_at,
      isJoined: (group.study_group_members as Array<{ user_id: string }> || [])
        .some(m => m.user_id === userId),
    }));

    return new Response(
      JSON.stringify({ groups }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'POST') {
    // Create group
    const body = await req.json();
    const { name, description, subject, gradeLevel, isPrivate, maxMembers } = body;

    if (!name || !subject || !gradeLevel) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create group
    const { data: group, error: groupError } = await supabase
      .from('study_groups')
      .insert({
        name,
        description,
        subject,
        grade_level: gradeLevel,
        is_private: isPrivate || false,
        max_members: maxMembers || 50,
        created_by: userId,
        member_count: 1,
      })
      .select()
      .single();

    if (groupError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create group' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add creator as admin
    await supabase
      .from('study_group_members')
      .insert({
        group_id: group.id,
        user_id: userId,
        role: 'admin',
      });

    return new Response(
      JSON.stringify({ group }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleJoinGroup(
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

  const { groupId } = await req.json();

  if (!groupId) {
    return new Response(
      JSON.stringify({ error: 'Group ID required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if group exists and has room
  const { data: group } = await supabase
    .from('study_groups')
    .select('member_count, max_members')
    .eq('id', groupId)
    .single();

  if (!group) {
    return new Response(
      JSON.stringify({ error: 'Group not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (group.member_count >= group.max_members) {
    return new Response(
      JSON.stringify({ error: 'Group is full' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Join group
  const { error } = await supabase
    .from('study_group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
      role: 'member',
    });

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      return new Response(
        JSON.stringify({ error: 'Already a member' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: 'Failed to join group' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Increment member count
  await supabase.rpc('increment_group_member_count', { group_id: groupId });

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleLeaveGroup(
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

  const { groupId } = await req.json();

  if (!groupId) {
    return new Response(
      JSON.stringify({ error: 'Group ID required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Leave group
  const { error } = await supabase
    .from('study_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to leave group' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Decrement member count
  await supabase.rpc('decrement_group_member_count', { group_id: groupId });

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
