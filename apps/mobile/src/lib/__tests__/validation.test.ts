/**
 * Unit tests for validation utilities
 */

import {
  ChatMessageSchema,
  ProfileUpdateSchema,
  GradeSchema,
  SubjectSchema,
  DifficultySchema,
  validateChatMessage,
  validateProfileUpdate,
  sanitizeString,
} from '../validation';

describe('Validation Utilities', () => {
  describe('ChatMessageSchema', () => {
    it('should validate a valid chat message', () => {
      const validMessage = {
        content: 'What is 2 + 2?',
        subject: 'math',
        grade: '5th',
      };
      const result = ChatMessageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });

    it('should reject empty content', () => {
      const invalidMessage = {
        content: '',
        subject: 'math',
        grade: '5th',
      };
      const result = ChatMessageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it('should reject content exceeding max length', () => {
      const invalidMessage = {
        content: 'a'.repeat(5001),
        subject: 'math',
        grade: '5th',
      };
      const result = ChatMessageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it('should reject invalid subject', () => {
      const invalidMessage = {
        content: 'Hello',
        subject: 'invalid_subject',
        grade: '5th',
      };
      const result = ChatMessageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it('should accept all valid subjects', () => {
      const subjects = ['math', 'science', 'english', 'social_studies', 'general'];
      subjects.forEach((subject) => {
        const message = {
          content: 'Test question',
          subject,
          grade: '5th',
        };
        const result = ChatMessageSchema.safeParse(message);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('GradeSchema', () => {
    it('should accept all valid grades K-12', () => {
      const grades = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
      grades.forEach((grade) => {
        const result = GradeSchema.safeParse(grade);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid grade', () => {
      const result = GradeSchema.safeParse('13th');
      expect(result.success).toBe(false);
    });
  });

  describe('DifficultySchema', () => {
    it('should accept all valid difficulty levels', () => {
      const difficulties = ['struggling', 'average', 'advanced'];
      difficulties.forEach((difficulty) => {
        const result = DifficultySchema.safeParse(difficulty);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid difficulty', () => {
      const result = DifficultySchema.safeParse('expert');
      expect(result.success).toBe(false);
    });
  });

  describe('ProfileUpdateSchema', () => {
    it('should validate a valid profile update', () => {
      const validProfile = {
        displayName: 'John',
        grade: '6th',
        subjects: ['math', 'science'],
        difficulty: 'average',
      };
      const result = ProfileUpdateSchema.safeParse(validProfile);
      expect(result.success).toBe(true);
    });

    it('should reject display name too short', () => {
      const invalidProfile = {
        displayName: 'J',
        grade: '6th',
      };
      const result = ProfileUpdateSchema.safeParse(invalidProfile);
      expect(result.success).toBe(false);
    });

    it('should reject display name too long', () => {
      const invalidProfile = {
        displayName: 'a'.repeat(51),
        grade: '6th',
      };
      const result = ProfileUpdateSchema.safeParse(invalidProfile);
      expect(result.success).toBe(false);
    });

    it('should allow partial updates', () => {
      const partialProfile = {
        displayName: 'Test User',
      };
      const result = ProfileUpdateSchema.safeParse(partialProfile);
      expect(result.success).toBe(true);
    });
  });

  describe('validateChatMessage', () => {
    it('should return validated data for valid message', () => {
      const result = validateChatMessage({
        content: 'Test question',
        subject: 'math',
        grade: '5th',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for invalid message', () => {
      const result = validateChatMessage({
        content: '',
        subject: 'math',
        grade: '5th',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateProfileUpdate', () => {
    it('should return validated data for valid profile', () => {
      const result = validateProfileUpdate({
        displayName: 'Valid Name',
        grade: '5th',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeString(null as unknown as string)).toBe('');
      expect(sanitizeString(undefined as unknown as string)).toBe('');
    });

    it('should preserve normal text', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
    });
  });
});
