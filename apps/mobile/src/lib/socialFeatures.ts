/**
 * Social Features
 * Leaderboards and study groups functionality
 */

import { supabase } from './supabase';

// ============ Leaderboard Types ============

export type LeaderboardType = 'xp' | 'streak' | 'badges' | 'challenges';
export type LeaderboardScope = 'global' | 'grade' | 'school' | 'friends';
export type LeaderboardPeriod = 'all_time' | 'monthly' | 'weekly' | 'daily';

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  displayName: string;
  avatarUrl?: string;
  grade: string;
  value: number;
  isCurrentUser: boolean;
}

export interface LeaderboardData {
  type: LeaderboardType;
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  userRank: number | null;
  totalParticipants: number;
  lastUpdated: string;
}

// ============ Study Group Types ============

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  subject: string;
  gradeLevel: string;
  memberCount: number;
  maxMembers: number;
  isPrivate: boolean;
  createdBy: string;
  createdAt: string;
  isJoined: boolean;
}

export interface GroupMember {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: string;
  xpContributed: number;
}

export interface GroupActivity {
  id: string;
  groupId: string;
  userId: string;
  displayName: string;
  type: 'join' | 'message' | 'achievement' | 'challenge';
  content: string;
  createdAt: string;
}

// ============ Leaderboard Functions ============

/**
 * Get leaderboard data
 */
export async function getLeaderboard(
  type: LeaderboardType = 'xp',
  scope: LeaderboardScope = 'global',
  period: LeaderboardPeriod = 'weekly',
  limit: number = 50
): Promise<LeaderboardData | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get current user's profile for comparison
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, grade')
      .eq('id', user.id)
      .single();

    // Build query based on type
    let query = supabase
      .from('student_xp')
      .select(`
        student_id,
        total_xp,
        current_level,
        profiles!inner(display_name, avatar_url, grade)
      `)
      .order('total_xp', { ascending: false })
      .limit(limit);

    // Apply scope filter
    if (scope === 'grade' && currentProfile?.grade) {
      query = query.eq('profiles.grade', currentProfile.grade);
    }

    const { data: leaderboardData, error } = await query;

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return null;
    }

    // Map to LeaderboardEntry format
    const entries: LeaderboardEntry[] = (leaderboardData || []).map((entry, index) => ({
      rank: index + 1,
      studentId: entry.student_id,
      displayName: (entry.profiles as { display_name?: string })?.display_name || 'Student',
      avatarUrl: (entry.profiles as { avatar_url?: string })?.avatar_url,
      grade: (entry.profiles as { grade?: string })?.grade || '',
      value: entry.total_xp,
      isCurrentUser: entry.student_id === user.id,
    }));

    // Find user's rank
    const userRank = entries.findIndex(e => e.isCurrentUser) + 1 || null;

    return {
      type,
      scope,
      period,
      entries,
      userRank,
      totalParticipants: entries.length,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    return null;
  }
}

/**
 * Get user's position across all leaderboards
 */
export async function getUserLeaderboardPositions(userId: string): Promise<{
  xp: number | null;
  streak: number | null;
  badges: number | null;
}> {
  try {
    // This would need proper database functions for accurate ranking
    // For now, return a simplified version
    const { data: xpData } = await supabase
      .from('student_xp')
      .select('total_xp')
      .order('total_xp', { ascending: false });

    const { data: userXp } = await supabase
      .from('student_xp')
      .select('total_xp')
      .eq('student_id', userId)
      .single();

    let xpRank: number | null = null;
    if (xpData && userXp) {
      xpRank = xpData.findIndex(x => x.total_xp <= userXp.total_xp) + 1;
    }

    return {
      xp: xpRank,
      streak: null, // Would need streak leaderboard query
      badges: null, // Would need badges leaderboard query
    };
  } catch (error) {
    console.error('Error getting user positions:', error);
    return { xp: null, streak: null, badges: null };
  }
}

// ============ Study Group Functions ============

/**
 * Get available study groups
 */
export async function getStudyGroups(
  filters?: {
    subject?: string;
    grade?: string;
    search?: string;
  }
): Promise<StudyGroup[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('study_groups')
      .select(`
        id,
        name,
        description,
        subject,
        grade_level,
        member_count,
        max_members,
        is_private,
        created_by,
        created_at,
        study_group_members!left(user_id)
      `)
      .eq('is_private', false)
      .order('member_count', { ascending: false });

    if (filters?.subject) {
      query = query.eq('subject', filters.subject);
    }
    if (filters?.grade) {
      query = query.eq('grade_level', filters.grade);
    }
    if (filters?.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching study groups:', error);
      return [];
    }

    return (data || []).map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      subject: group.subject,
      gradeLevel: group.grade_level,
      memberCount: group.member_count,
      maxMembers: group.max_members,
      isPrivate: group.is_private,
      createdBy: group.created_by,
      createdAt: group.created_at,
      isJoined: (group.study_group_members || []).some(
        (m: { user_id: string }) => m.user_id === user.id
      ),
    }));
  } catch (error) {
    console.error('Error in getStudyGroups:', error);
    return [];
  }
}

/**
 * Join a study group
 */
export async function joinStudyGroup(groupId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('study_group_members')
      .insert({
        group_id: groupId,
        user_id: user.id,
        role: 'member',
      });

    if (error) {
      console.error('Error joining group:', error);
      return false;
    }

    // Increment member count
    await supabase.rpc('increment_group_member_count', { group_id: groupId });

    return true;
  } catch (error) {
    console.error('Error in joinStudyGroup:', error);
    return false;
  }
}

/**
 * Leave a study group
 */
export async function leaveStudyGroup(groupId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('study_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error leaving group:', error);
      return false;
    }

    // Decrement member count
    await supabase.rpc('decrement_group_member_count', { group_id: groupId });

    return true;
  } catch (error) {
    console.error('Error in leaveStudyGroup:', error);
    return false;
  }
}

/**
 * Get group members
 */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  try {
    const { data, error } = await supabase
      .from('study_group_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        xp_contributed,
        profiles!inner(display_name, avatar_url)
      `)
      .eq('group_id', groupId)
      .order('xp_contributed', { ascending: false });

    if (error) {
      console.error('Error fetching group members:', error);
      return [];
    }

    return (data || []).map(member => ({
      id: member.id,
      userId: member.user_id,
      displayName: (member.profiles as { display_name?: string })?.display_name || 'Student',
      avatarUrl: (member.profiles as { avatar_url?: string })?.avatar_url,
      role: member.role as 'admin' | 'moderator' | 'member',
      joinedAt: member.joined_at,
      xpContributed: member.xp_contributed,
    }));
  } catch (error) {
    console.error('Error in getGroupMembers:', error);
    return [];
  }
}

/**
 * Create a study group
 */
export async function createStudyGroup(
  name: string,
  description: string,
  subject: string,
  gradeLevel: string,
  isPrivate: boolean = false,
  maxMembers: number = 50
): Promise<StudyGroup | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('study_groups')
      .insert({
        name,
        description,
        subject,
        grade_level: gradeLevel,
        is_private: isPrivate,
        max_members: maxMembers,
        created_by: user.id,
        member_count: 1,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating group:', error);
      return null;
    }

    // Add creator as admin
    await supabase
      .from('study_group_members')
      .insert({
        group_id: data.id,
        user_id: user.id,
        role: 'admin',
      });

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      subject: data.subject,
      gradeLevel: data.grade_level,
      memberCount: data.member_count,
      maxMembers: data.max_members,
      isPrivate: data.is_private,
      createdBy: data.created_by,
      createdAt: data.created_at,
      isJoined: true,
    };
  } catch (error) {
    console.error('Error in createStudyGroup:', error);
    return null;
  }
}

export default {
  // Leaderboards
  getLeaderboard,
  getUserLeaderboardPositions,
  // Study Groups
  getStudyGroups,
  joinStudyGroup,
  leaveStudyGroup,
  getGroupMembers,
  createStudyGroup,
};
