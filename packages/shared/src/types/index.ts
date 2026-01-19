// ============================================
// K-12Buddy Core Types
// ============================================

// Student & Context Types
export interface Student {
  id: string;
  grade: Grade;
  state: string;
  county: string;
  created_at: string;
  updated_at: string;
}

export type Grade = 'K' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

export type Subject =
  | 'math'
  | 'english'
  | 'science'
  | 'social_studies'
  | 'reading'
  | 'writing';

export type ResponseStyle = 'explain' | 'hint' | 'practice' | 'review';
export type Difficulty = 'struggling' | 'average' | 'advanced';

export interface StudentContext {
  student_id: string;
  grade: Grade;
  state: string;
  county: string;
  subject: Subject;
  textbook_id?: string;
  chapter?: string;
  lesson?: string;
  standards?: string[];
  response_style: ResponseStyle;
  difficulty: Difficulty;
}

// Curriculum & Textbook Types
export interface Textbook {
  id: string;
  title: string;
  publisher: string;
  subject: Subject;
  grade_levels: Grade[];
  state: string;
  edition_year: number;
  created_at: string;
}

export interface TextbookChapter {
  id: string;
  textbook_id: string;
  chapter_number: number;
  title: string;
  page_start: number;
  page_end: number;
}

export interface TextbookChunk {
  id: string;
  textbook_id: string;
  chapter_id: string;
  page_number: number;
  content: string;
  embedding_id?: string;
  chunk_index: number;
}

export interface StateStandard {
  id: string;
  state: string;
  subject: Subject;
  grade: Grade;
  standard_code: string;
  description: string;
  parent_standard_id?: string;
}

// Chat & AI Types
export interface ChatSession {
  id: string;
  student_id: string;
  textbook_id: string;
  chapter_id?: string;
  response_style: ResponseStyle;
  difficulty: Difficulty;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface MessageCitation {
  id: string;
  message_id: string;
  chunk_id: string;
  page_number: number;
  relevance_score: number;
}

// AI Run Types
export type AIProvider = 'openai' | 'anthropic';
export type AIRunType = 'chat' | 'ocr' | 'verify';
export type AIRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AIRun {
  id: string;
  student_id: string;
  session_id?: string;
  run_type: AIRunType;
  provider: AIProvider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  status: AIRunStatus;
  error?: string;
  created_at: string;
}

// API Request/Response Types
export interface ChatRequest {
  session_id: string;
  message: string;
  context: StudentContext;
}

export interface ChatResponse {
  message: ChatMessage;
  citations: MessageCitation[];
  check_for_understanding?: string;
}

export interface OCRRequest {
  student_id: string;
  image_path: string;
  textbook_id?: string;
}

export interface OCRResponse {
  extracted_text: string;
  detected_page?: number;
  confidence: number;
}

export interface VerifyRequest {
  message_id: string;
  response_content: string;
  context: StudentContext;
}

export interface VerifyResponse {
  is_valid: boolean;
  issues?: string[];
  corrected_content?: string;
}

// Storage Types
export interface TextbookImage {
  id: string;
  textbook_id: string;
  page_number: number;
  storage_path: string;
  ocr_processed: boolean;
  created_at: string;
}

export interface StudentUpload {
  id: string;
  student_id: string;
  storage_path: string;
  upload_type: 'question' | 'assignment' | 'scan';
  processed: boolean;
  created_at: string;
}
