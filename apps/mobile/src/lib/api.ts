import { supabase } from './supabase';
import type {
  ChatRequest,
  ChatResponse,
  OCRRequest,
  OCRResponse,
  StudentContext,
} from '@k12buddy/shared';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1';

async function callFunction<T, B = unknown>(
  functionName: string,
  body: B
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API call failed');
  }

  return response.json();
}

// Chat API
export async function sendChatMessage(
  sessionId: string,
  message: string,
  context: StudentContext
): Promise<ChatResponse> {
  const request: ChatRequest = {
    session_id: sessionId,
    message,
    context,
  };

  return callFunction<ChatResponse>('ai_chat', request);
}

// OCR API
export async function processOCR(
  studentId: string,
  imagePath: string,
  textbookId?: string
): Promise<OCRResponse> {
  const request: OCRRequest = {
    student_id: studentId,
    image_path: imagePath,
    textbook_id: textbookId,
  };

  return callFunction<OCRResponse>('ai_ocr', request);
}

// Create or get chat session
export async function createChatSession(
  studentId: string,
  textbookId?: string,
  chapterId?: string
) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      student_id: studentId,
      textbook_id: textbookId,
      chapter_id: chapterId,
      response_style: 'explain',
      difficulty: 'average',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get chat history
export async function getChatHistory(sessionId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

// Gamification API Types
export interface GamificationStats {
  xp: {
    total: number;
    level: number;
    xp_to_next_level: number;
    level_title: string;
    level_icon: string;
  };
  streak: {
    current: number;
    longest: number;
    last_activity: string | null;
  };
  badges: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    earned_at: string;
  }>;
  challenges: Array<{
    id: string;
    title: string;
    description: string;
    type: 'daily' | 'weekly' | 'special';
    criteria: { action: string; count: number };
    xp_reward: number;
    progress: number;
    completed: boolean;
  }>;
  recent_xp: Array<{
    xp_amount: number;
    source: string;
    description: string;
    created_at: string;
  }>;
}

export interface AwardXPResult {
  success: boolean;
  xp_awarded: number;
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  leveled_up: boolean;
  new_level: number | null;
}

export interface StreakResult {
  success: boolean;
  current_streak: number;
  longest_streak: number;
  streak_continued: boolean;
  streak_bonus_awarded?: boolean;
  bonus_xp?: number;
}

export interface BadgeCheckResult {
  success: boolean;
  new_badges: Array<{ id: string; code: string; name: string; xp_reward: number }>;
  badges_earned: number;
}

// Get gamification stats
export async function getGamificationStats(studentId: string): Promise<GamificationStats> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${FUNCTIONS_URL}/gamification/stats?student_id=${studentId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get gamification stats');
  }

  return response.json();
}

// Award XP for an action
export async function awardXP(
  studentId: string,
  action: 'chat' | 'scan' | 'challenge' | 'streak_bonus' | 'badge',
  amount?: number,
  description?: string
): Promise<AwardXPResult> {
  return callFunction<AwardXPResult>('gamification/award-xp', {
    student_id: studentId,
    action,
    amount,
    description,
  });
}

// Update streak
export async function updateStreak(studentId: string): Promise<StreakResult> {
  return callFunction<StreakResult>('gamification/update-streak', {
    student_id: studentId,
  });
}

// Check and award badges
export async function checkBadges(studentId: string): Promise<BadgeCheckResult> {
  return callFunction<BadgeCheckResult>('gamification/check-badges', {
    student_id: studentId,
  });
}

// Upload image to storage
export async function uploadStudentImage(
  studentId: string,
  imageUri: string,
  uploadType: 'question' | 'assignment' | 'scan'
): Promise<string> {
  const filename = `${studentId}/${uploadType}/${Date.now()}.jpg`;

  // Convert URI to blob
  const response = await fetch(imageUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('student-uploads')
    .upload(filename, blob, {
      contentType: 'image/jpeg',
    });

  if (uploadError) throw uploadError;

  // Record upload in database
  const { error: dbError } = await supabase.from('student_uploads').insert({
    student_id: studentId,
    storage_path: filename,
    upload_type: uploadType,
  });

  if (dbError) throw dbError;

  return filename;
}
