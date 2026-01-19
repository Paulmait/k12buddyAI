-- ============================================
-- K-12Buddy Core Schema
-- Migration: 20240119000001_k12buddy_core
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUM Types
-- ============================================

CREATE TYPE grade_level AS ENUM (
  'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
);

CREATE TYPE subject_type AS ENUM (
  'math', 'english', 'science', 'social_studies', 'reading', 'writing'
);

CREATE TYPE response_style AS ENUM (
  'explain', 'hint', 'practice', 'review'
);

CREATE TYPE difficulty_level AS ENUM (
  'struggling', 'average', 'advanced'
);

CREATE TYPE ai_provider AS ENUM (
  'openai', 'anthropic'
);

CREATE TYPE ai_run_type AS ENUM (
  'chat', 'ocr', 'verify'
);

CREATE TYPE ai_run_status AS ENUM (
  'pending', 'running', 'completed', 'failed'
);

CREATE TYPE message_role AS ENUM (
  'user', 'assistant', 'system'
);

CREATE TYPE upload_type AS ENUM (
  'question', 'assignment', 'scan'
);

-- ============================================
-- Core Tables
-- ============================================

-- Students table (linked to auth.users)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  grade grade_level NOT NULL,
  state VARCHAR(2) NOT NULL,
  county VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Textbooks table
CREATE TABLE textbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  publisher VARCHAR(200),
  subject subject_type NOT NULL,
  grade_levels grade_level[] NOT NULL,
  state VARCHAR(2) NOT NULL,
  edition_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Textbook chapters
CREATE TABLE textbook_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  chapter_number INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(textbook_id, chapter_number)
);

-- Textbook chunks (for retrieval)
CREATE TABLE textbook_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES textbook_chapters(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding_id VARCHAR(100), -- External vector store reference
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(chapter_id, chunk_index)
);

-- State standards
CREATE TABLE state_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state VARCHAR(2) NOT NULL,
  subject subject_type NOT NULL,
  grade grade_level NOT NULL,
  standard_code VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  parent_standard_id UUID REFERENCES state_standards(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(state, standard_code)
);

-- Standard to textbook mapping
CREATE TABLE textbook_standard_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES textbook_chapters(id) ON DELETE CASCADE NOT NULL,
  standard_id UUID REFERENCES state_standards(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(chapter_id, standard_id)
);

-- ============================================
-- Chat & Session Tables
-- ============================================

-- Chat sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  textbook_id UUID REFERENCES textbooks(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES textbook_chapters(id) ON DELETE SET NULL,
  response_style response_style DEFAULT 'explain' NOT NULL,
  difficulty difficulty_level DEFAULT 'average' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role message_role NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Message citations
CREATE TABLE message_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE NOT NULL,
  chunk_id UUID REFERENCES textbook_chunks(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  relevance_score FLOAT DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- AI Audit Tables
-- ============================================

-- AI runs (audit log)
CREATE TABLE ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  run_type ai_run_type NOT NULL,
  provider ai_provider NOT NULL,
  model VARCHAR(100) NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  status ai_run_status DEFAULT 'pending' NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- Storage Reference Tables
-- ============================================

-- Textbook images
CREATE TABLE textbook_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  ocr_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(textbook_id, page_number)
);

-- Student uploads
CREATE TABLE student_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  upload_type upload_type NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_state_grade ON students(state, grade);

CREATE INDEX idx_textbooks_subject ON textbooks(subject);
CREATE INDEX idx_textbooks_state ON textbooks(state);

CREATE INDEX idx_textbook_chunks_textbook ON textbook_chunks(textbook_id);
CREATE INDEX idx_textbook_chunks_chapter ON textbook_chunks(chapter_id);
CREATE INDEX idx_textbook_chunks_page ON textbook_chunks(page_number);

CREATE INDEX idx_state_standards_lookup ON state_standards(state, subject, grade);

CREATE INDEX idx_chat_sessions_student ON chat_sessions(student_id);
CREATE INDEX idx_chat_sessions_textbook ON chat_sessions(textbook_id);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

CREATE INDEX idx_ai_runs_student ON ai_runs(student_id);
CREATE INDEX idx_ai_runs_session ON ai_runs(session_id);
CREATE INDEX idx_ai_runs_type ON ai_runs(run_type);
CREATE INDEX idx_ai_runs_created ON ai_runs(created_at);

CREATE INDEX idx_student_uploads_student ON student_uploads(student_id);

-- ============================================
-- Updated At Triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER textbooks_updated_at
  BEFORE UPDATE ON textbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbook_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbook_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbook_standard_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbook_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_uploads ENABLE ROW LEVEL SECURITY;

-- Students: Users can only access their own student record
CREATE POLICY students_select ON students
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY students_insert ON students
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY students_update ON students
  FOR UPDATE USING (auth.uid() = user_id);

-- Textbooks: Public read access (no PII)
CREATE POLICY textbooks_select ON textbooks
  FOR SELECT USING (true);

CREATE POLICY textbook_chapters_select ON textbook_chapters
  FOR SELECT USING (true);

CREATE POLICY textbook_chunks_select ON textbook_chunks
  FOR SELECT USING (true);

CREATE POLICY state_standards_select ON state_standards
  FOR SELECT USING (true);

CREATE POLICY textbook_standard_mappings_select ON textbook_standard_mappings
  FOR SELECT USING (true);

CREATE POLICY textbook_images_select ON textbook_images
  FOR SELECT USING (true);

-- Chat sessions: Users can only access their own sessions
CREATE POLICY chat_sessions_select ON chat_sessions
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY chat_sessions_insert ON chat_sessions
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY chat_sessions_update ON chat_sessions
  FOR UPDATE USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Chat messages: Users can access messages in their sessions
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (
    session_id IN (
      SELECT cs.id FROM chat_sessions cs
      JOIN students s ON cs.student_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT cs.id FROM chat_sessions cs
      JOIN students s ON cs.student_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

-- Message citations: Same as chat messages
CREATE POLICY message_citations_select ON message_citations
  FOR SELECT USING (
    message_id IN (
      SELECT cm.id FROM chat_messages cm
      JOIN chat_sessions cs ON cm.session_id = cs.id
      JOIN students s ON cs.student_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

-- AI runs: Users can view their own AI runs
CREATE POLICY ai_runs_select ON ai_runs
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Student uploads: Users can only access their own uploads
CREATE POLICY student_uploads_select ON student_uploads
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY student_uploads_insert ON student_uploads
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- ============================================
-- Service Role Policies (for Edge Functions)
-- ============================================

-- These allow service role to bypass RLS for administrative operations
-- The service role automatically bypasses RLS, but we add explicit policies for clarity

COMMENT ON TABLE students IS 'Student profiles linked to auth.users';
COMMENT ON TABLE textbooks IS 'Curriculum textbooks by state and subject';
COMMENT ON TABLE textbook_chunks IS 'Chunked textbook content for retrieval';
COMMENT ON TABLE chat_sessions IS 'Student chat sessions with AI tutor';
COMMENT ON TABLE chat_messages IS 'Individual messages within chat sessions';
COMMENT ON TABLE ai_runs IS 'Audit log of all AI API calls';
