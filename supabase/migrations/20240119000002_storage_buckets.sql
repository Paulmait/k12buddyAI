-- ============================================
-- K-12Buddy Storage Buckets
-- Migration: 20240119000002_storage_buckets
-- ============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'textbook-images',
    'textbook-images',
    false,
    52428800, -- 50MB
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
  ),
  (
    'student-uploads',
    'student-uploads',
    false,
    10485760, -- 10MB
    ARRAY['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'extracted-artifacts',
    'extracted-artifacts',
    false,
    5242880, -- 5MB
    ARRAY['application/json', 'text/plain']
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Storage Policies
-- ============================================

-- Textbook images: Only service role can upload, authenticated users can read
CREATE POLICY textbook_images_read ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'textbook-images'
    AND auth.role() = 'authenticated'
  );

-- Student uploads: Students can upload to their own path (student_id/*)
CREATE POLICY student_uploads_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'student-uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY student_uploads_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'student-uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY student_uploads_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'student-uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM students WHERE user_id = auth.uid()
    )
  );

-- Extracted artifacts: Only service role access (used by edge functions)
-- No user-facing policies needed; service role bypasses RLS
