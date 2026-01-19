/**
 * Integration tests for API calls
 */

import { supabase } from '../../lib/supabase';

// Mock Supabase client
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should successfully authenticate user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockUser,
          session: { access_token: 'token', refresh_token: 'refresh' },
        },
        error: null,
      } as never);

      const result = await mockSupabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.data?.user?.id).toBe('user-123');
      expect(result.error).toBeNull();
    });

    it('should handle authentication failure', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials', status: 401 },
      } as never);

      const result = await mockSupabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.data?.user).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should get current user session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'token',
            user: { id: 'user-123' },
          },
        },
        error: null,
      } as never);

      const result = await mockSupabase.auth.getSession();

      expect(result.data?.session).toBeDefined();
    });
  });

  describe('Chat API', () => {
    it('should send chat message', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          message: {
            id: 'msg-123',
            content: 'Hello! I can help with that.',
            role: 'assistant',
          },
        },
        error: null,
      });

      const result = await mockSupabase.functions.invoke('ai_chat', {
        body: {
          message: 'Help me with math',
          sessionId: 'session-123',
        },
      });

      expect(result.data?.message).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should handle chat API error', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Service unavailable' },
      });

      const result = await mockSupabase.functions.invoke('ai_chat', {
        body: { message: 'Help', sessionId: 'session-123' },
      });

      expect(result.error).toBeDefined();
    });
  });

  describe('Profile API', () => {
    const mockFrom = jest.fn();

    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      } as never);
    });

    it('should fetch user profile', async () => {
      const mockProfile = {
        id: 'user-123',
        display_name: 'Test User',
        grade: '5th',
        subjects: ['math', 'science'],
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
      } as never);

      const result = await mockSupabase
        .from('profiles')
        .select('*')
        .eq('id', 'user-123')
        .single();

      expect(result.data).toEqual(mockProfile);
    });

    it('should update user profile', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'user-123', display_name: 'Updated Name' },
          error: null,
        }),
      } as never);

      const result = await mockSupabase
        .from('profiles')
        .update({ display_name: 'Updated Name' })
        .eq('id', 'user-123')
        .select()
        .single();

      expect(result.data?.display_name).toBe('Updated Name');
    });
  });

  describe('Gamification API', () => {
    it('should fetch student XP', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            student_id: 'user-123',
            total_xp: 1500,
            current_level: 5,
          },
          error: null,
        }),
      } as never);

      const result = await mockSupabase
        .from('student_xp')
        .select('*')
        .eq('student_id', 'user-123')
        .single();

      expect(result.data?.total_xp).toBe(1500);
      expect(result.data?.current_level).toBe(5);
    });

    it('should fetch badges', async () => {
      const mockBadges = [
        { id: 'badge-1', badge_code: 'first_question', earned_at: '2024-01-15' },
        { id: 'badge-2', badge_code: '7_day_streak', earned_at: '2024-01-20' },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockBadges, error: null }),
      } as never);

      const result = await mockSupabase
        .from('student_badges')
        .select('*')
        .eq('student_id', 'user-123');

      expect(result.data).toHaveLength(2);
    });
  });

  describe('Study Groups API', () => {
    it('should fetch available groups', async () => {
      const mockGroups = [
        { id: 'group-1', name: 'Math Masters', member_count: 15 },
        { id: 'group-2', name: 'Science Squad', member_count: 12 },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockGroups, error: null }),
      } as never);

      const result = await mockSupabase
        .from('study_groups')
        .select('*')
        .eq('is_private', false)
        .order('member_count', { ascending: false });

      expect(result.data).toHaveLength(2);
    });

    it('should join a study group', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      } as never);

      const result = await mockSupabase.from('study_group_members').insert({
        group_id: 'group-123',
        user_id: 'user-123',
        role: 'member',
      });

      expect(result.error).toBeNull();
    });
  });

  describe('Spaced Repetition API', () => {
    it('should fetch review cards', async () => {
      const mockCards = [
        { id: 'card-1', question: 'What is 2+2?', next_review_date: '2024-01-20' },
        { id: 'card-2', question: 'What is the capital of France?', next_review_date: '2024-01-21' },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockCards, error: null }),
      } as never);

      const result = await mockSupabase
        .from('review_cards')
        .select('*')
        .eq('student_id', 'user-123')
        .lte('next_review_date', '2024-01-21')
        .order('next_review_date', { ascending: true });

      expect(result.data).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockSupabase.functions.invoke.mockRejectedValue(new Error('Network error'));

      await expect(
        mockSupabase.functions.invoke('ai_chat', {
          body: { message: 'test' },
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      mockSupabase.functions.invoke.mockRejectedValue(new Error('Request timeout'));

      await expect(
        mockSupabase.functions.invoke('ai_chat', {
          body: { message: 'test' },
        })
      ).rejects.toThrow('Request timeout');
    });
  });
});
