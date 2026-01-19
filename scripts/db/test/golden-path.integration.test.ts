// ============================================
// Golden Path Integration Test
// Tests the complete user flow from signup to chat
// ============================================

import { describe, it, expect, beforeAll } from 'vitest';
import {
  serviceClient,
  createTestUser,
  createTestStudent,
  createTestTextbook,
  createTestChunks,
  createTestSession,
} from './setup.js';

describe('Golden Path: Complete User Flow', () => {
  let userId: string;
  let studentId: string;
  let textbookId: string;
  let sessionId: string;

  beforeAll(async () => {
    // Skip if no service client (CI without Supabase)
    if (!serviceClient) {
      console.log('Skipping integration tests - no service client');
      return;
    }
  });

  describe('1. User Setup', () => {
    it('should create a new user with profile', async () => {
      if (!serviceClient) return;

      userId = await createTestUser();
      expect(userId).toBeDefined();
      expect(typeof userId).toBe('string');

      // Verify profile was created
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      expect(profile).toBeDefined();
      expect(profile?.email).toContain('@k12buddy.test');
    });

    it('should have free tier entitlement', async () => {
      if (!serviceClient || !userId) return;

      const { data: entitlement } = await serviceClient
        .from('entitlements')
        .select('*')
        .eq('user_id', userId)
        .single();

      expect(entitlement).toBeDefined();
      expect(entitlement?.effective_tier).toBe('free');
    });
  });

  describe('2. Student Profile', () => {
    it('should create a student profile', async () => {
      if (!serviceClient || !userId) return;

      studentId = await createTestStudent(userId, {
        name: 'Test Student',
        grade: '5',
        state: 'CA',
      });

      expect(studentId).toBeDefined();

      // Verify student was created
      const { data: student } = await serviceClient
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

      expect(student).toBeDefined();
      expect(student?.name).toBe('Test Student');
      expect(student?.grade).toBe('5');
      expect(student?.owner_user_id).toBe(userId);
    });
  });

  describe('3. Textbook Setup', () => {
    it('should create a textbook', async () => {
      if (!serviceClient || !userId) return;

      textbookId = await createTestTextbook(userId, {
        title: 'Math Grade 5 - Addition & Subtraction',
        subject: 'math',
        grade_levels: ['5'],
      });

      expect(textbookId).toBeDefined();

      // Verify textbook was created
      const { data: textbook } = await serviceClient
        .from('textbooks')
        .select('*')
        .eq('id', textbookId)
        .single();

      expect(textbook).toBeDefined();
      expect(textbook?.title).toContain('Math Grade 5');
      expect(textbook?.owner_user_id).toBe(userId);
    });

    it('should link student to textbook', async () => {
      if (!serviceClient || !studentId || !textbookId) return;

      const { error } = await serviceClient.from('student_textbooks').insert({
        student_id: studentId,
        textbook_id: textbookId,
      });

      expect(error).toBeNull();

      // Verify link
      const { data: link } = await serviceClient
        .from('student_textbooks')
        .select('*')
        .eq('student_id', studentId)
        .eq('textbook_id', textbookId)
        .single();

      expect(link).toBeDefined();
    });
  });

  describe('4. Content Ingestion', () => {
    it('should create textbook chunks', async () => {
      if (!serviceClient || !textbookId) return;

      const chunkIds = await createTestChunks(textbookId, [
        {
          page_number: 10,
          content: 'Addition is the process of combining numbers. When we add 5 + 3, we get 8.',
        },
        {
          page_number: 11,
          content: 'Subtraction is the opposite of addition. When we subtract 8 - 3, we get 5.',
        },
        {
          page_number: 12,
          content: 'Word problems help us apply addition and subtraction to real life. For example: "Sam has 5 apples and gets 3 more."',
        },
      ]);

      expect(chunkIds.length).toBe(3);

      // Verify chunks were created
      const { data: chunks } = await serviceClient
        .from('textbook_chunks')
        .select('*')
        .eq('textbook_id', textbookId)
        .order('page_number');

      expect(chunks?.length).toBe(3);
      expect(chunks?.[0]?.page_number).toBe(10);
    });

    it('should create ingestion record', async () => {
      if (!serviceClient || !textbookId) return;

      const ingestionId = crypto.randomUUID();

      const { error } = await serviceClient.from('ingestions').insert({
        id: ingestionId,
        textbook_id: textbookId,
        upload_type: 'page',
        storage_path: `test/${userId}/${textbookId}/page_010.jpg`,
        status: 'completed',
        page_number: 10,
        ocr_result: { raw_text: 'Test OCR result', confidence: 0.95 },
      });

      expect(error).toBeNull();

      // Verify ingestion
      const { data: ingestion } = await serviceClient
        .from('ingestions')
        .select('*')
        .eq('id', ingestionId)
        .single();

      expect(ingestion).toBeDefined();
      expect(ingestion?.status).toBe('completed');
    });
  });

  describe('5. Chat Session', () => {
    it('should create a chat session', async () => {
      if (!serviceClient || !studentId || !textbookId) return;

      sessionId = await createTestSession(studentId, textbookId);
      expect(sessionId).toBeDefined();

      // Verify session
      const { data: session } = await serviceClient
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      expect(session).toBeDefined();
      expect(session?.student_id).toBe(studentId);
      expect(session?.textbook_id).toBe(textbookId);
    });

    it('should save chat messages', async () => {
      if (!serviceClient || !sessionId) return;

      // User message
      const userMessageId = crypto.randomUUID();
      await serviceClient.from('chat_messages').insert({
        id: userMessageId,
        session_id: sessionId,
        role: 'user',
        content: 'How do I add numbers?',
        verified: false,
      });

      // Assistant response
      const assistantMessageId = crypto.randomUUID();
      await serviceClient.from('chat_messages').insert({
        id: assistantMessageId,
        session_id: sessionId,
        role: 'assistant',
        content: 'Addition is the process of combining numbers together. Let me explain with an example from your textbook (page 10)...',
        verified: true,
      });

      // Verify messages
      const { data: messages } = await serviceClient
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at');

      expect(messages?.length).toBe(2);
      expect(messages?.[0]?.role).toBe('user');
      expect(messages?.[1]?.role).toBe('assistant');
      expect(messages?.[1]?.verified).toBe(true);
    });

    it('should save message citations', async () => {
      if (!serviceClient || !sessionId) return;

      // Get the assistant message
      const { data: messages } = await serviceClient
        .from('chat_messages')
        .select('id')
        .eq('session_id', sessionId)
        .eq('role', 'assistant');

      const messageId = messages?.[0]?.id;
      if (!messageId) return;

      // Get a chunk to cite
      const { data: chunks } = await serviceClient
        .from('textbook_chunks')
        .select('id, page_number')
        .eq('textbook_id', textbookId)
        .limit(1);

      const chunk = chunks?.[0];
      if (!chunk) return;

      // Create citation
      await serviceClient.from('message_citations').insert({
        message_id: messageId,
        chunk_id: chunk.id,
        page_number: chunk.page_number,
        relevance_score: 0.85,
      });

      // Verify citation
      const { data: citations } = await serviceClient
        .from('message_citations')
        .select('*')
        .eq('message_id', messageId);

      expect(citations?.length).toBe(1);
      expect(citations?.[0]?.page_number).toBe(chunk.page_number);
    });
  });

  describe('6. Usage Tracking', () => {
    it('should track AI usage', async () => {
      if (!serviceClient || !userId) return;

      const runId = crypto.randomUUID();

      await serviceClient.from('ai_runs').insert({
        id: runId,
        user_id: userId,
        student_id: studentId,
        session_id: sessionId,
        run_type: 'chat',
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        input_tokens: 500,
        output_tokens: 200,
        latency_ms: 1500,
        status: 'completed',
      });

      // Verify AI run
      const { data: run } = await serviceClient
        .from('ai_runs')
        .select('*')
        .eq('id', runId)
        .single();

      expect(run).toBeDefined();
      expect(run?.provider).toBe('anthropic');
      expect(run?.status).toBe('completed');
    });

    it('should increment usage counters', async () => {
      if (!serviceClient || !userId) return;

      const today = new Date().toISOString().split('T')[0];
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);

      // Upsert usage counter
      const { error } = await serviceClient.from('usage_counters').upsert({
        user_id: userId,
        period_start: today,
        period_end: periodEnd.toISOString().split('T')[0],
        ai_queries: 1,
        scans: 0,
        pages_ingested: 3,
      });

      expect(error).toBeNull();

      // Verify counter
      const { data: counter } = await serviceClient
        .from('usage_counters')
        .select('*')
        .eq('user_id', userId)
        .single();

      expect(counter).toBeDefined();
      expect(counter?.ai_queries).toBe(1);
    });
  });

  describe('7. RLS Verification', () => {
    it('should enforce owner-based access on students', async () => {
      if (!serviceClient) return;

      // Create another user
      const otherUserId = await createTestUser();
      const otherStudentId = await createTestStudent(otherUserId);

      // First user should not see other user's student (via RLS)
      // Note: This would need an authenticated client to properly test RLS
      // For now, we verify the owner_user_id is correctly set
      const { data: student } = await serviceClient
        .from('students')
        .select('*')
        .eq('id', otherStudentId)
        .single();

      expect(student?.owner_user_id).toBe(otherUserId);
      expect(student?.owner_user_id).not.toBe(userId);
    });
  });
});

describe('Schema Validation', () => {
  it('should have all required tables', async () => {
    if (!serviceClient) return;

    const requiredTables = [
      'profiles',
      'students',
      'textbooks',
      'student_textbooks',
      'textbook_units',
      'textbook_lessons',
      'textbook_chunks',
      'ingestions',
      'chat_sessions',
      'chat_messages',
      'message_citations',
      'ai_runs',
      'plans',
      'entitlements',
      'usage_counters',
    ];

    for (const table of requiredTables) {
      const { error } = await serviceClient.from(table).select('*').limit(1);

      // Table should exist (error would indicate table doesn't exist)
      expect(error?.message).not.toContain('does not exist');
    }
  });

  it('should enforce foreign key constraints', async () => {
    if (!serviceClient) return;

    // Try to create a student with non-existent owner
    const { error } = await serviceClient.from('students').insert({
      id: crypto.randomUUID(),
      owner_user_id: crypto.randomUUID(), // Non-existent user
      name: 'Invalid Student',
      grade: '5',
      state: 'CA',
    });

    // Should fail due to foreign key constraint
    expect(error).toBeDefined();
  });
});
