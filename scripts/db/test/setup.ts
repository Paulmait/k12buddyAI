// ============================================
// Integration Test Setup
// ============================================

import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, afterAll, beforeEach } from 'vitest';

// Load environment variables
config({ path: '../../.env.test' });
config({ path: '../../.env.local' });
config();

// Verify required env vars
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL environment variable');
  console.error('Make sure local Supabase is running: pnpm supabase:start');
  process.exit(1);
}

// Export clients
export let serviceClient: SupabaseClient;
export let anonClient: SupabaseClient;

// Test user for auth tests
export const TEST_USER = {
  email: 'test-integration@k12buddy.test',
  password: 'test-password-12345',
};

// Track created resources for cleanup
const createdResources: {
  users: string[];
  students: string[];
  textbooks: string[];
  sessions: string[];
} = {
  users: [],
  students: [],
  textbooks: [],
  sessions: [],
};

beforeAll(async () => {
  console.log('🔧 Setting up integration test environment...');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);

  // Create service client (bypasses RLS)
  if (SUPABASE_SERVICE_ROLE_KEY) {
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('  ✓ Service client created');
  } else {
    console.warn('  ⚠ No service role key - some tests may fail');
  }

  // Create anon client (respects RLS)
  if (SUPABASE_ANON_KEY) {
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('  ✓ Anon client created');
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up test resources...');

  if (serviceClient) {
    // Clean up in reverse order (due to foreign keys)
    for (const sessionId of createdResources.sessions) {
      await serviceClient.from('chat_messages').delete().eq('session_id', sessionId);
      await serviceClient.from('chat_sessions').delete().eq('id', sessionId);
    }

    for (const textbookId of createdResources.textbooks) {
      await serviceClient.from('textbook_chunks').delete().eq('textbook_id', textbookId);
      await serviceClient.from('textbook_lessons').delete().eq('textbook_id', textbookId);
      await serviceClient.from('textbook_units').delete().eq('textbook_id', textbookId);
      await serviceClient.from('ingestions').delete().eq('textbook_id', textbookId);
      await serviceClient.from('student_textbooks').delete().eq('textbook_id', textbookId);
      await serviceClient.from('textbooks').delete().eq('id', textbookId);
    }

    for (const studentId of createdResources.students) {
      await serviceClient.from('student_mastery').delete().eq('student_id', studentId);
      await serviceClient.from('students').delete().eq('id', studentId);
    }

    for (const userId of createdResources.users) {
      await serviceClient.from('entitlements').delete().eq('user_id', userId);
      await serviceClient.from('usage_counters').delete().eq('user_id', userId);
      await serviceClient.from('profiles').delete().eq('id', userId);
      // Note: Can't delete auth.users via client - would need admin API
    }
  }

  console.log('  ✓ Cleanup complete');
});

// Reset tracking before each test
beforeEach(() => {
  // Don't reset - we'll accumulate and clean at the end
});

/**
 * Track a created resource for cleanup
 */
export function trackResource(type: keyof typeof createdResources, id: string) {
  createdResources[type].push(id);
}

/**
 * Create a test user and return their ID
 */
export async function createTestUser(email?: string): Promise<string> {
  if (!serviceClient) {
    throw new Error('Service client not available - check SUPABASE_SERVICE_ROLE_KEY');
  }

  const testEmail = email || `test-${Date.now()}@k12buddy.test`;

  // Try to create user via auth admin API
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email: testEmail,
    password: TEST_USER.password,
    email_confirm: true,
  });

  if (authError) {
    // If user already exists, try to get their ID
    if (authError.message.includes('already')) {
      const { data: listData } = await serviceClient.auth.admin.listUsers();
      const existingUser = listData?.users?.find((u) => u.email === testEmail);
      if (existingUser) {
        trackResource('users', existingUser.id);
        return existingUser.id;
      }
    }
    throw new Error(`Failed to create test user: ${authError.message}`);
  }

  const userId = authData.user.id;
  trackResource('users', userId);

  // Create profile
  await serviceClient.from('profiles').upsert({
    id: userId,
    email: testEmail,
    display_name: 'Test User',
  });

  // Create free tier entitlement
  await serviceClient.from('entitlements').upsert({
    user_id: userId,
    effective_tier: 'free',
    source: 'trial',
  });

  return userId;
}

/**
 * Create a test student for a user
 */
export async function createTestStudent(
  ownerUserId: string,
  overrides?: {
    name?: string;
    grade?: string;
    state?: string;
  }
): Promise<string> {
  if (!serviceClient) {
    throw new Error('Service client not available');
  }

  const studentId = crypto.randomUUID();

  const { error } = await serviceClient.from('students').insert({
    id: studentId,
    owner_user_id: ownerUserId,
    name: overrides?.name || 'Test Student',
    grade: overrides?.grade || '5',
    state: overrides?.state || 'CA',
  });

  if (error) {
    throw new Error(`Failed to create test student: ${error.message}`);
  }

  trackResource('students', studentId);
  return studentId;
}

/**
 * Create a test textbook
 */
export async function createTestTextbook(
  ownerUserId: string,
  overrides?: {
    title?: string;
    subject?: string;
    grade_levels?: string[];
  }
): Promise<string> {
  if (!serviceClient) {
    throw new Error('Service client not available');
  }

  const textbookId = crypto.randomUUID();

  const { error } = await serviceClient.from('textbooks').insert({
    id: textbookId,
    owner_user_id: ownerUserId,
    title: overrides?.title || 'Test Math Book',
    subject: overrides?.subject || 'math',
    grade_levels: overrides?.grade_levels || ['5'],
    state: 'CA',
  });

  if (error) {
    throw new Error(`Failed to create test textbook: ${error.message}`);
  }

  trackResource('textbooks', textbookId);
  return textbookId;
}

/**
 * Create test textbook chunks
 */
export async function createTestChunks(
  textbookId: string,
  chunks: Array<{
    page_number: number;
    content: string;
    lesson_id?: string;
  }>
): Promise<string[]> {
  if (!serviceClient) {
    throw new Error('Service client not available');
  }

  const chunkIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;

    const chunkId = crypto.randomUUID();

    const { error } = await serviceClient.from('textbook_chunks').insert({
      id: chunkId,
      textbook_id: textbookId,
      lesson_id: chunk.lesson_id || null,
      page_number: chunk.page_number,
      chunk_index: i,
      content: chunk.content,
      content_hash: chunkId.slice(0, 8), // Simple hash for testing
      token_estimate: Math.ceil(chunk.content.split(' ').length * 1.3),
    });

    if (error) {
      throw new Error(`Failed to create test chunk: ${error.message}`);
    }

    chunkIds.push(chunkId);
  }

  return chunkIds;
}

/**
 * Create a test chat session
 */
export async function createTestSession(
  studentId: string,
  textbookId: string
): Promise<string> {
  if (!serviceClient) {
    throw new Error('Service client not available');
  }

  const sessionId = crypto.randomUUID();

  const { error } = await serviceClient.from('chat_sessions').insert({
    id: sessionId,
    student_id: studentId,
    textbook_id: textbookId,
    response_style: 'explain',
    difficulty: 'average',
  });

  if (error) {
    throw new Error(`Failed to create test session: ${error.message}`);
  }

  trackResource('sessions', sessionId);
  return sessionId;
}
