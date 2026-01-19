-- ============================================
-- K-12Buddy Enhanced Schema
-- Migration: 20240119000003_enhanced_schema
-- Adds: profiles, student_textbooks, ingestions, TOC, mastery, billing
-- ============================================

-- ============================================
-- New ENUM Types
-- ============================================

CREATE TYPE ingestion_status AS ENUM (
  'pending', 'processing', 'completed', 'failed'
);

CREATE TYPE plan_tier AS ENUM (
  'free', 'starter', 'pro', 'family'
);

CREATE TYPE subscription_status AS ENUM (
  'active', 'grace', 'expired', 'revoked', 'canceled'
);

CREATE TYPE billing_event_type AS ENUM (
  'purchase', 'renewal', 'cancel', 'restore', 'verify_fail', 'upgrade', 'downgrade'
);

-- ============================================
-- Profiles Table (extends auth.users)
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  display_name VARCHAR(100),
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Update Students Table
-- ============================================

-- Add owner_user_id and name columns to students
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Migrate existing user_id to owner_user_id if needed
UPDATE students SET owner_user_id = user_id WHERE owner_user_id IS NULL;

-- Make owner_user_id required
ALTER TABLE students
  ALTER COLUMN owner_user_id SET NOT NULL;

-- ============================================
-- Update Textbooks Table
-- ============================================

ALTER TABLE textbooks
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS isbn13 VARCHAR(13),
  ADD COLUMN IF NOT EXISTS cover_image_path VARCHAR(500);

-- ============================================
-- Student-Textbook Relationship
-- ============================================

CREATE TABLE IF NOT EXISTS student_textbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(student_id, textbook_id)
);

-- ============================================
-- Ingestion Pipeline Tables
-- ============================================

CREATE TABLE IF NOT EXISTS ingestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  upload_type upload_type NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  status ingestion_status DEFAULT 'pending' NOT NULL,
  page_number INTEGER,
  ocr_result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ
);

-- ============================================
-- Table of Contents: Units & Lessons
-- ============================================

CREATE TABLE IF NOT EXISTS textbook_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  unit_number INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(textbook_id, unit_number)
);

CREATE TABLE IF NOT EXISTS textbook_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID REFERENCES textbook_units(id) ON DELETE SET NULL,
  lesson_number INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(textbook_id, lesson_number)
);

-- ============================================
-- Update Textbook Chunks for Lessons
-- ============================================

ALTER TABLE textbook_chunks
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES textbook_lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS token_estimate INTEGER;

-- Add index for lesson-based retrieval
CREATE INDEX IF NOT EXISTS idx_textbook_chunks_lesson ON textbook_chunks(lesson_id);

-- ============================================
-- Lesson-Standard Mapping
-- ============================================

CREATE TABLE IF NOT EXISTS lesson_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES textbook_lessons(id) ON DELETE CASCADE NOT NULL,
  standard_id UUID REFERENCES state_standards(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(lesson_id, standard_id)
);

-- ============================================
-- Student Mastery Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS student_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  standard_id UUID REFERENCES state_standards(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES textbook_lessons(id) ON DELETE SET NULL,
  mastery_level NUMERIC(5,2) DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  last_practiced_at TIMESTAMPTZ,
  practice_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(student_id, standard_id),
  UNIQUE(student_id, lesson_id)
);

-- ============================================
-- Update Chat Session for Lessons
-- ============================================

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES textbook_lessons(id) ON DELETE SET NULL;

-- ============================================
-- Update Chat Messages for Verification
-- ============================================

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- ============================================
-- Update AI Runs for User Tracking
-- ============================================

ALTER TABLE ai_runs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- Billing & Entitlements Tables
-- ============================================

CREATE TABLE IF NOT EXISTS plans (
  plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier plan_tier UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  is_family BOOLEAN DEFAULT FALSE,
  limits JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default plans
INSERT INTO plans (tier, name, is_family, limits) VALUES
  ('free', 'Free', FALSE, '{"ai_queries_per_day": 3, "scans_per_month": 2, "pages_ingested_per_month": 10}'),
  ('starter', 'Starter', FALSE, '{"ai_queries_per_day": 50, "scans_per_month": 25, "pages_ingested_per_month": 250}'),
  ('pro', 'Pro', FALSE, '{"ai_queries_per_day": 200, "scans_per_month": 100, "pages_ingested_per_month": 1000}'),
  ('family', 'Family', TRUE, '{"ai_queries_per_day": 200, "scans_per_month": 100, "pages_ingested_per_month": 1000, "students_max": 4}')
ON CONFLICT (tier) DO NOTHING;

CREATE TABLE IF NOT EXISTS products (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(10) NOT NULL, -- 'ios', 'android', 'web'
  store_product_id VARCHAR(100) UNIQUE NOT NULL,
  plan_tier plan_tier REFERENCES plans(tier) NOT NULL,
  period VARCHAR(20) NOT NULL, -- 'monthly', 'annual'
  price_cents INTEGER NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform VARCHAR(10) NOT NULL,
  store_original_transaction_id VARCHAR(200),
  status subscription_status DEFAULT 'active' NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  product_store_id VARCHAR(100),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  effective_tier plan_tier DEFAULT 'free' NOT NULL,
  expires_at TIMESTAMPTZ,
  source VARCHAR(20) DEFAULT 'free' NOT NULL, -- 'storekit', 'admin', 'trial', 'free'
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_counters (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  ai_queries INTEGER DEFAULT 0,
  scans INTEGER DEFAULT 0,
  pages_ingested INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS billing_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type billing_event_type NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- New Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_students_owner ON students(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_textbooks_owner ON textbooks(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ingestions_textbook ON ingestions(textbook_id);
CREATE INDEX IF NOT EXISTS idx_ingestions_status ON ingestions(status);
CREATE INDEX IF NOT EXISTS idx_textbook_units_textbook ON textbook_units(textbook_id);
CREATE INDEX IF NOT EXISTS idx_textbook_lessons_textbook ON textbook_lessons(textbook_id);
CREATE INDEX IF NOT EXISTS idx_textbook_lessons_unit ON textbook_lessons(unit_id);
CREATE INDEX IF NOT EXISTS idx_student_mastery_student ON student_mastery(student_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_counters_user_period ON usage_counters(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_billing_events_user ON billing_events(user_id);

-- ============================================
-- Updated At Triggers for New Tables
-- ============================================

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER student_mastery_updated_at
  BEFORE UPDATE ON student_mastery
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER entitlements_updated_at
  BEFORE UPDATE ON entitlements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER usage_counters_updated_at
  BEFORE UPDATE ON usage_counters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS Policies for New Tables
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_textbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbook_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbook_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see/edit their own
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Student Textbooks: Users can manage for their students
CREATE POLICY student_textbooks_select ON student_textbooks
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE owner_user_id = auth.uid())
  );

CREATE POLICY student_textbooks_insert ON student_textbooks
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE owner_user_id = auth.uid())
  );

CREATE POLICY student_textbooks_delete ON student_textbooks
  FOR DELETE USING (
    student_id IN (SELECT id FROM students WHERE owner_user_id = auth.uid())
  );

-- Ingestions: Users can view for their textbooks
CREATE POLICY ingestions_select ON ingestions
  FOR SELECT USING (
    textbook_id IN (SELECT id FROM textbooks WHERE owner_user_id = auth.uid())
  );

-- TOC: Public read for authenticated users
CREATE POLICY textbook_units_select ON textbook_units
  FOR SELECT USING (true);

CREATE POLICY textbook_lessons_select ON textbook_lessons
  FOR SELECT USING (true);

CREATE POLICY lesson_standards_select ON lesson_standards
  FOR SELECT USING (true);

-- Student Mastery: Users can view/manage their students' mastery
CREATE POLICY student_mastery_select ON student_mastery
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE owner_user_id = auth.uid())
  );

-- Plans & Products: Public read
CREATE POLICY plans_select ON plans
  FOR SELECT USING (true);

CREATE POLICY products_select ON products
  FOR SELECT USING (true);

-- Subscriptions: Users can view their own
CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Entitlements: Users can view their own
CREATE POLICY entitlements_select ON entitlements
  FOR SELECT USING (auth.uid() = user_id);

-- Usage: Users can view their own
CREATE POLICY usage_counters_select ON usage_counters
  FOR SELECT USING (auth.uid() = user_id);

-- Billing Events: Users can view their own
CREATE POLICY billing_events_select ON billing_events
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- Update Students RLS for owner_user_id
-- ============================================

DROP POLICY IF EXISTS students_select ON students;
DROP POLICY IF EXISTS students_insert ON students;
DROP POLICY IF EXISTS students_update ON students;

CREATE POLICY students_select ON students
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY students_insert ON students
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY students_update ON students
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY students_delete ON students
  FOR DELETE USING (auth.uid() = owner_user_id);

-- ============================================
-- Helper Functions
-- ============================================

-- Get effective plan for a user
CREATE OR REPLACE FUNCTION get_effective_plan(p_user_id UUID)
RETURNS TABLE (
  tier plan_tier,
  limits JSONB,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(e.effective_tier, 'free'::plan_tier) as tier,
    p.limits,
    e.expires_at
  FROM entitlements e
  LEFT JOIN plans p ON p.tier = e.effective_tier
  WHERE e.user_id = p_user_id;

  -- If no entitlement exists, return free tier
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 'free'::plan_tier, p.limits, NULL::TIMESTAMPTZ
    FROM plans p WHERE p.tier = 'free';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create current usage period
CREATE OR REPLACE FUNCTION get_current_usage(p_user_id UUID)
RETURNS usage_counters AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_usage usage_counters;
BEGIN
  -- Monthly period
  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
  v_period_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Get or create usage record
  INSERT INTO usage_counters (user_id, period_start, period_end)
  VALUES (p_user_id, v_period_start, v_period_end)
  ON CONFLICT (user_id, period_start, period_end) DO NOTHING;

  SELECT * INTO v_usage
  FROM usage_counters
  WHERE user_id = p_user_id
    AND period_start = v_period_start
    AND period_end = v_period_end;

  RETURN v_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment usage counters
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_ai_queries INTEGER DEFAULT 0,
  p_scans INTEGER DEFAULT 0,
  p_pages INTEGER DEFAULT 0
)
RETURNS usage_counters AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_usage usage_counters;
BEGIN
  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
  v_period_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  INSERT INTO usage_counters (user_id, period_start, period_end, ai_queries, scans, pages_ingested)
  VALUES (p_user_id, v_period_start, v_period_end, p_ai_queries, p_scans, p_pages)
  ON CONFLICT (user_id, period_start, period_end)
  DO UPDATE SET
    ai_queries = usage_counters.ai_queries + p_ai_queries,
    scans = usage_counters.scans + p_scans,
    pages_ingested = usage_counters.pages_ingested + p_pages,
    updated_at = NOW()
  RETURNING * INTO v_usage;

  RETURN v_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE profiles IS 'User profiles extending auth.users';
COMMENT ON TABLE student_textbooks IS 'Many-to-many relationship between students and textbooks';
COMMENT ON TABLE ingestions IS 'Tracks OCR processing of uploaded images';
COMMENT ON TABLE textbook_units IS 'Table of Contents - Units/Chapters';
COMMENT ON TABLE textbook_lessons IS 'Table of Contents - Lessons within units';
COMMENT ON TABLE lesson_standards IS 'Mapping of lessons to state standards';
COMMENT ON TABLE student_mastery IS 'Tracks student progress per standard/lesson';
COMMENT ON TABLE plans IS 'Subscription plan definitions';
COMMENT ON TABLE products IS 'App store products linked to plans';
COMMENT ON TABLE subscriptions IS 'User subscription records';
COMMENT ON TABLE entitlements IS 'Effective entitlements per user';
COMMENT ON TABLE usage_counters IS 'Usage tracking per billing period';
COMMENT ON TABLE billing_events IS 'Audit log of billing events';
