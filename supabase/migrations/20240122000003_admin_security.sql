-- =====================================================
-- Admin Security Migration
-- Implements MFA requirements, password policies,
-- and security controls for admin accounts
-- =====================================================

-- =====================================================
-- 1. ADMIN SECURITY SETTINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_verified_at TIMESTAMPTZ,
  last_password_change TIMESTAMPTZ DEFAULT NOW(),
  password_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '6 months'),
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  security_questions_set BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_admin_security_user ON admin_security_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_security_expires ON admin_security_settings(password_expires_at);

-- RLS for admin_security_settings
ALTER TABLE admin_security_settings ENABLE ROW LEVEL SECURITY;

-- Admins can only see their own security settings
CREATE POLICY admin_security_self_select ON admin_security_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY admin_security_self_update ON admin_security_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- 2. PASSWORD POLICY CONFIGURATION
-- =====================================================

CREATE TABLE IF NOT EXISTS password_policy (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton table
  min_length INTEGER DEFAULT 12,
  require_uppercase BOOLEAN DEFAULT true,
  require_lowercase BOOLEAN DEFAULT true,
  require_numbers BOOLEAN DEFAULT true,
  require_special_chars BOOLEAN DEFAULT true,
  special_chars VARCHAR(50) DEFAULT '!@#$%^&*()_+-=[]{}|;:,.<>?',
  max_age_days INTEGER DEFAULT 180, -- 6 months
  prevent_reuse_count INTEGER DEFAULT 5, -- Can't reuse last 5 passwords
  lockout_threshold INTEGER DEFAULT 5, -- Lock after 5 failed attempts
  lockout_duration_minutes INTEGER DEFAULT 30,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default policy
INSERT INTO password_policy (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. PASSWORD HISTORY (Prevent Reuse)
-- =====================================================

CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, -- Hashed version for comparison
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id, created_at DESC);

-- RLS - No direct access, only via functions
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. ADMIN ROLE VALIDATION FUNCTION
-- =====================================================

-- Function to check if user is admin with valid security status
CREATE OR REPLACE FUNCTION is_valid_admin(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_security admin_security_settings%ROWTYPE;
  v_issues TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Get profile
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

  IF v_profile IS NULL OR v_profile.role != 'admin' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Not an admin user'
    );
  END IF;

  -- Get security settings
  SELECT * INTO v_security FROM admin_security_settings WHERE user_id = p_user_id;

  -- Check MFA
  IF v_security IS NULL OR NOT v_security.mfa_enabled THEN
    v_issues := array_append(v_issues, 'MFA not enabled');
  END IF;

  -- Check password expiry
  IF v_security IS NOT NULL AND v_security.password_expires_at < NOW() THEN
    v_issues := array_append(v_issues, 'Password expired');
  END IF;

  -- Check if locked
  IF v_security IS NOT NULL AND v_security.locked_until IS NOT NULL AND v_security.locked_until > NOW() THEN
    v_issues := array_append(v_issues, 'Account locked');
  END IF;

  IF array_length(v_issues, 1) > 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'issues', to_jsonb(v_issues)
    );
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. PASSWORD VALIDATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION validate_admin_password(p_password TEXT)
RETURNS JSONB AS $$
DECLARE
  v_policy password_policy%ROWTYPE;
  v_issues TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT * INTO v_policy FROM password_policy WHERE id = 1;

  -- Check minimum length
  IF length(p_password) < v_policy.min_length THEN
    v_issues := array_append(v_issues,
      format('Password must be at least %s characters', v_policy.min_length));
  END IF;

  -- Check uppercase
  IF v_policy.require_uppercase AND p_password !~ '[A-Z]' THEN
    v_issues := array_append(v_issues, 'Password must contain at least one uppercase letter');
  END IF;

  -- Check lowercase
  IF v_policy.require_lowercase AND p_password !~ '[a-z]' THEN
    v_issues := array_append(v_issues, 'Password must contain at least one lowercase letter');
  END IF;

  -- Check numbers
  IF v_policy.require_numbers AND p_password !~ '[0-9]' THEN
    v_issues := array_append(v_issues, 'Password must contain at least one number');
  END IF;

  -- Check special characters
  IF v_policy.require_special_chars AND p_password !~ '[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]' THEN
    v_issues := array_append(v_issues, 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  END IF;

  -- Check for common weak patterns
  IF p_password ~* '(password|123456|qwerty|admin|letmein)' THEN
    v_issues := array_append(v_issues, 'Password contains common weak patterns');
  END IF;

  IF array_length(v_issues, 1) > 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'issues', to_jsonb(v_issues)
    );
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. ADMIN PROMOTION FUNCTION (Requires MFA Setup)
-- =====================================================

CREATE OR REPLACE FUNCTION promote_to_admin(p_user_id UUID, p_promoted_by UUID)
RETURNS JSONB AS $$
DECLARE
  v_promoter_valid JSONB;
BEGIN
  -- Verify promoter is a valid admin
  v_promoter_valid := is_valid_admin(p_promoted_by);

  IF NOT (v_promoter_valid->>'valid')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Promoter is not a valid admin',
      'details', v_promoter_valid
    );
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Update role to admin
  UPDATE profiles
  SET role = 'admin', updated_at = NOW()
  WHERE id = p_user_id;

  -- Create security settings (MFA required before full access)
  INSERT INTO admin_security_settings (user_id, mfa_enabled, last_password_change)
  VALUES (p_user_id, false, NOW())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW();

  -- Log the promotion
  INSERT INTO admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (
    p_promoted_by,
    'admin_promotion',
    p_user_id,
    jsonb_build_object('promoted_at', NOW())
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User promoted to admin. MFA setup required before full access.',
    'next_steps', jsonb_build_array(
      'Enable MFA in account settings',
      'Set a strong password meeting policy requirements'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. MFA VERIFICATION FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION admin_enable_mfa(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Verify user is calling for themselves
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Update MFA status
  UPDATE admin_security_settings
  SET
    mfa_enabled = true,
    mfa_verified_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the action
  INSERT INTO admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (
    p_user_id,
    'mfa_enabled',
    p_user_id,
    jsonb_build_object('enabled_at', NOW())
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. PASSWORD CHANGE TRACKING
-- =====================================================

CREATE OR REPLACE FUNCTION admin_record_password_change(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_policy password_policy%ROWTYPE;
BEGIN
  SELECT * INTO v_policy FROM password_policy WHERE id = 1;

  -- Update security settings
  UPDATE admin_security_settings
  SET
    last_password_change = NOW(),
    password_expires_at = NOW() + (v_policy.max_age_days || ' days')::INTERVAL,
    failed_login_attempts = 0,
    locked_until = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the action
  INSERT INTO admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (
    p_user_id,
    'password_changed',
    p_user_id,
    jsonb_build_object(
      'changed_at', NOW(),
      'expires_at', NOW() + (v_policy.max_age_days || ' days')::INTERVAL
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', NOW() + (v_policy.max_age_days || ' days')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. LOGIN ATTEMPT TRACKING
-- =====================================================

CREATE OR REPLACE FUNCTION admin_record_login_attempt(
  p_user_id UUID,
  p_success BOOLEAN,
  p_ip_address INET DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_policy password_policy%ROWTYPE;
  v_security admin_security_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_policy FROM password_policy WHERE id = 1;
  SELECT * INTO v_security FROM admin_security_settings WHERE user_id = p_user_id;

  IF p_success THEN
    -- Successful login
    UPDATE admin_security_settings
    SET
      failed_login_attempts = 0,
      last_login_at = NOW(),
      last_login_ip = p_ip_address,
      locked_until = NULL,
      updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('success', true);
  ELSE
    -- Failed login
    UPDATE admin_security_settings
    SET
      failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Check if should lock
    IF COALESCE(v_security.failed_login_attempts, 0) + 1 >= v_policy.lockout_threshold THEN
      UPDATE admin_security_settings
      SET locked_until = NOW() + (v_policy.lockout_duration_minutes || ' minutes')::INTERVAL
      WHERE user_id = p_user_id;

      -- Log lockout
      INSERT INTO admin_audit_log (admin_id, action, target_user_id, details)
      VALUES (
        p_user_id,
        'account_locked',
        p_user_id,
        jsonb_build_object(
          'reason', 'Too many failed login attempts',
          'locked_until', NOW() + (v_policy.lockout_duration_minutes || ' minutes')::INTERVAL
        )
      );

      RETURN jsonb_build_object(
        'success', false,
        'locked', true,
        'locked_until', NOW() + (v_policy.lockout_duration_minutes || ' minutes')::INTERVAL
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'attempts_remaining', v_policy.lockout_threshold - (COALESCE(v_security.failed_login_attempts, 0) + 1)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. VIEW FOR ADMINS NEEDING PASSWORD RESET
-- =====================================================

CREATE OR REPLACE VIEW admins_password_expiring AS
SELECT
  p.id,
  p.display_name,
  p.email,
  s.password_expires_at,
  s.last_password_change,
  s.mfa_enabled,
  CASE
    WHEN s.password_expires_at < NOW() THEN 'expired'
    WHEN s.password_expires_at < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
    ELSE 'valid'
  END as password_status
FROM profiles p
JOIN admin_security_settings s ON p.id = s.user_id
WHERE p.role = 'admin';

-- Grant access to admins only
REVOKE ALL ON admins_password_expiring FROM PUBLIC;

-- =====================================================
-- 11. SCHEDULED CLEANUP FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_lockouts()
RETURNS void AS $$
BEGIN
  UPDATE admin_security_settings
  SET locked_until = NULL, failed_login_attempts = 0
  WHERE locked_until IS NOT NULL AND locked_until < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 12. ENHANCED ADMIN DELETE CHECK
-- =====================================================

-- Update the admin_delete_user_account function to check MFA
CREATE OR REPLACE FUNCTION admin_delete_user_account_secure(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_admin_valid JSONB;
  v_deleted_data JSONB;
BEGIN
  -- Verify caller is a valid admin with MFA
  v_admin_valid := is_valid_admin(auth.uid());

  IF NOT (v_admin_valid->>'valid')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin validation failed',
      'details', v_admin_valid
    );
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Prevent deleting other admins without super-admin role
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete admin accounts via this function. Use admin panel.'
    );
  END IF;

  -- Track what we're deleting for audit log
  v_deleted_data := jsonb_build_object(
    'user_id', p_user_id,
    'deleted_by', auth.uid(),
    'deleted_at', NOW()
  );

  -- Delete all user data (same as original function)
  DELETE FROM user_devices WHERE user_id = p_user_id;

  DELETE FROM student_uploads
  WHERE student_id IN (SELECT id FROM students WHERE user_id = p_user_id);

  DELETE FROM chat_sessions
  WHERE student_id IN (SELECT id FROM students WHERE user_id = p_user_id);

  DELETE FROM student_xp WHERE student_id = p_user_id;
  DELETE FROM student_streaks WHERE student_id = p_user_id;
  DELETE FROM student_badges WHERE student_id = p_user_id;
  DELETE FROM xp_events WHERE student_id = p_user_id;

  DELETE FROM review_cards WHERE student_id = p_user_id;
  DELETE FROM review_history WHERE student_id = p_user_id;
  DELETE FROM learning_profiles WHERE student_id = p_user_id;
  DELETE FROM learning_interactions WHERE student_id = p_user_id;

  -- Unlink from family
  PERFORM admin_unlink_user_from_family(p_user_id);

  DELETE FROM students WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;

  -- Log the deletion
  INSERT INTO admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (auth.uid(), 'secure_account_deletion', p_user_id, v_deleted_data);

  RETURN jsonb_build_object(
    'success', true,
    'deleted_at', NOW(),
    'message', 'User account deleted. Auth user must be deleted via admin API.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 13. COMMENTS
-- =====================================================

COMMENT ON TABLE admin_security_settings IS 'Security settings for admin accounts including MFA and password expiry';
COMMENT ON TABLE password_policy IS 'Password policy configuration for admin accounts';
COMMENT ON TABLE password_history IS 'Password history for preventing password reuse';
