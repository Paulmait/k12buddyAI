-- =====================================================
-- K12Buddy Production Features Migration
-- Creates tables for social features, spaced repetition,
-- adaptive difficulty, audit logging, and more
-- =====================================================

-- =====================================================
-- 1. AUDIT LOGGING TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- 2. STUDY GROUPS (SOCIAL FEATURES)
-- =====================================================

CREATE TABLE IF NOT EXISTS study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  member_count INTEGER DEFAULT 0,
  max_members INTEGER DEFAULT 50,
  is_private BOOLEAN DEFAULT false,
  invite_code TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_groups_subject ON study_groups(subject);
CREATE INDEX idx_study_groups_grade ON study_groups(grade_level);
CREATE INDEX idx_study_groups_public ON study_groups(is_private) WHERE NOT is_private;

-- Study group members
CREATE TABLE IF NOT EXISTS study_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  xp_contributed INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON study_group_members(group_id);
CREATE INDEX idx_group_members_user ON study_group_members(user_id);

-- Study group activity feed
CREATE TABLE IF NOT EXISTS study_group_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('join', 'leave', 'message', 'achievement', 'challenge')),
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_activity_group ON study_group_activity(group_id, created_at DESC);

-- Enable RLS
ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_activity ENABLE ROW LEVEL SECURITY;

-- Study groups policies
CREATE POLICY "Public groups are viewable by all" ON study_groups
  FOR SELECT USING (NOT is_private OR created_by = auth.uid());

CREATE POLICY "Members can view private groups" ON study_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM study_group_members
      WHERE study_group_members.group_id = study_groups.id
      AND study_group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create groups" ON study_groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update their groups" ON study_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM study_group_members
      WHERE study_group_members.group_id = study_groups.id
      AND study_group_members.user_id = auth.uid()
      AND study_group_members.role = 'admin'
    )
  );

-- Group members policies
CREATE POLICY "Members can view group members" ON study_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM study_group_members AS sgm
      WHERE sgm.group_id = study_group_members.group_id
      AND sgm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join groups" ON study_group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups" ON study_group_members
  FOR DELETE USING (user_id = auth.uid());

-- Group activity policies
CREATE POLICY "Members can view group activity" ON study_group_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM study_group_members
      WHERE study_group_members.group_id = study_group_activity.group_id
      AND study_group_members.user_id = auth.uid()
    )
  );

-- Functions for member count
CREATE OR REPLACE FUNCTION increment_group_member_count(group_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE study_groups
  SET member_count = member_count + 1, updated_at = NOW()
  WHERE id = group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_group_member_count(group_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE study_groups
  SET member_count = GREATEST(0, member_count - 1), updated_at = NOW()
  WHERE id = group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. SPACED REPETITION TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS review_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  ease_factor DECIMAL(4,2) DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  interval_days INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review_date DATE DEFAULT CURRENT_DATE,
  last_review_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_cards_student ON review_cards(student_id);
CREATE INDEX idx_review_cards_due ON review_cards(student_id, next_review_date);
CREATE INDEX idx_review_cards_subject ON review_cards(student_id, subject);

-- Review history
CREATE TABLE IF NOT EXISTS review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES review_cards(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quality INTEGER NOT NULL CHECK (quality >= 0 AND quality <= 5),
  response_time_ms INTEGER,
  ease_factor_after DECIMAL(4,2),
  interval_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_history_card ON review_history(card_id, created_at DESC);
CREATE INDEX idx_review_history_student ON review_history(student_id, created_at DESC);

-- Enable RLS
ALTER TABLE review_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_history ENABLE ROW LEVEL SECURITY;

-- Review cards policies
CREATE POLICY "Users can manage their own cards" ON review_cards
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Users can view their own review history" ON review_history
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Users can insert their own review history" ON review_history
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- =====================================================
-- 4. ADAPTIVE DIFFICULTY TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS learning_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_difficulty TEXT DEFAULT 'average' CHECK (overall_difficulty IN ('struggling', 'average', 'advanced')),
  subject_difficulties JSONB DEFAULT '{}',
  performance_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_profiles_student ON learning_profiles(student_id);

-- Learning interactions for tracking performance
CREATE TABLE IF NOT EXISTS learning_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  subject TEXT NOT NULL,
  topic TEXT,
  was_correct BOOLEAN NOT NULL,
  response_time_seconds INTEGER,
  hints_used INTEGER DEFAULT 0,
  difficulty_at_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_interactions_student ON learning_interactions(student_id, created_at DESC);
CREATE INDEX idx_learning_interactions_subject ON learning_interactions(student_id, subject, created_at DESC);

-- Enable RLS
ALTER TABLE learning_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_interactions ENABLE ROW LEVEL SECURITY;

-- Learning profiles policies
CREATE POLICY "Users can manage their own learning profile" ON learning_profiles
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Users can manage their own interactions" ON learning_interactions
  FOR ALL USING (student_id = auth.uid());

-- =====================================================
-- 5. CONTENT MODERATION TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('message', 'profile', 'group', 'other')),
  content_id TEXT NOT NULL,
  content_preview TEXT,
  reason TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('inappropriate', 'incorrect', 'offensive', 'personal_info', 'spam', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_reports_status ON content_reports(status, created_at DESC);
CREATE INDEX idx_content_reports_reporter ON content_reports(reporter_id);

-- Blocked content patterns (for admin management)
CREATE TABLE IF NOT EXISTS blocked_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL UNIQUE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('exact', 'contains', 'regex')),
  category TEXT NOT NULL,
  severity TEXT DEFAULT 'block' CHECK (severity IN ('warn', 'flag', 'block')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocked_patterns_active ON blocked_patterns(is_active, category);

-- Enable RLS
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_patterns ENABLE ROW LEVEL SECURITY;

-- Content reports policies
CREATE POLICY "Users can create reports" ON content_reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can view their own reports" ON content_reports
  FOR SELECT USING (reporter_id = auth.uid());

CREATE POLICY "Admins can manage all reports" ON content_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator')
    )
  );

-- Blocked patterns policies (admin only)
CREATE POLICY "Admins can manage blocked patterns" ON blocked_patterns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 6. UPDATE PROFILES TABLE
-- =====================================================

-- Add new columns to profiles if they don't exist
DO $$
BEGIN
  -- Add role column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'student' CHECK (role IN ('student', 'parent', 'teacher', 'moderator', 'admin'));
  END IF;

  -- Add learning style column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'learning_style') THEN
    ALTER TABLE profiles ADD COLUMN learning_style TEXT CHECK (learning_style IN ('visual', 'auditory', 'reading', 'kinesthetic'));
  END IF;

  -- Add preferred subjects column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'preferred_subjects') THEN
    ALTER TABLE profiles ADD COLUMN preferred_subjects TEXT[] DEFAULT '{}';
  END IF;

  -- Add onboarding completed flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
    ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
  END IF;

  -- Add avatar URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
  END IF;

  -- Add display name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
    ALTER TABLE profiles ADD COLUMN display_name TEXT;
  END IF;
END $$;

-- =====================================================
-- 7. LEADERBOARD MATERIALIZED VIEW
-- =====================================================

-- Create materialized view for faster leaderboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_xp AS
SELECT
  sx.student_id,
  sx.total_xp,
  sx.current_level,
  p.display_name,
  p.avatar_url,
  p.grade,
  RANK() OVER (ORDER BY sx.total_xp DESC) as global_rank,
  RANK() OVER (PARTITION BY p.grade ORDER BY sx.total_xp DESC) as grade_rank
FROM student_xp sx
JOIN profiles p ON sx.student_id = p.id
WHERE p.role = 'student';

CREATE UNIQUE INDEX idx_leaderboard_xp_student ON leaderboard_xp(student_id);
CREATE INDEX idx_leaderboard_xp_global ON leaderboard_xp(global_rank);
CREATE INDEX idx_leaderboard_xp_grade ON leaderboard_xp(grade, grade_rank);

-- Function to refresh leaderboard (call periodically)
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. SESSION MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_info JSONB DEFAULT '{}',
  ip_address INET,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id, is_active);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at) WHERE is_active;

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own sessions" ON user_sessions
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- 9. RATE LIMITING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, action_type, window_start)
);

CREATE INDEX idx_rate_limits_user_action ON rate_limits(user_id, action_type, window_start DESC);

-- Cleanup old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. INDEXES FOR PERFORMANCE
-- =====================================================

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_xp_level ON student_xp(current_level DESC, total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_student_streaks_active ON student_streaks(current_streak DESC) WHERE current_streak > 0;
CREATE INDEX IF NOT EXISTS idx_student_badges_recent ON student_badges(student_id, earned_at DESC);

-- =====================================================
-- 11. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_study_groups_updated_at
  BEFORE UPDATE ON study_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_review_cards_updated_at
  BEFORE UPDATE ON review_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_learning_profiles_updated_at
  BEFORE UPDATE ON learning_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 12. SEED ADMIN USER ROLE
-- =====================================================

-- Create function to promote user to admin (use carefully!)
CREATE OR REPLACE FUNCTION promote_to_admin(target_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET role = 'admin' WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke public access to admin function
REVOKE ALL ON FUNCTION promote_to_admin FROM PUBLIC;
