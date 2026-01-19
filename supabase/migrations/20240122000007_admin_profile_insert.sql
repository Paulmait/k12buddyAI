-- =====================================================
-- Admin Profile Insert Policy
-- Allows admins to insert profiles for testing
-- =====================================================

-- Admin can insert profiles
CREATE POLICY profiles_admin_insert ON profiles
  FOR INSERT WITH CHECK (is_user_admin(auth.uid()));
