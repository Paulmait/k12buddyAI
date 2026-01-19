-- =====================================================
-- Avatars and Phone Verification Migration
-- Adds avatar support and phone verification for users
-- =====================================================

-- =====================================================
-- 1. PROFILE ENHANCEMENTS FOR AVATARS AND PHONE
-- =====================================================

-- Add avatar and phone columns to profiles
DO $$
BEGIN
  -- Avatar URL (custom upload or predefined)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
  END IF;

  -- Predefined avatar ID (for kids - COPPA safe)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_id') THEN
    ALTER TABLE profiles ADD COLUMN avatar_id VARCHAR(50);
  END IF;

  -- Phone number (E.164 format)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone_number') THEN
    ALTER TABLE profiles ADD COLUMN phone_number VARCHAR(20);
  END IF;

  -- Phone verified status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone_verified') THEN
    ALTER TABLE profiles ADD COLUMN phone_verified BOOLEAN DEFAULT false;
  END IF;

  -- Phone verified timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone_verified_at') THEN
    ALTER TABLE profiles ADD COLUMN phone_verified_at TIMESTAMPTZ;
  END IF;

  -- SMS MFA enabled
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'sms_mfa_enabled') THEN
    ALTER TABLE profiles ADD COLUMN sms_mfa_enabled BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone_number) WHERE phone_number IS NOT NULL;

-- =====================================================
-- 2. PREDEFINED AVATARS TABLE (COPPA-Safe for Kids)
-- =====================================================

CREATE TABLE IF NOT EXISTS predefined_avatars (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'animals', 'characters', 'nature', 'space', 'sports'
  image_url TEXT NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  min_level INTEGER DEFAULT 1, -- Unlock at certain XP level
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default avatars
INSERT INTO predefined_avatars (id, name, category, image_url, sort_order) VALUES
  ('avatar_owl', 'Wise Owl', 'animals', '/avatars/owl.png', 1),
  ('avatar_fox', 'Clever Fox', 'animals', '/avatars/fox.png', 2),
  ('avatar_bear', 'Friendly Bear', 'animals', '/avatars/bear.png', 3),
  ('avatar_rabbit', 'Quick Rabbit', 'animals', '/avatars/rabbit.png', 4),
  ('avatar_penguin', 'Cool Penguin', 'animals', '/avatars/penguin.png', 5),
  ('avatar_lion', 'Brave Lion', 'animals', '/avatars/lion.png', 6),
  ('avatar_dolphin', 'Smart Dolphin', 'animals', '/avatars/dolphin.png', 7),
  ('avatar_butterfly', 'Creative Butterfly', 'nature', '/avatars/butterfly.png', 8),
  ('avatar_star', 'Shining Star', 'space', '/avatars/star.png', 9),
  ('avatar_rocket', 'Space Explorer', 'space', '/avatars/rocket.png', 10),
  ('avatar_robot', 'Friendly Robot', 'characters', '/avatars/robot.png', 11),
  ('avatar_astronaut', 'Astronaut', 'space', '/avatars/astronaut.png', 12)
ON CONFLICT (id) DO NOTHING;

-- RLS for predefined avatars (everyone can read)
ALTER TABLE predefined_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY predefined_avatars_select ON predefined_avatars
  FOR SELECT USING (true);

-- =====================================================
-- 3. PHONE VERIFICATION CODES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  purpose VARCHAR(20) NOT NULL, -- 'verify', 'mfa', 'recovery'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_phone_codes_user ON phone_verification_codes(user_id, purpose, expires_at);
CREATE INDEX IF NOT EXISTS idx_phone_codes_cleanup ON phone_verification_codes(expires_at);

-- RLS for phone codes
ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own codes
CREATE POLICY phone_codes_select ON phone_verification_codes
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- 4. AVATAR UPLOAD VALIDATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION validate_avatar_upload(
  p_user_id UUID,
  p_file_size INTEGER,
  p_mime_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_max_size INTEGER := 2097152; -- 2MB
  v_allowed_types TEXT[] := ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  v_profile profiles%ROWTYPE;
BEGIN
  -- Check file size
  IF p_file_size > v_max_size THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'File size exceeds 2MB limit'
    );
  END IF;

  -- Check mime type
  IF NOT (p_mime_type = ANY(v_allowed_types)) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF'
    );
  END IF;

  -- Check if user is under 13 (require parent approval for custom avatars)
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

  IF v_profile.birth_date IS NOT NULL AND
     age(v_profile.birth_date) < interval '13 years' AND
     NOT v_profile.parent_consent_verified THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Custom avatars require parent consent for users under 13'
    );
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. PHONE VERIFICATION FUNCTIONS
-- =====================================================

-- Generate verification code
CREATE OR REPLACE FUNCTION generate_phone_verification_code(
  p_user_id UUID,
  p_phone_number VARCHAR(20),
  p_purpose VARCHAR(20) DEFAULT 'verify'
)
RETURNS JSONB AS $$
DECLARE
  v_code VARCHAR(6);
  v_expires_at TIMESTAMPTZ;
  v_existing_count INTEGER;
BEGIN
  -- Verify user is requesting for themselves
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Validate phone format (basic E.164)
  IF p_phone_number !~ '^\+[1-9]\d{6,14}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid phone number format. Use E.164 format (e.g., +1234567890)'
    );
  END IF;

  -- Check rate limiting (max 5 codes per hour)
  SELECT COUNT(*) INTO v_existing_count
  FROM phone_verification_codes
  WHERE user_id = p_user_id
  AND created_at > NOW() - INTERVAL '1 hour';

  IF v_existing_count >= 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many verification attempts. Please try again later.'
    );
  END IF;

  -- Generate 6-digit code
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  v_expires_at := NOW() + INTERVAL '10 minutes';

  -- Invalidate previous codes for same purpose
  UPDATE phone_verification_codes
  SET expires_at = NOW()
  WHERE user_id = p_user_id
  AND purpose = p_purpose
  AND expires_at > NOW();

  -- Insert new code
  INSERT INTO phone_verification_codes (
    user_id, phone_number, code, purpose, expires_at
  ) VALUES (
    p_user_id, p_phone_number, v_code, p_purpose, v_expires_at
  );

  -- Return code (in production, send via SMS instead of returning)
  RETURN jsonb_build_object(
    'success', true,
    'code', v_code, -- Remove in production - send via Twilio/SMS
    'expires_at', v_expires_at,
    'message', 'Verification code generated. In production, this would be sent via SMS.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify phone code
CREATE OR REPLACE FUNCTION verify_phone_code(
  p_user_id UUID,
  p_code VARCHAR(6),
  p_purpose VARCHAR(20) DEFAULT 'verify'
)
RETURNS JSONB AS $$
DECLARE
  v_verification phone_verification_codes%ROWTYPE;
BEGIN
  -- Verify user
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Find valid code
  SELECT * INTO v_verification
  FROM phone_verification_codes
  WHERE user_id = p_user_id
  AND purpose = p_purpose
  AND expires_at > NOW()
  AND verified_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_verification IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No valid verification code found. Please request a new one.'
    );
  END IF;

  -- Check attempts
  IF v_verification.attempts >= v_verification.max_attempts THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many failed attempts. Please request a new code.'
    );
  END IF;

  -- Verify code
  IF v_verification.code != p_code THEN
    -- Increment attempts
    UPDATE phone_verification_codes
    SET attempts = attempts + 1
    WHERE id = v_verification.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid code',
      'attempts_remaining', v_verification.max_attempts - v_verification.attempts - 1
    );
  END IF;

  -- Mark as verified
  UPDATE phone_verification_codes
  SET verified_at = NOW()
  WHERE id = v_verification.id;

  -- Update profile phone verification
  IF p_purpose = 'verify' THEN
    UPDATE profiles
    SET
      phone_number = v_verification.phone_number,
      phone_verified = true,
      phone_verified_at = NOW(),
      updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Phone number verified successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. UPDATE AVATAR FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_avatar(
  p_user_id UUID,
  p_avatar_id VARCHAR(50) DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  -- Verify user
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Validate predefined avatar exists
  IF p_avatar_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM predefined_avatars WHERE id = p_avatar_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid avatar ID'
      );
    END IF;
  END IF;

  -- Update profile
  UPDATE profiles
  SET
    avatar_id = COALESCE(p_avatar_id, avatar_id),
    avatar_url = CASE
      WHEN p_avatar_id IS NOT NULL THEN NULL  -- Clear custom URL if using predefined
      ELSE COALESCE(p_avatar_url, avatar_url)
    END,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. CLEANUP FUNCTION FOR EXPIRED CODES
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_phone_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_verification_codes
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. STORAGE BUCKET POLICIES (Run in Dashboard)
-- =====================================================

-- Note: Create 'avatars' bucket in Supabase Dashboard with these policies:
--
-- SELECT policy (public read):
--   bucket_id = 'avatars'
--
-- INSERT policy (authenticated users, own folder):
--   bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
--
-- UPDATE policy (authenticated users, own folder):
--   bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
--
-- DELETE policy (authenticated users, own folder):
--   bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON TABLE predefined_avatars IS 'COPPA-safe predefined avatars for users';
COMMENT ON TABLE phone_verification_codes IS 'SMS verification codes for phone validation and MFA';
COMMENT ON COLUMN profiles.avatar_id IS 'ID of predefined avatar (COPPA-safe)';
COMMENT ON COLUMN profiles.avatar_url IS 'URL of custom avatar upload';
COMMENT ON COLUMN profiles.phone_number IS 'User phone number in E.164 format';
COMMENT ON COLUMN profiles.phone_verified IS 'Whether phone number has been verified via SMS';
