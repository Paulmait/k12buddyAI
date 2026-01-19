-- =====================================================
-- Fix Profile RLS Infinite Recursion
-- The profiles_parent_view_children policy causes recursion
-- because it queries profiles while evaluating profiles access
-- =====================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS profiles_parent_view_children ON profiles;

-- Create a helper function to get linked children without RLS
CREATE OR REPLACE FUNCTION get_user_linked_children(p_user_id UUID)
RETURNS UUID[] AS $$
  SELECT COALESCE(linked_children, '{}')
  FROM profiles
  WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate parent-child viewing policy using the helper function
CREATE POLICY profiles_parent_view_children ON profiles
  FOR SELECT USING (
    id = ANY(get_user_linked_children(auth.uid()))
  );

-- Also add an admin view policy so admins can see all profiles
CREATE POLICY profiles_admin_view ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Wait, that also causes recursion. Let's use a different approach.
DROP POLICY IF EXISTS profiles_admin_view ON profiles;

-- Create helper function for admin check
CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT role = 'admin'
  FROM profiles
  WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin can view all profiles
CREATE POLICY profiles_admin_view ON profiles
  FOR SELECT USING (is_user_admin(auth.uid()));

-- Admin can update all profiles
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE USING (is_user_admin(auth.uid()));

-- Admin can delete profiles (for admin deletion function)
CREATE POLICY profiles_admin_delete ON profiles
  FOR DELETE USING (is_user_admin(auth.uid()));
