-- ============================================
-- K12Buddy Gamification System Migration
-- ============================================

-- XP & Leveling System
-- ============================================

-- Level definitions with requirements and rewards
CREATE TABLE level_definitions (
  level INTEGER PRIMARY KEY,
  xp_required INTEGER NOT NULL,
  title VARCHAR(50) NOT NULL,
  icon VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed level definitions (1-50)
INSERT INTO level_definitions (level, xp_required, title, icon) VALUES
  (1, 0, 'Curious Learner', '🌱'),
  (2, 100, 'Eager Explorer', '🔍'),
  (3, 250, 'Knowledge Seeker', '📚'),
  (4, 500, 'Rising Star', '⭐'),
  (5, 800, 'Quick Thinker', '💡'),
  (6, 1200, 'Problem Solver', '🧩'),
  (7, 1700, 'Study Champion', '🏆'),
  (8, 2300, 'Learning Wizard', '🧙'),
  (9, 3000, 'Math Master', '🎯'),
  (10, 3800, 'Brain Power', '🧠'),
  (11, 4700, 'Super Scholar', '🦸'),
  (12, 5700, 'Genius Mode', '🔮'),
  (13, 6800, 'Knowledge Knight', '🛡️'),
  (14, 8000, 'Study Sage', '📖'),
  (15, 9500, 'Learning Legend', '🌟'),
  (16, 11000, 'Academic Ace', '🎓'),
  (17, 13000, 'Brilliant Mind', '💎'),
  (18, 15000, 'Master Scholar', '👑'),
  (19, 17500, 'Wisdom Walker', '🚀'),
  (20, 20000, 'Ultimate Learner', '🏅');

-- Student XP tracking
CREATE TABLE student_xp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_xp INTEGER DEFAULT 0 NOT NULL,
  current_level INTEGER DEFAULT 1 NOT NULL REFERENCES level_definitions(level),
  xp_to_next_level INTEGER DEFAULT 100 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- XP event log for tracking history
CREATE TABLE xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  xp_amount INTEGER NOT NULL,
  source VARCHAR(50) NOT NULL, -- 'chat', 'scan', 'badge', 'streak', 'challenge', 'level_up'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for XP tables
CREATE INDEX idx_student_xp_student ON student_xp(student_id);
CREATE INDEX idx_xp_events_student ON xp_events(student_id);
CREATE INDEX idx_xp_events_created ON xp_events(created_at DESC);

-- Streaks System
-- ============================================

-- Student streak tracking
CREATE TABLE student_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  longest_streak INTEGER DEFAULT 0 NOT NULL,
  last_activity_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Daily activity tracking
CREATE TABLE daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  activity_date DATE NOT NULL,
  chat_messages INTEGER DEFAULT 0 NOT NULL,
  scans_completed INTEGER DEFAULT 0 NOT NULL,
  xp_earned INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(student_id, activity_date)
);

-- Indexes for streak tables
CREATE INDEX idx_student_streaks_student ON student_streaks(student_id);
CREATE INDEX idx_daily_activity_student_date ON daily_activity(student_id, activity_date DESC);

-- Badge System
-- ============================================

-- Badge rarity enum
CREATE TYPE badge_rarity AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary');

-- Badge category enum
CREATE TYPE badge_category AS ENUM ('streak', 'chat', 'scan', 'level', 'milestone', 'special');

-- Badge definitions
CREATE TABLE badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(10) NOT NULL,
  category badge_category NOT NULL,
  rarity badge_rarity NOT NULL,
  xp_reward INTEGER DEFAULT 10 NOT NULL,
  criteria JSONB NOT NULL, -- { type: 'streak', value: 3 } or { type: 'messages', value: 10 }
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed badge definitions
INSERT INTO badge_definitions (code, name, description, icon, category, rarity, xp_reward, criteria) VALUES
  -- Streak badges
  ('streak_3', 'On Fire!', 'Study 3 days in a row', '🔥', 'streak', 'common', 25, '{"type": "streak", "value": 3}'),
  ('streak_7', 'Week Warrior', 'Study 7 days in a row', '⚡', 'streak', 'uncommon', 50, '{"type": "streak", "value": 7}'),
  ('streak_14', 'Two Week Titan', 'Study 14 days in a row', '💪', 'streak', 'rare', 100, '{"type": "streak", "value": 14}'),
  ('streak_30', 'Monthly Master', 'Study 30 days in a row', '🌟', 'streak', 'epic', 200, '{"type": "streak", "value": 30}'),
  ('streak_100', 'Century Champion', 'Study 100 days in a row', '👑', 'streak', 'legendary', 500, '{"type": "streak", "value": 100}'),

  -- Chat badges
  ('chat_first', 'First Question', 'Ask your first question', '❓', 'chat', 'common', 10, '{"type": "messages", "value": 1}'),
  ('chat_10', 'Curious Mind', 'Ask 10 questions', '🤔', 'chat', 'common', 25, '{"type": "messages", "value": 10}'),
  ('chat_50', 'Question Quest', 'Ask 50 questions', '📝', 'chat', 'uncommon', 50, '{"type": "messages", "value": 50}'),
  ('chat_100', 'Inquisitive', 'Ask 100 questions', '🔬', 'chat', 'rare', 100, '{"type": "messages", "value": 100}'),
  ('chat_500', 'Knowledge Seeker', 'Ask 500 questions', '🎓', 'chat', 'epic', 200, '{"type": "messages", "value": 500}'),

  -- Scan badges
  ('scan_first', 'First Scan', 'Scan your first page', '📷', 'scan', 'common', 10, '{"type": "scans", "value": 1}'),
  ('scan_10', 'Scanner Pro', 'Scan 10 pages', '📸', 'scan', 'common', 25, '{"type": "scans", "value": 10}'),
  ('scan_50', 'Document Detective', 'Scan 50 pages', '🔍', 'scan', 'uncommon', 50, '{"type": "scans", "value": 50}'),
  ('scan_100', 'Page Turner', 'Scan 100 pages', '📚', 'scan', 'rare', 100, '{"type": "scans", "value": 100}'),

  -- Level badges
  ('level_5', 'Rising Star', 'Reach level 5', '⭐', 'level', 'common', 25, '{"type": "level", "value": 5}'),
  ('level_10', 'Brain Power', 'Reach level 10', '🧠', 'level', 'uncommon', 50, '{"type": "level", "value": 10}'),
  ('level_15', 'Learning Legend', 'Reach level 15', '🌟', 'level', 'rare', 100, '{"type": "level", "value": 15}'),
  ('level_20', 'Ultimate Learner', 'Reach level 20', '🏅', 'level', 'epic', 200, '{"type": "level", "value": 20}'),

  -- Milestone badges
  ('xp_1000', 'XP Explorer', 'Earn 1,000 XP', '✨', 'milestone', 'common', 25, '{"type": "xp", "value": 1000}'),
  ('xp_5000', 'XP Hunter', 'Earn 5,000 XP', '💫', 'milestone', 'uncommon', 50, '{"type": "xp", "value": 5000}'),
  ('xp_10000', 'XP Master', 'Earn 10,000 XP', '🌠', 'milestone', 'rare', 100, '{"type": "xp", "value": 10000}'),
  ('xp_25000', 'XP Champion', 'Earn 25,000 XP', '🎆', 'milestone', 'epic', 200, '{"type": "xp", "value": 25000}'),

  -- Special badges
  ('early_bird', 'Early Bird', 'Study before 7 AM', '🌅', 'special', 'uncommon', 25, '{"type": "time", "value": "early"}'),
  ('night_owl', 'Night Owl', 'Study after 10 PM', '🦉', 'special', 'uncommon', 25, '{"type": "time", "value": "late"}'),
  ('weekend_warrior', 'Weekend Warrior', 'Study on the weekend', '🎮', 'special', 'common', 15, '{"type": "day", "value": "weekend"}');

-- Student earned badges
CREATE TABLE student_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES badge_definitions(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(student_id, badge_id)
);

-- Indexes for badge tables
CREATE INDEX idx_badge_definitions_category ON badge_definitions(category);
CREATE INDEX idx_student_badges_student ON student_badges(student_id);
CREATE INDEX idx_student_badges_earned ON student_badges(earned_at DESC);

-- Challenges System
-- ============================================

-- Challenge type enum
CREATE TYPE challenge_type AS ENUM ('daily', 'weekly', 'special');

-- Challenge definitions
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  type challenge_type NOT NULL,
  criteria JSONB NOT NULL, -- { action: 'chat', count: 5 }
  xp_reward INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Student challenge progress
CREATE TABLE student_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  progress INTEGER DEFAULT 0 NOT NULL,
  completed BOOLEAN DEFAULT false NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(student_id, challenge_id)
);

-- Seed daily challenges
INSERT INTO challenges (title, description, type, criteria, xp_reward, active) VALUES
  ('Daily Learner', 'Ask 3 questions today', 'daily', '{"action": "chat", "count": 3}', 25, true),
  ('Scan Master', 'Scan 2 pages today', 'daily', '{"action": "scan", "count": 2}', 20, true),
  ('Study Session', 'Ask 5 questions today', 'daily', '{"action": "chat", "count": 5}', 40, true),
  ('Deep Dive', 'Ask 10 questions today', 'daily', '{"action": "chat", "count": 10}', 75, true);

-- Indexes for challenge tables
CREATE INDEX idx_challenges_type ON challenges(type);
CREATE INDEX idx_challenges_active ON challenges(active) WHERE active = true;
CREATE INDEX idx_student_challenges_student ON student_challenges(student_id);
CREATE INDEX idx_student_challenges_completed ON student_challenges(completed) WHERE completed = false;

-- Push Notifications Tables
-- ============================================

-- Push tokens for notifications
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, token)
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  streak_reminders BOOLEAN DEFAULT true NOT NULL,
  badge_notifications BOOLEAN DEFAULT true NOT NULL,
  challenge_notifications BOOLEAN DEFAULT true NOT NULL,
  daily_summary BOOLEAN DEFAULT true NOT NULL,
  quiet_hours_start TIME, -- e.g., '22:00'
  quiet_hours_end TIME,   -- e.g., '07:00'
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for notification tables
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON push_tokens(active) WHERE active = true;

-- Analytics Tables (Privacy-First)
-- ============================================

-- Event tracking (anonymized)
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  event_name VARCHAR(100) NOT NULL,
  event_properties JSONB DEFAULT '{}' NOT NULL, -- No PII
  session_id UUID,
  app_version VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Aggregated metrics for dashboards
CREATE TABLE analytics_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL,
  dimension VARCHAR(50), -- 'grade', 'subject', 'state'
  dimension_value VARCHAR(50),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  value_sum NUMERIC DEFAULT 0,
  value_count INTEGER DEFAULT 0,
  value_avg NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(metric_name, dimension, dimension_value, period_start, period_end)
);

-- Indexes for analytics
CREATE INDEX idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_aggregates_metric ON analytics_aggregates(metric_name, period_start);

-- Parental Consent (COPPA Compliance)
-- ============================================

-- Add columns to profiles table for age gating
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_email VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_version VARCHAR(20);

-- Create index for parent verification status
CREATE INDEX IF NOT EXISTS idx_profiles_parent_verified ON profiles(parent_verified_at) WHERE parent_verified_at IS NOT NULL;

-- Row Level Security
-- ============================================

-- Enable RLS on all gamification tables
ALTER TABLE student_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Student XP
CREATE POLICY student_xp_select ON student_xp FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY student_xp_insert ON student_xp FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY student_xp_update ON student_xp FOR UPDATE
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- RLS Policies: XP Events
CREATE POLICY xp_events_select ON xp_events FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY xp_events_insert ON xp_events FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- RLS Policies: Streaks
CREATE POLICY student_streaks_select ON student_streaks FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY student_streaks_insert ON student_streaks FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY student_streaks_update ON student_streaks FOR UPDATE
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- RLS Policies: Daily Activity
CREATE POLICY daily_activity_select ON daily_activity FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY daily_activity_insert ON daily_activity FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY daily_activity_update ON daily_activity FOR UPDATE
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- RLS Policies: Student Badges
CREATE POLICY student_badges_select ON student_badges FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY student_badges_insert ON student_badges FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- RLS Policies: Student Challenges
CREATE POLICY student_challenges_select ON student_challenges FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY student_challenges_insert ON student_challenges FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY student_challenges_update ON student_challenges FOR UPDATE
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- RLS Policies: Push Tokens
CREATE POLICY push_tokens_select ON push_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY push_tokens_insert ON push_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_tokens_update ON push_tokens FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY push_tokens_delete ON push_tokens FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies: Notification Preferences
CREATE POLICY notification_prefs_select ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY notification_prefs_insert ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_prefs_update ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies: Analytics (write only for users, service role can read all)
CREATE POLICY analytics_events_insert ON analytics_events FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- Service role can bypass RLS for analytics reads

-- Public read access for badge and level definitions
CREATE POLICY badge_definitions_select ON badge_definitions FOR SELECT TO PUBLIC USING (true);
CREATE POLICY level_definitions_select ON level_definitions FOR SELECT TO PUBLIC USING (true);
CREATE POLICY challenges_select ON challenges FOR SELECT TO PUBLIC USING (active = true);

-- Updated_at triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_gamification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_xp_updated_at
  BEFORE UPDATE ON student_xp
  FOR EACH ROW EXECUTE FUNCTION update_gamification_updated_at();

CREATE TRIGGER student_streaks_updated_at
  BEFORE UPDATE ON student_streaks
  FOR EACH ROW EXECUTE FUNCTION update_gamification_updated_at();

CREATE TRIGGER student_challenges_updated_at
  BEFORE UPDATE ON student_challenges
  FOR EACH ROW EXECUTE FUNCTION update_gamification_updated_at();

CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_gamification_updated_at();

CREATE TRIGGER notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_gamification_updated_at();

-- Function to initialize gamification for new student
-- ============================================

CREATE OR REPLACE FUNCTION initialize_student_gamification()
RETURNS TRIGGER AS $$
BEGIN
  -- Create XP record
  INSERT INTO student_xp (student_id, total_xp, current_level, xp_to_next_level)
  VALUES (NEW.id, 0, 1, 100);

  -- Create streak record
  INSERT INTO student_streaks (student_id, current_streak, longest_streak)
  VALUES (NEW.id, 0, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-initialize gamification on student creation
CREATE TRIGGER student_gamification_init
  AFTER INSERT ON students
  FOR EACH ROW EXECUTE FUNCTION initialize_student_gamification();

-- Comments
-- ============================================

COMMENT ON TABLE student_xp IS 'Tracks student XP and level progression';
COMMENT ON TABLE xp_events IS 'Log of all XP awards for audit and display';
COMMENT ON TABLE student_streaks IS 'Tracks daily study streaks';
COMMENT ON TABLE daily_activity IS 'Daily activity summary for streaks and challenges';
COMMENT ON TABLE badge_definitions IS 'Available badges students can earn';
COMMENT ON TABLE student_badges IS 'Badges earned by students';
COMMENT ON TABLE challenges IS 'Daily/weekly challenges for engagement';
COMMENT ON TABLE student_challenges IS 'Student progress on challenges';
COMMENT ON TABLE push_tokens IS 'Device tokens for push notifications';
COMMENT ON TABLE notification_preferences IS 'User notification settings';
COMMENT ON TABLE analytics_events IS 'Privacy-safe event tracking';
COMMENT ON TABLE analytics_aggregates IS 'Pre-aggregated metrics for dashboards';
