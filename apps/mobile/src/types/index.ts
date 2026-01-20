/**
 * Local type definitions for K12Buddy Mobile App
 * These are duplicated from @k12buddy/shared to avoid monorepo import issues in production builds
 */

// Grade levels
export type Grade = 'K' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

// Subjects
export type Subject =
  | 'math'
  | 'science'
  | 'english'
  | 'history'
  | 'geography'
  | 'art'
  | 'music'
  | 'pe'
  | 'computer_science'
  | 'foreign_language'
  | 'other';

// Difficulty levels
export type Difficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

// Response styles
export type ResponseStyle = 'concise' | 'detailed' | 'step-by-step' | 'socratic';

// Student profile
export interface Student {
  id: string;
  user_id: string;
  owner_user_id: string;
  display_name: string;
  grade: Grade;
  state?: string;
  subjects?: Subject[];
  learning_style?: string;
  difficulty_preference?: Difficulty;
  xp_points: number;
  level: number;
  streak_days: number;
  total_questions: number;
  total_sessions: number;
  badges: string[];
  achievements: Record<string, unknown>;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// Chat message
export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    subject?: Subject;
    difficulty?: Difficulty;
    response_style?: ResponseStyle;
    tokens_used?: number;
    model?: string;
    image_url?: string;
  };
  created_at: string;
}

// Chat session
export interface ChatSession {
  id: string;
  student_id: string;
  subject?: Subject;
  title?: string;
  is_active: boolean;
  messages_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

// API Request/Response types
export interface StudentContext {
  student_id: string;
  grade: Grade;
  subject?: Subject;
  difficulty?: Difficulty;
  learning_style?: string;
}

export interface ChatRequest {
  session_id: string;
  message: string;
  student_context: StudentContext;
  response_style?: ResponseStyle;
  include_citations?: boolean;
  image_url?: string;
}

export interface ChatResponse {
  message: string;
  session_id: string;
  citations?: Array<{
    chunk_id: string;
    source: string;
    content: string;
    relevance_score: number;
  }>;
  tokens_used?: number;
  xp_earned?: number;
}

export interface OCRRequest {
  image_base64: string;
  student_id: string;
}

export interface OCRResponse {
  extracted_text: string;
  confidence: number;
  detected_subject?: Subject;
  detected_type?: string;
}
