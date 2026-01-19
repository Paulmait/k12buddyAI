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
