/**
 * Admin Delete User Edge Function
 *
 * Completely removes a user account and all associated data:
 * - All database records (profiles, students, chat sessions, etc.)
 * - All storage bucket files (uploads, avatars)
 * - The auth.users entry
 *
 * Requires admin authentication and logs all actions for audit.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteUserRequest {
  user_id: string;
  reason?: string;
  delete_auth_user?: boolean; // default true
}

interface DeleteUserResponse {
  success: boolean;
  deleted_at?: string;
  deleted_items?: {
    profile: boolean;
    student: boolean;
    devices: number;
    chat_sessions: number;
    uploads: number;
    storage_files: number;
    auth_user: boolean;
  };
  error?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token for RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client for verifying admin status (uses user's token)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify caller is authenticated
    const { data: { user: callerUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller is an admin
    const { data: adminProfile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileError || adminProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: DeleteUserRequest = await req.json();
    const { user_id, reason, delete_auth_user = true } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track deletion results
    const deletedItems = {
      profile: false,
      student: false,
      devices: 0,
      chat_sessions: 0,
      uploads: 0,
      storage_files: 0,
      auth_user: false,
    };

    // Get user info for logging before deletion
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user_id)
      .single();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get student record
    const { data: studentRecord } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('user_id', user_id)
      .single();

    const studentId = studentRecord?.id;

    // 1. Delete storage files (uploads bucket)
    if (studentId) {
      // List all files in user's folder
      const { data: uploadFiles } = await supabaseAdmin.storage
        .from('uploads')
        .list(`${user_id}`);

      if (uploadFiles && uploadFiles.length > 0) {
        const filePaths = uploadFiles.map(f => `${user_id}/${f.name}`);
        await supabaseAdmin.storage.from('uploads').remove(filePaths);
        deletedItems.storage_files += uploadFiles.length;
      }

      // List avatar files
      const { data: avatarFiles } = await supabaseAdmin.storage
        .from('avatars')
        .list(`${user_id}`);

      if (avatarFiles && avatarFiles.length > 0) {
        const avatarPaths = avatarFiles.map(f => `${user_id}/${f.name}`);
        await supabaseAdmin.storage.from('avatars').remove(avatarPaths);
        deletedItems.storage_files += avatarFiles.length;
      }
    }

    // 2. Delete user_devices
    const { data: deletedDevices } = await supabaseAdmin
      .from('user_devices')
      .delete()
      .eq('user_id', user_id)
      .select('id');
    deletedItems.devices = deletedDevices?.length || 0;

    // 3. Delete student_uploads
    if (studentId) {
      const { data: deletedUploads } = await supabaseAdmin
        .from('student_uploads')
        .delete()
        .eq('student_id', studentId)
        .select('id');
      deletedItems.uploads = deletedUploads?.length || 0;
    }

    // 4. Delete chat_sessions (messages cascade)
    if (studentId) {
      const { data: deletedSessions } = await supabaseAdmin
        .from('chat_sessions')
        .delete()
        .eq('student_id', studentId)
        .select('id');
      deletedItems.chat_sessions = deletedSessions?.length || 0;
    }

    // 5. Delete gamification data
    await supabaseAdmin.from('student_xp').delete().eq('student_id', user_id);
    await supabaseAdmin.from('student_streaks').delete().eq('student_id', user_id);
    await supabaseAdmin.from('student_badges').delete().eq('student_id', user_id);
    await supabaseAdmin.from('xp_events').delete().eq('student_id', user_id);

    // 6. Delete learning data
    await supabaseAdmin.from('review_cards').delete().eq('student_id', user_id);
    await supabaseAdmin.from('review_history').delete().eq('student_id', user_id);
    await supabaseAdmin.from('learning_profiles').delete().eq('student_id', user_id);
    await supabaseAdmin.from('learning_interactions').delete().eq('student_id', user_id);

    // 7. Unlink from parent accounts
    await supabaseAdmin.rpc('admin_unlink_user_from_family', { p_user_id: user_id });

    // 8. Delete student record
    if (studentId) {
      await supabaseAdmin.from('students').delete().eq('id', studentId);
      deletedItems.student = true;
    }

    // 9. Delete profile
    await supabaseAdmin.from('profiles').delete().eq('id', user_id);
    deletedItems.profile = true;

    // 10. Delete auth user (if requested)
    if (delete_auth_user) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (!deleteAuthError) {
        deletedItems.auth_user = true;
      } else {
        console.error('Failed to delete auth user:', deleteAuthError);
      }
    }

    // 11. Log the deletion for audit
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: callerUser.id,
      action: 'complete_account_deletion',
      target_user_id: user_id,
      details: {
        deleted_profile: targetProfile,
        reason: reason || 'Admin requested deletion',
        deleted_items: deletedItems,
      },
    });

    const response: DeleteUserResponse = {
      success: true,
      deleted_at: new Date().toISOString(),
      deleted_items: deletedItems,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin delete user error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
