/**
 * Account Service
 * Handles account management, deletion, and subscription operations
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Account deletion result
export interface DeletionRequestResult {
  success: boolean;
  scheduledFor?: Date;
  gracePeriodDays?: number;
  error?: string;
}

// Data export result
export interface DataExportResult {
  success: boolean;
  data?: UserDataExport;
  error?: string;
}

// User data export structure
export interface UserDataExport {
  exported_at: string;
  profile: Record<string, unknown>;
  student: Record<string, unknown>;
  devices: Record<string, unknown>[];
  gamification: {
    xp: Record<string, unknown>;
    streaks: Record<string, unknown>;
    badges: Record<string, unknown>[];
  };
  chat_history: Array<{
    session_id: string;
    created_at: string;
    messages: Array<{
      role: string;
      content: string;
      created_at: string;
    }>;
  }>;
}

// Profile data
export interface UserProfile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  birth_date?: string;
  account_type?: string;
  grade?: string;
  learning_style?: string;
  preferred_subjects?: string[];
  linked_parent_id?: string;
  linked_children?: string[];
  profile_completed?: boolean;
  deletion_requested_at?: string;
  location_consent?: boolean;
  analytics_opt_out?: boolean;
  parent_consent_verified?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Request account deletion (30-day grace period)
 */
export async function requestAccountDeletion(): Promise<DeletionRequestResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Call database function
    const { data, error } = await supabase.rpc('request_account_deletion', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('Account deletion request error:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Unknown error' };
    }

    return {
      success: true,
      scheduledFor: new Date(data.scheduled_for),
      gracePeriodDays: data.grace_period_days,
    };
  } catch (error) {
    console.error('Account deletion request exception:', error);
    return { success: false, error: 'Failed to request account deletion' };
  }
}

/**
 * Cancel a pending deletion request
 */
export async function cancelDeletionRequest(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.rpc('cancel_deletion_request', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('Cancel deletion error:', error);
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? false };
  } catch (error) {
    console.error('Cancel deletion exception:', error);
    return { success: false, error: 'Failed to cancel deletion request' };
  }
}

/**
 * Download all user data (GDPR compliance)
 */
export async function downloadMyData(): Promise<DataExportResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.rpc('export_user_data', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('Data export error:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Export failed' };
    }

    return {
      success: true,
      data: data as UserDataExport,
    };
  } catch (error) {
    console.error('Data export exception:', error);
    return { success: false, error: 'Failed to export data' };
  }
}

/**
 * Get current user profile
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Get profile error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Get profile exception:', error);
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Update profile exception:', error);
    return { success: false, error: 'Failed to update profile' };
  }
}

/**
 * Update analytics opt-out preference
 */
export async function updateAnalyticsOptOut(optOut: boolean): Promise<boolean> {
  const result = await updateUserProfile({ analytics_opt_out: optOut });
  return result.success;
}

/**
 * Check if account has pending deletion
 */
export async function hasPendingDeletion(): Promise<{
  pending: boolean;
  scheduledFor?: Date;
}> {
  try {
    const profile = await getUserProfile();
    if (!profile || !profile.deletion_requested_at) {
      return { pending: false };
    }

    const requestedAt = new Date(profile.deletion_requested_at);
    const scheduledFor = new Date(requestedAt);
    scheduledFor.setDate(scheduledFor.getDate() + 30);

    return {
      pending: true,
      scheduledFor,
    };
  } catch {
    return { pending: false };
  }
}

/**
 * Sign out and clear local data
 */
export async function signOut(): Promise<boolean> {
  try {
    // Clear AsyncStorage
    const keysToRemove = [
      'k12buddy_onboarding_complete',
      // Add other keys as needed
    ];
    await AsyncStorage.multiRemove(keysToRemove);

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Sign out exception:', error);
    return false;
  }
}

/**
 * Mark profile as completed
 */
export async function markProfileCompleted(): Promise<boolean> {
  const result = await updateUserProfile({ profile_completed: true });
  return result.success;
}

/**
 * Check if profile setup is complete
 */
export async function isProfileComplete(): Promise<boolean> {
  const profile = await getUserProfile();
  return profile?.profile_completed ?? false;
}

/**
 * Get linked parent profile (for child accounts)
 */
export async function getLinkedParent(): Promise<UserProfile | null> {
  try {
    const profile = await getUserProfile();
    if (!profile?.linked_parent_id) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.linked_parent_id)
      .single();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Get linked children profiles (for parent accounts)
 */
export async function getLinkedChildren(): Promise<UserProfile[]> {
  try {
    const profile = await getUserProfile();
    if (!profile?.linked_children?.length) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', profile.linked_children);

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Generate a link code for parent-child linking
 */
export async function generateLinkCode(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Generate a simple 6-character code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Store it temporarily (expires in 24 hours)
    await AsyncStorage.setItem(
      `link_code_${user.id}`,
      JSON.stringify({
        code,
        expires: Date.now() + 24 * 60 * 60 * 1000,
      })
    );

    return code;
  } catch {
    return null;
  }
}

/**
 * Verify parental consent for under-13 user
 */
export async function verifyParentalConsent(): Promise<boolean> {
  const result = await updateUserProfile({
    parent_consent_verified: true,
    parent_consent_verified_at: new Date().toISOString(),
  } as Partial<UserProfile>);
  return result.success;
}

/**
 * Check if user is under 13 based on birth date
 */
export async function isUserUnder13(): Promise<boolean | null> {
  try {
    const profile = await getUserProfile();
    if (!profile?.birth_date) return null;

    const birthDate = new Date(profile.birth_date);
    const today = new Date();
    const thirteenYearsAgo = new Date(
      today.getFullYear() - 13,
      today.getMonth(),
      today.getDate()
    );

    return birthDate > thirteenYearsAgo;
  } catch {
    return null;
  }
}

export default {
  requestAccountDeletion,
  cancelDeletionRequest,
  downloadMyData,
  getUserProfile,
  updateUserProfile,
  updateAnalyticsOptOut,
  hasPendingDeletion,
  signOut,
  markProfileCompleted,
  isProfileComplete,
  getLinkedParent,
  getLinkedChildren,
  generateLinkCode,
  verifyParentalConsent,
  isUserUnder13,
};
