-- =====================================================
-- K12Buddy User Management & Security Migration
-- Creates device registration, profile enhancements,
-- RLS policies, and account deletion functionality
-- =====================================================

-- =====================================================
-- 1. USER DEVICES TABLE (Device Registration)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  device_model VARCHAR(100),
  device_brand VARCHAR(50),
  os_name VARCHAR(20),
  os_version VARCHAR(20),
  app_version VARCHAR(20),
  is_physical_device BOOLEAN DEFAULT true,
  last_ip_address INET,
  approximate_location JSONB, -- {city, region, country, timezone}
  location_consent BOOLEAN DEFAULT false,
  browser_info JSONB, -- {name, version, user_agent}
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Indexes for user_devices
CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_last_seen ON user_devices(last_seen_at DESC);
CREATE INDEX idx_user_devices_active ON user_devices(user_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Users can view their own devices
CREATE POLICY user_devices_select ON user_devices
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own devices
CREATE POLICY user_devices_insert ON user_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own devices
CREATE POLICY user_devices_update ON user_devices
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own devices
CREATE POLICY user_devices_delete ON user_devices
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can view all devices
CREATE POLICY user_devices_admin_select ON user_devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 2. PROFILE ENHANCEMENTS
-- =====================================================

-- Add new columns to profiles
DO $$
BEGIN
  -- Birth date for age verification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'birth_date') THEN
    ALTER TABLE profiles ADD COLUMN birth_date DATE;
  END IF;

  -- Account type (student, parent, teacher)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'account_type') THEN
    ALTER TABLE profiles ADD COLUMN account_type VARCHAR(20) DEFAULT 'student';
  END IF;

  -- Linked parent for children under 13
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'linked_parent_id') THEN
    ALTER TABLE profiles ADD COLUMN linked_parent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Linked children for parent accounts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'linked_children') THEN
    ALTER TABLE profiles ADD COLUMN linked_children UUID[] DEFAULT '{}';
  END IF;

  -- Profile completion status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_completed') THEN
    ALTER TABLE profiles ADD COLUMN profile_completed BOOLEAN DEFAULT false;
  END IF;

  -- Account deletion request timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'deletion_requested_at') THEN
    ALTER TABLE profiles ADD COLUMN deletion_requested_at TIMESTAMPTZ;
  END IF;

  -- Location consent tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'location_consent') THEN
    ALTER TABLE profiles ADD COLUMN location_consent BOOLEAN DEFAULT false;
  END IF;

  -- Analytics opt-out
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'analytics_opt_out') THEN
    ALTER TABLE profiles ADD COLUMN analytics_opt_out BOOLEAN DEFAULT false;
  END IF;

  -- Parent consent verified (for COPPA)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'parent_consent_verified') THEN
    ALTER TABLE profiles ADD COLUMN parent_consent_verified BOOLEAN DEFAULT false;
  END IF;

  -- Parent consent verified at timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'parent_consent_verified_at') THEN
    ALTER TABLE profiles ADD COLUMN parent_consent_verified_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index on account_type
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_profiles_linked_parent ON profiles(linked_parent_id);
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_requested ON profiles(deletion_requested_at) WHERE deletion_requested_at IS NOT NULL;

-- =====================================================
-- 3. MISSING RLS DELETE POLICIES
-- =====================================================

-- Students table: Add DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'students' AND policyname = 'students_delete'
  ) THEN
    CREATE POLICY students_delete ON students
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Chat sessions: Add DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'chat_sessions_delete'
  ) THEN
    CREATE POLICY chat_sessions_delete ON chat_sessions
      FOR DELETE USING (
        student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Chat messages: Add UPDATE and DELETE policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_update'
  ) THEN
    CREATE POLICY chat_messages_update ON chat_messages
      FOR UPDATE USING (
        session_id IN (
          SELECT cs.id FROM chat_sessions cs
          JOIN students s ON cs.student_id = s.id
          WHERE s.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_delete'
  ) THEN
    CREATE POLICY chat_messages_delete ON chat_messages
      FOR DELETE USING (
        session_id IN (
          SELECT cs.id FROM chat_sessions cs
          JOIN students s ON cs.student_id = s.id
          WHERE s.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Student uploads: Add DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'student_uploads' AND policyname = 'student_uploads_delete'
  ) THEN
    CREATE POLICY student_uploads_delete ON student_uploads
      FOR DELETE USING (
        student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- =====================================================
-- 4. PARENT-CHILD LINKING
-- =====================================================

-- Parent can view linked children's profiles
CREATE POLICY profiles_parent_view_children ON profiles
  FOR SELECT USING (
    id = ANY(
      SELECT unnest(linked_children) FROM profiles WHERE id = auth.uid()
    )
  );

-- Allow parents to view linked children's students records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'students' AND policyname = 'students_parent_view_children'
  ) THEN
    CREATE POLICY students_parent_view_children ON students
      FOR SELECT USING (
        user_id = ANY(
          SELECT unnest(linked_children) FROM profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow parents to view linked children's chat sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'chat_sessions_parent_view_children'
  ) THEN
    CREATE POLICY chat_sessions_parent_view_children ON chat_sessions
      FOR SELECT USING (
        student_id IN (
          SELECT id FROM students WHERE user_id = ANY(
            SELECT unnest(linked_children) FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- =====================================================
-- 5. ACCOUNT DELETION FUNCTIONS
-- =====================================================

-- Function to request account deletion (30-day grace period)
CREATE OR REPLACE FUNCTION request_account_deletion(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_scheduled_for TIMESTAMPTZ;
BEGIN
  -- Verify the user is requesting their own deletion
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Set deletion date to 30 days from now
  v_scheduled_for := NOW() + INTERVAL '30 days';

  -- Mark account for deletion
  UPDATE profiles
  SET
    deletion_requested_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Deactivate all devices
  UPDATE user_devices
  SET is_active = false, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'scheduled_for', v_scheduled_for,
    'grace_period_days', 30
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel deletion request
CREATE OR REPLACE FUNCTION cancel_deletion_request(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Verify the user is canceling their own deletion
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Remove deletion request
  UPDATE profiles
  SET
    deletion_requested_at = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Reactivate devices
  UPDATE user_devices
  SET is_active = true, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to execute account deletion (called by admin or scheduled job)
CREATE OR REPLACE FUNCTION execute_account_deletion(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  -- Get profile to verify deletion was requested
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile not found'
    );
  END IF;

  -- Verify deletion was requested and grace period has passed
  IF v_profile.deletion_requested_at IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No deletion request found'
    );
  END IF;

  IF v_profile.deletion_requested_at + INTERVAL '30 days' > NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Grace period has not expired'
    );
  END IF;

  -- Delete all user data (CASCADE handles most relations)
  -- Delete from user_devices
  DELETE FROM user_devices WHERE user_id = p_user_id;

  -- Delete from student_uploads
  DELETE FROM student_uploads
  WHERE student_id IN (SELECT id FROM students WHERE user_id = p_user_id);

  -- Delete from chat_messages (cascades from sessions)
  DELETE FROM chat_sessions
  WHERE student_id IN (SELECT id FROM students WHERE user_id = p_user_id);

  -- Delete from gamification tables
  DELETE FROM student_xp WHERE student_id = p_user_id;
  DELETE FROM student_streaks WHERE student_id = p_user_id;
  DELETE FROM student_badges WHERE student_id = p_user_id;
  DELETE FROM xp_events WHERE student_id = p_user_id;

  -- Delete from learning tables
  DELETE FROM review_cards WHERE student_id = p_user_id;
  DELETE FROM review_history WHERE student_id = p_user_id;
  DELETE FROM learning_profiles WHERE student_id = p_user_id;
  DELETE FROM learning_interactions WHERE student_id = p_user_id;

  -- Delete student record
  DELETE FROM students WHERE user_id = p_user_id;

  -- Delete profile
  DELETE FROM profiles WHERE id = p_user_id;

  -- Note: auth.users deletion should be handled separately by admin

  RETURN jsonb_build_object(
    'success', true,
    'deleted_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. DATA EXPORT FUNCTION (GDPR)
-- =====================================================

CREATE OR REPLACE FUNCTION export_user_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_profile JSONB;
  v_student JSONB;
  v_devices JSONB;
  v_gamification JSONB;
  v_chat_history JSONB;
BEGIN
  -- Verify the user is exporting their own data
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Get profile data
  SELECT to_jsonb(p.*) INTO v_profile
  FROM profiles p WHERE p.id = p_user_id;

  -- Get student data
  SELECT to_jsonb(s.*) INTO v_student
  FROM students s WHERE s.user_id = p_user_id;

  -- Get devices data
  SELECT jsonb_agg(to_jsonb(d.*)) INTO v_devices
  FROM user_devices d WHERE d.user_id = p_user_id;

  -- Get gamification data
  SELECT jsonb_build_object(
    'xp', (SELECT to_jsonb(sx.*) FROM student_xp sx WHERE sx.student_id = p_user_id),
    'streaks', (SELECT to_jsonb(ss.*) FROM student_streaks ss WHERE ss.student_id = p_user_id),
    'badges', (SELECT jsonb_agg(to_jsonb(sb.*)) FROM student_badges sb WHERE sb.student_id = p_user_id)
  ) INTO v_gamification;

  -- Get recent chat history (last 90 days)
  SELECT jsonb_agg(
    jsonb_build_object(
      'session_id', cs.id,
      'created_at', cs.created_at,
      'messages', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'role', cm.role,
            'content', cm.content,
            'created_at', cm.created_at
          ) ORDER BY cm.created_at
        )
        FROM chat_messages cm WHERE cm.session_id = cs.id
      )
    )
  ) INTO v_chat_history
  FROM chat_sessions cs
  JOIN students s ON cs.student_id = s.id
  WHERE s.user_id = p_user_id
  AND cs.created_at > NOW() - INTERVAL '90 days';

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'exported_at', NOW(),
    'profile', v_profile,
    'student', v_student,
    'devices', COALESCE(v_devices, '[]'::jsonb),
    'gamification', v_gamification,
    'chat_history', COALESCE(v_chat_history, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is under 13
CREATE OR REPLACE FUNCTION is_user_under_13(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_birth_date DATE;
BEGIN
  SELECT birth_date INTO v_birth_date
  FROM profiles WHERE id = p_user_id;

  IF v_birth_date IS NULL THEN
    RETURN NULL; -- Unknown
  END IF;

  RETURN age(v_birth_date) < interval '13 years';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to link child to parent
CREATE OR REPLACE FUNCTION link_child_to_parent(
  p_parent_id UUID,
  p_child_id UUID
)
RETURNS JSONB AS $$
BEGIN
  -- Verify caller is the parent
  IF auth.uid() != p_parent_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Update child's profile
  UPDATE profiles
  SET
    linked_parent_id = p_parent_id,
    updated_at = NOW()
  WHERE id = p_child_id;

  -- Update parent's profile
  UPDATE profiles
  SET
    linked_children = array_append(
      COALESCE(linked_children, ARRAY[]::UUID[]),
      p_child_id
    ),
    updated_at = NOW()
  WHERE id = p_parent_id
  AND NOT (p_child_id = ANY(COALESCE(linked_children, ARRAY[]::UUID[])));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

-- Update updated_at trigger for user_devices
CREATE TRIGGER user_devices_updated_at
  BEFORE UPDATE ON user_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 9. ADMIN ACCOUNT DELETION (Immediate, bypasses grace period)
-- =====================================================

-- Admin function to immediately delete a user account
-- This bypasses the 30-day grace period for legitimate deletion requests
CREATE OR REPLACE FUNCTION admin_delete_user_account(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_deleted_data JSONB;
BEGIN
  -- Verify caller is an admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Track what we're deleting for audit log
  v_deleted_data := jsonb_build_object(
    'user_id', p_user_id,
    'deleted_by', auth.uid(),
    'deleted_at', NOW()
  );

  -- Delete from user_devices
  DELETE FROM user_devices WHERE user_id = p_user_id;

  -- Delete from student_uploads (and remove from storage)
  DELETE FROM student_uploads
  WHERE student_id IN (SELECT id FROM students WHERE user_id = p_user_id);

  -- Delete from chat_messages (via cascade from sessions)
  DELETE FROM chat_sessions
  WHERE student_id IN (SELECT id FROM students WHERE user_id = p_user_id);

  -- Delete from gamification tables
  DELETE FROM student_xp WHERE student_id = p_user_id;
  DELETE FROM student_streaks WHERE student_id = p_user_id;
  DELETE FROM student_badges WHERE student_id = p_user_id;
  DELETE FROM xp_events WHERE student_id = p_user_id;

  -- Delete from learning tables
  DELETE FROM review_cards WHERE student_id = p_user_id;
  DELETE FROM review_history WHERE student_id = p_user_id;
  DELETE FROM learning_profiles WHERE student_id = p_user_id;
  DELETE FROM learning_interactions WHERE student_id = p_user_id;

  -- Unlink from parent accounts (update parent's linked_children)
  UPDATE profiles
  SET linked_children = array_remove(linked_children, p_user_id)
  WHERE p_user_id = ANY(linked_children);

  -- Unlink children (set their linked_parent_id to null)
  UPDATE profiles
  SET linked_parent_id = NULL
  WHERE linked_parent_id = p_user_id;

  -- Delete student record
  DELETE FROM students WHERE user_id = p_user_id;

  -- Delete profile
  DELETE FROM profiles WHERE id = p_user_id;

  -- Log the deletion for audit
  INSERT INTO admin_audit_log (
    admin_id,
    action,
    target_user_id,
    details,
    created_at
  ) VALUES (
    auth.uid(),
    'account_deleted',
    p_user_id,
    v_deleted_data,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_at', NOW(),
    'message', 'User account and all associated data deleted. Auth user must be deleted separately via admin API.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin audit log table for tracking admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_user_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

-- RLS for audit log (admins only)
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_log_admin_select ON admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY admin_audit_log_admin_insert ON admin_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to get all user data for review before deletion
CREATE OR REPLACE FUNCTION admin_get_user_data_summary(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_summary JSONB;
BEGIN
  -- Verify caller is an admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'profile', (SELECT to_jsonb(p.*) FROM profiles p WHERE p.id = p_user_id),
    'statistics', jsonb_build_object(
      'device_count', (SELECT COUNT(*) FROM user_devices WHERE user_id = p_user_id),
      'chat_session_count', (SELECT COUNT(*) FROM chat_sessions cs JOIN students s ON cs.student_id = s.id WHERE s.user_id = p_user_id),
      'message_count', (SELECT COUNT(*) FROM chat_messages cm JOIN chat_sessions cs ON cm.session_id = cs.id JOIN students s ON cs.student_id = s.id WHERE s.user_id = p_user_id),
      'upload_count', (SELECT COUNT(*) FROM student_uploads su JOIN students s ON su.student_id = s.id WHERE s.user_id = p_user_id),
      'linked_children', (SELECT COUNT(*) FROM profiles WHERE linked_parent_id = p_user_id)
    ),
    'created_at', (SELECT created_at FROM profiles WHERE id = p_user_id),
    'deletion_requested_at', (SELECT deletion_requested_at FROM profiles WHERE id = p_user_id)
  ) INTO v_summary;

  RETURN v_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. SCHEDULED JOB SUPPORT
-- =====================================================

-- View for accounts pending deletion (for scheduled job)
CREATE OR REPLACE VIEW accounts_pending_deletion AS
SELECT
  p.id,
  p.display_name,
  p.deletion_requested_at,
  p.deletion_requested_at + INTERVAL '30 days' AS scheduled_deletion
FROM profiles p
WHERE p.deletion_requested_at IS NOT NULL
AND p.deletion_requested_at + INTERVAL '30 days' <= NOW();

-- Grant access to the view for service role only
REVOKE ALL ON accounts_pending_deletion FROM PUBLIC;

-- =====================================================
-- 10. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE user_devices IS 'Tracks user device registrations for security and session management';
COMMENT ON COLUMN profiles.birth_date IS 'User birth date for COPPA compliance age verification';
COMMENT ON COLUMN profiles.account_type IS 'Account type: student, parent, teacher';
COMMENT ON COLUMN profiles.linked_parent_id IS 'Parent account linked to this child account (COPPA)';
COMMENT ON COLUMN profiles.linked_children IS 'Array of child account IDs linked to this parent';
COMMENT ON COLUMN profiles.deletion_requested_at IS 'When account deletion was requested (30-day grace period)';
COMMENT ON FUNCTION request_account_deletion IS 'Request account deletion with 30-day grace period (GDPR)';
COMMENT ON FUNCTION execute_account_deletion IS 'Execute account deletion after grace period';
COMMENT ON FUNCTION export_user_data IS 'Export all user data for GDPR compliance';
COMMENT ON FUNCTION admin_delete_user_account IS 'Admin-only immediate account deletion (bypasses grace period)';
COMMENT ON FUNCTION admin_get_user_data_summary IS 'Admin-only function to view user data summary before deletion';
COMMENT ON TABLE admin_audit_log IS 'Audit log for admin actions including account deletions';

-- Helper function for edge function to unlink user from family
CREATE OR REPLACE FUNCTION admin_unlink_user_from_family(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Unlink from parent accounts (update parent's linked_children)
  UPDATE profiles
  SET linked_children = array_remove(linked_children, p_user_id)
  WHERE p_user_id = ANY(linked_children);

  -- Unlink children (set their linked_parent_id to null)
  UPDATE profiles
  SET linked_parent_id = NULL
  WHERE linked_parent_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
