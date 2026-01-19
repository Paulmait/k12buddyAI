import { z } from 'zod';

// ============================================
// Base Enums as Zod
// ============================================

export const GradeSchema = z.enum([
  'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
]);

export const SubjectSchema = z.enum([
  'math', 'english', 'science', 'social_studies', 'reading', 'writing'
]);

export const ResponseStyleSchema = z.enum([
  'explain', 'hint', 'practice', 'check_answer', 'review'
]);

export const DifficultySchema = z.enum([
  'struggling', 'average', 'advanced'
]);

export const AIProviderSchema = z.enum(['openai', 'anthropic']);

export const AIRunTypeSchema = z.enum(['chat', 'ocr', 'verify']);

export const AIRunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const UploadTypeSchema = z.enum(['cover', 'toc', 'page', 'question', 'assignment']);

export const IngestionStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

// ============================================
// Profile & Student Schemas
// ============================================

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  display_name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const StudentSchema = z.object({
  id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  grade: GradeSchema,
  state: z.string().length(2),
  county: z.string().max(100).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateStudentSchema = z.object({
  name: z.string().min(1).max(100),
  grade: GradeSchema,
  state: z.string().length(2),
  county: z.string().max(100).optional(),
});

// ============================================
// Textbook & Content Schemas
// ============================================

export const TextbookSchema = z.object({
  id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  publisher: z.string().max(200).optional(),
  isbn13: z.string().length(13).optional(),
  subject: SubjectSchema,
  grade_levels: z.array(GradeSchema),
  state: z.string().length(2),
  edition_year: z.number().int().min(1900).max(2100).optional(),
  cover_image_path: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const TextbookUnitSchema = z.object({
  id: z.string().uuid(),
  textbook_id: z.string().uuid(),
  unit_number: z.number().int().min(1),
  title: z.string().max(500),
  page_start: z.number().int().min(1).optional(),
  page_end: z.number().int().min(1).optional(),
  created_at: z.string().datetime(),
});

export const TextbookLessonSchema = z.object({
  id: z.string().uuid(),
  textbook_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  lesson_number: z.number().int().min(1),
  title: z.string().max(500),
  page_start: z.number().int().min(1),
  page_end: z.number().int().min(1),
  created_at: z.string().datetime(),
});

export const TextbookChunkSchema = z.object({
  id: z.string().uuid(),
  textbook_id: z.string().uuid(),
  lesson_id: z.string().uuid().optional(),
  page_number: z.number().int().min(1),
  chunk_index: z.number().int().min(0),
  content: z.string().min(1),
  content_hash: z.string(),
  token_estimate: z.number().int().optional(),
  embedding_id: z.string().optional(),
  created_at: z.string().datetime(),
});

// ============================================
// Ingestion Schemas
// ============================================

export const IngestionSchema = z.object({
  id: z.string().uuid(),
  textbook_id: z.string().uuid(),
  upload_type: UploadTypeSchema,
  storage_path: z.string(),
  status: IngestionStatusSchema,
  page_number: z.number().int().min(1).optional(),
  ocr_result: z.any().optional(),
  error_message: z.string().optional(),
  created_at: z.string().datetime(),
  processed_at: z.string().datetime().optional(),
});

// ============================================
// State Standards Schemas
// ============================================

export const StateStandardSchema = z.object({
  id: z.string().uuid(),
  state: z.string().length(2),
  subject: SubjectSchema,
  grade: GradeSchema,
  standard_code: z.string().max(50),
  description: z.string(),
  parent_standard_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});

// ============================================
// Chat Session Schemas
// ============================================

export const ChatSessionSchema = z.object({
  id: z.string().uuid(),
  student_id: z.string().uuid(),
  textbook_id: z.string().uuid().optional(),
  lesson_id: z.string().uuid().optional(),
  response_style: ResponseStyleSchema,
  difficulty: DifficultySchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  verified: z.boolean().default(false),
  created_at: z.string().datetime(),
});

export const MessageCitationSchema = z.object({
  id: z.string().uuid(),
  message_id: z.string().uuid(),
  chunk_id: z.string().uuid(),
  page_number: z.number().int().min(1),
  relevance_score: z.number().min(0).max(1),
  created_at: z.string().datetime(),
});

// ============================================
// AI Run Schemas
// ============================================

export const AIRunSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  student_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  run_type: AIRunTypeSchema,
  provider: AIProviderSchema,
  model: z.string(),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  latency_ms: z.number().int().min(0),
  status: AIRunStatusSchema,
  error: z.string().optional(),
  created_at: z.string().datetime(),
});

// ============================================
// Student Mastery Schemas
// ============================================

export const StudentMasterySchema = z.object({
  id: z.string().uuid(),
  student_id: z.string().uuid(),
  standard_id: z.string().uuid().optional(),
  lesson_id: z.string().uuid().optional(),
  mastery_level: z.number().min(0).max(100),
  last_practiced_at: z.string().datetime().optional(),
  practice_count: z.number().int().min(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ============================================
// API Request Schemas
// ============================================

export const StudentContextSchema = z.object({
  student_id: z.string().uuid(),
  grade: GradeSchema,
  state: z.string().length(2),
  county: z.string().optional(),
  subject: SubjectSchema,
  textbook_id: z.string().uuid().optional(),
  lesson_id: z.string().uuid().optional(),
  chapter: z.string().optional(),
  lesson: z.string().optional(),
  standards: z.array(z.string()).optional(),
  response_style: ResponseStyleSchema,
  difficulty: DifficultySchema,
});

export const ChatRequestSchema = z.object({
  session_id: z.string().uuid(),
  message: z.string().min(1).max(10000),
  context: StudentContextSchema,
  attached_image_path: z.string().optional(),
});

export const ChatResponseSchema = z.object({
  message: ChatMessageSchema,
  citations: z.array(MessageCitationSchema),
  check_for_understanding: z.string().optional(),
  verification: z.object({
    ok: z.boolean(),
    issues: z.array(z.string()).optional(),
  }).optional(),
});

export const OCRRequestSchema = z.object({
  student_id: z.string().uuid(),
  textbook_id: z.string().uuid().optional(),
  image_path: z.string(),
  doc_type: z.enum(['cover', 'toc', 'page']).optional(),
});

export const OCRResponseSchema = z.object({
  doc_type: z.enum(['cover', 'toc', 'page', 'unknown']),
  isbn13: z.string().nullable(),
  title: z.string().nullable(),
  publisher: z.string().nullable(),
  edition: z.string().nullable(),
  page_number: z.number().int().nullable(),
  raw_text: z.string(),
  layout: z.array(z.object({
    type: z.enum(['heading', 'paragraph', 'list', 'equation', 'figure', 'table']),
    content: z.string(),
    bbox: z.array(z.number()).optional(),
  })).optional(),
  confidence: z.number().min(0).max(1),
});

export const VerifyRequestSchema = z.object({
  message_id: z.string().uuid(),
  response_content: z.string(),
  context: StudentContextSchema,
  retrieved_chunks: z.array(z.object({
    chunk_id: z.string().uuid(),
    page_number: z.number().int(),
    content: z.string(),
  })),
});

export const VerifyResponseSchema = z.object({
  ok: z.boolean(),
  issues: z.array(z.string()),
  required_action: z.enum(['none', 'regenerate', 'ask_for_scan']).optional(),
  missing_info_request: z.string().optional(),
});

// ============================================
// Billing & Entitlements Schemas
// ============================================

export const PlanTierSchema = z.enum(['free', 'starter', 'pro', 'family']);

export const PlanLimitsSchema = z.object({
  ai_queries_per_day: z.number().int(),
  scans_per_month: z.number().int(),
  pages_ingested_per_month: z.number().int(),
  students_max: z.number().int().optional(),
});

export const PlanSchema = z.object({
  plan_id: z.string().uuid(),
  tier: PlanTierSchema,
  name: z.string(),
  is_family: z.boolean(),
  limits: PlanLimitsSchema,
  created_at: z.string().datetime(),
});

export const EntitlementSchema = z.object({
  user_id: z.string().uuid(),
  effective_tier: PlanTierSchema,
  expires_at: z.string().datetime().nullable(),
  source: z.enum(['storekit', 'admin', 'trial', 'free']),
  updated_at: z.string().datetime(),
});

export const UsageCounterSchema = z.object({
  usage_id: z.string().uuid(),
  user_id: z.string().uuid(),
  period_start: z.string(),
  period_end: z.string(),
  ai_queries: z.number().int(),
  scans: z.number().int(),
  pages_ingested: z.number().int(),
  updated_at: z.string().datetime(),
});

export const EntitlementCheckResponseSchema = z.object({
  tier: PlanTierSchema,
  limits: PlanLimitsSchema,
  usage: z.object({
    ai_queries_today: z.number().int(),
    ai_queries_remaining: z.number().int(),
    scans_this_month: z.number().int(),
    scans_remaining: z.number().int(),
    pages_this_month: z.number().int(),
    pages_remaining: z.number().int(),
  }),
  expires_at: z.string().datetime().nullable(),
});

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type Grade = z.infer<typeof GradeSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type ResponseStyle = z.infer<typeof ResponseStyleSchema>;
export type Difficulty = z.infer<typeof DifficultySchema>;
export type AIProvider = z.infer<typeof AIProviderSchema>;
export type AIRunType = z.infer<typeof AIRunTypeSchema>;
export type AIRunStatus = z.infer<typeof AIRunStatusSchema>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type UploadType = z.infer<typeof UploadTypeSchema>;
export type IngestionStatus = z.infer<typeof IngestionStatusSchema>;
export type PlanTier = z.infer<typeof PlanTierSchema>;

export type Profile = z.infer<typeof ProfileSchema>;
export type Student = z.infer<typeof StudentSchema>;
export type CreateStudent = z.infer<typeof CreateStudentSchema>;
export type Textbook = z.infer<typeof TextbookSchema>;
export type TextbookUnit = z.infer<typeof TextbookUnitSchema>;
export type TextbookLesson = z.infer<typeof TextbookLessonSchema>;
export type TextbookChunk = z.infer<typeof TextbookChunkSchema>;
export type Ingestion = z.infer<typeof IngestionSchema>;
export type StateStandard = z.infer<typeof StateStandardSchema>;
export type ChatSession = z.infer<typeof ChatSessionSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type MessageCitation = z.infer<typeof MessageCitationSchema>;
export type AIRun = z.infer<typeof AIRunSchema>;
export type StudentMastery = z.infer<typeof StudentMasterySchema>;

export type StudentContext = z.infer<typeof StudentContextSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type OCRRequest = z.infer<typeof OCRRequestSchema>;
export type OCRResponse = z.infer<typeof OCRResponseSchema>;
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;

export type Plan = z.infer<typeof PlanSchema>;
export type PlanLimits = z.infer<typeof PlanLimitsSchema>;
export type Entitlement = z.infer<typeof EntitlementSchema>;
export type UsageCounter = z.infer<typeof UsageCounterSchema>;
export type EntitlementCheckResponse = z.infer<typeof EntitlementCheckResponseSchema>;
