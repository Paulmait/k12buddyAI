/**
 * Unit tests for Spaced Repetition SM-2 algorithm
 */

import { calculateNextReview, getQualityOptions, ReviewCard, ReviewQuality } from '../spacedRepetition';

describe('Spaced Repetition Algorithm', () => {
  const createTestCard = (overrides: Partial<ReviewCard> = {}): ReviewCard => ({
    id: 'test-card-1',
    studentId: 'student-1',
    subject: 'math',
    topic: 'algebra',
    question: 'What is 2 + 2?',
    answer: '4',
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReviewDate: '2024-01-20',
    lastReviewDate: null,
    createdAt: '2024-01-19',
    ...overrides,
  });

  describe('calculateNextReview', () => {
    describe('new cards (repetitions = 0)', () => {
      it('should set interval to 1 day for quality >= 3 on first review', () => {
        const card = createTestCard({ repetitions: 0, interval: 0 });
        const result = calculateNextReview(card, 4);

        expect(result.interval).toBe(1);
        expect(result.repetitions).toBe(1);
      });

      it('should reset on failure (quality < 3)', () => {
        const card = createTestCard({ repetitions: 0, interval: 0 });
        const result = calculateNextReview(card, 2);

        expect(result.interval).toBe(1);
        expect(result.repetitions).toBe(0);
      });
    });

    describe('second review (repetitions = 1)', () => {
      it('should set interval to 6 days for quality >= 3', () => {
        const card = createTestCard({ repetitions: 1, interval: 1 });
        const result = calculateNextReview(card, 4);

        expect(result.interval).toBe(6);
        expect(result.repetitions).toBe(2);
      });
    });

    describe('subsequent reviews (repetitions >= 2)', () => {
      it('should multiply interval by ease factor', () => {
        const card = createTestCard({
          repetitions: 2,
          interval: 6,
          easeFactor: 2.5,
        });
        const result = calculateNextReview(card, 4);

        expect(result.interval).toBe(15); // 6 * 2.5 = 15
        expect(result.repetitions).toBe(3);
      });

      it('should reset on failure regardless of repetitions', () => {
        const card = createTestCard({
          repetitions: 5,
          interval: 30,
          easeFactor: 2.5,
        });
        const result = calculateNextReview(card, 1);

        expect(result.interval).toBe(1);
        expect(result.repetitions).toBe(0);
      });
    });

    describe('ease factor adjustments', () => {
      it('should increase ease factor for quality 5 (perfect)', () => {
        const card = createTestCard({ easeFactor: 2.5 });
        const result = calculateNextReview(card, 5);

        expect(result.easeFactor).toBeGreaterThan(2.5);
      });

      it('should decrease ease factor for quality 3 (correct with difficulty)', () => {
        const card = createTestCard({ easeFactor: 2.5 });
        const result = calculateNextReview(card, 3);

        expect(result.easeFactor).toBeLessThan(2.5);
      });

      it('should significantly decrease ease factor for failures', () => {
        const card = createTestCard({ easeFactor: 2.5 });
        const result = calculateNextReview(card, 0);

        expect(result.easeFactor).toBeLessThan(2.3);
      });

      it('should not go below minimum ease factor (1.3)', () => {
        const card = createTestCard({ easeFactor: 1.4 });
        const result = calculateNextReview(card, 0);

        expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
      });
    });

    describe('next review date', () => {
      it('should set next review date based on interval', () => {
        const card = createTestCard({ repetitions: 2, interval: 6, easeFactor: 2.0 });
        const result = calculateNextReview(card, 4);

        const nextDate = new Date(result.nextReviewDate!);
        const today = new Date();
        today.setDate(today.getDate() + result.interval!);

        expect(nextDate.toISOString().split('T')[0]).toBe(today.toISOString().split('T')[0]);
      });
    });

    describe('quality responses', () => {
      const testCases: Array<{ quality: ReviewQuality; expectReset: boolean }> = [
        { quality: 0, expectReset: true },
        { quality: 1, expectReset: true },
        { quality: 2, expectReset: true },
        { quality: 3, expectReset: false },
        { quality: 4, expectReset: false },
        { quality: 5, expectReset: false },
      ];

      testCases.forEach(({ quality, expectReset }) => {
        it(`quality ${quality} should ${expectReset ? 'reset' : 'advance'} repetitions`, () => {
          const card = createTestCard({ repetitions: 3, interval: 10 });
          const result = calculateNextReview(card, quality);

          if (expectReset) {
            expect(result.repetitions).toBe(0);
          } else {
            expect(result.repetitions).toBe(4);
          }
        });
      });
    });
  });

  describe('getQualityOptions', () => {
    it('should return 6 quality options', () => {
      const options = getQualityOptions();
      expect(options).toHaveLength(6);
    });

    it('should have quality values from 0 to 5', () => {
      const options = getQualityOptions();
      const qualities = options.map((o) => o.quality);
      expect(qualities).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('should have labels for all options', () => {
      const options = getQualityOptions();
      options.forEach((option) => {
        expect(option.label).toBeDefined();
        expect(option.label.length).toBeGreaterThan(0);
      });
    });

    it('should have descriptions for all options', () => {
      const options = getQualityOptions();
      options.forEach((option) => {
        expect(option.description).toBeDefined();
        expect(option.description.length).toBeGreaterThan(0);
      });
    });

    it('should have user-friendly labels', () => {
      const options = getQualityOptions();
      const labels = options.map((o) => o.label);
      expect(labels).toContain('Forgot');
      expect(labels).toContain('Easy');
    });
  });

  describe('edge cases', () => {
    it('should handle very low ease factor', () => {
      const card = createTestCard({ easeFactor: 1.3, repetitions: 2, interval: 6 });
      const result = calculateNextReview(card, 5);

      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
      expect(result.interval).toBeGreaterThan(0);
    });

    it('should handle very high interval', () => {
      const card = createTestCard({
        easeFactor: 2.5,
        repetitions: 10,
        interval: 365,
      });
      const result = calculateNextReview(card, 4);

      expect(result.interval).toBeGreaterThan(365);
      expect(result.repetitions).toBe(11);
    });

    it('should handle perfect streak', () => {
      let card = createTestCard({ repetitions: 0, interval: 0, easeFactor: 2.5 });

      // Simulate 5 perfect reviews
      for (let i = 0; i < 5; i++) {
        const updates = calculateNextReview(card, 5);
        card = {
          ...card,
          easeFactor: updates.easeFactor!,
          interval: updates.interval!,
          repetitions: updates.repetitions!,
        };
      }

      expect(card.easeFactor).toBeGreaterThan(2.5);
      expect(card.interval).toBeGreaterThan(30);
    });
  });
});
