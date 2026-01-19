/**
 * Unit tests for Content Moderation
 */

import {
  moderateContent,
  filterPII,
  checkContentSafety,
  ModerationResult,
  ContentSafetyLevel,
} from '../contentModeration';

describe('Content Moderation', () => {
  describe('filterPII', () => {
    it('should detect and mask email addresses', () => {
      const input = 'Contact me at john@example.com for more info';
      const result = filterPII(input);

      expect(result.filteredText).not.toContain('john@example.com');
      expect(result.filteredText).toContain('[EMAIL REMOVED]');
      expect(result.detectedPII).toContain('email');
    });

    it('should detect and mask phone numbers', () => {
      const testCases = [
        '(555) 123-4567',
        '555-123-4567',
        '5551234567',
        '+1 555 123 4567',
      ];

      testCases.forEach((phone) => {
        const result = filterPII(`Call me at ${phone}`);
        expect(result.filteredText).toContain('[PHONE REMOVED]');
        expect(result.detectedPII).toContain('phone');
      });
    });

    it('should detect and mask SSN-like numbers', () => {
      const input = 'My SSN is 123-45-6789';
      const result = filterPII(input);

      expect(result.filteredText).not.toContain('123-45-6789');
      expect(result.filteredText).toContain('[SSN REMOVED]');
      expect(result.detectedPII).toContain('ssn');
    });

    it('should detect and mask addresses', () => {
      const input = 'I live at 123 Main Street, Apt 4B';
      const result = filterPII(input);

      expect(result.filteredText).toContain('[ADDRESS REMOVED]');
      expect(result.detectedPII).toContain('address');
    });

    it('should handle multiple PII types in one message', () => {
      const input = 'Email: test@test.com, Phone: 555-1234, Address: 123 Oak Lane';
      const result = filterPII(input);

      expect(result.detectedPII.length).toBeGreaterThan(1);
      expect(result.filteredText).not.toContain('test@test.com');
      expect(result.filteredText).not.toContain('555-1234');
    });

    it('should preserve text without PII', () => {
      const input = 'What is the capital of France?';
      const result = filterPII(input);

      expect(result.filteredText).toBe(input);
      expect(result.detectedPII).toHaveLength(0);
    });
  });

  describe('checkContentSafety', () => {
    it('should pass clean educational content', () => {
      const content = 'Can you help me understand photosynthesis?';
      const result = checkContentSafety(content);

      expect(result.isSafe).toBe(true);
      expect(result.level).toBe('safe');
      expect(result.flags).toHaveLength(0);
    });

    it('should flag mild profanity', () => {
      const content = 'This damn homework is hard';
      const result = checkContentSafety(content);

      expect(result.level).toBe('warning');
      expect(result.flags).toContain('mild_profanity');
    });

    it('should flag violence-related content', () => {
      const content = 'How do I hurt someone';
      const result = checkContentSafety(content);

      expect(result.isSafe).toBe(false);
      expect(result.level).toBe('unsafe');
    });

    it('should flag substance-related content for K-12', () => {
      const content = 'Where can I get drugs';
      const result = checkContentSafety(content);

      expect(result.isSafe).toBe(false);
      expect(result.flags.length).toBeGreaterThan(0);
    });

    it('should handle empty content', () => {
      const result = checkContentSafety('');

      expect(result.isSafe).toBe(true);
      expect(result.flags).toHaveLength(0);
    });
  });

  describe('moderateContent', () => {
    it('should return complete moderation result', () => {
      const content = 'Hello, my email is test@example.com';
      const result = moderateContent(content);

      expect(result).toHaveProperty('originalContent');
      expect(result).toHaveProperty('filteredContent');
      expect(result).toHaveProperty('isAllowed');
      expect(result).toHaveProperty('piiDetected');
      expect(result).toHaveProperty('safetyLevel');
      expect(result).toHaveProperty('flags');
    });

    it('should allow clean content', () => {
      const content = 'What is 2 plus 2?';
      const result = moderateContent(content);

      expect(result.isAllowed).toBe(true);
      expect(result.filteredContent).toBe(content);
    });

    it('should filter PII but allow message', () => {
      const content = 'My number is 555-123-4567, can you help with math?';
      const result = moderateContent(content);

      expect(result.isAllowed).toBe(true);
      expect(result.piiDetected.length).toBeGreaterThan(0);
      expect(result.filteredContent).not.toContain('555-123-4567');
    });

    it('should block unsafe content', () => {
      const content = 'How to harm myself';
      const result = moderateContent(content);

      expect(result.isAllowed).toBe(false);
      expect(result.safetyLevel).toBe('unsafe');
    });

    it('should handle combined PII and mild flags', () => {
      const content = 'Damn, I forgot my password is test@test.com';
      const result = moderateContent(content);

      expect(result.piiDetected.length).toBeGreaterThan(0);
      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.filteredContent).not.toContain('test@test.com');
    });
  });

  describe('edge cases', () => {
    it('should handle very long content', () => {
      const content = 'a'.repeat(10000);
      const result = moderateContent(content);

      expect(result).toBeDefined();
      expect(result.isAllowed).toBe(true);
    });

    it('should handle special characters', () => {
      const content = '¿Cómo estás? 日本語 🎉 <script>alert("xss")</script>';
      const result = moderateContent(content);

      expect(result).toBeDefined();
    });

    it('should handle mixed case', () => {
      const content = 'My EMAIL is TEST@EXAMPLE.COM';
      const result = moderateContent(content);

      expect(result.piiDetected).toContain('email');
    });

    it('should not false positive on educational content about safety', () => {
      const content = 'How can I stay safe online?';
      const result = moderateContent(content);

      expect(result.isAllowed).toBe(true);
      expect(result.safetyLevel).toBe('safe');
    });

    it('should handle URLs appropriately', () => {
      const content = 'Check out https://educational-site.com for resources';
      const result = moderateContent(content);

      // URLs should generally be allowed unless they contain PII
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('severity levels', () => {
    it('should categorize safe content correctly', () => {
      const result = checkContentSafety('Please help me with algebra');
      expect(result.level).toBe('safe');
    });

    it('should categorize warning content correctly', () => {
      const result = checkContentSafety('This stupid homework');
      expect(['safe', 'warning']).toContain(result.level);
    });

    it('should categorize unsafe content correctly', () => {
      const result = checkContentSafety('I want to hurt myself');
      expect(result.level).toBe('unsafe');
    });
  });
});
