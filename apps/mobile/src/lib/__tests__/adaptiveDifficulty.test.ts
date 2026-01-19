/**
 * Unit tests for Adaptive Difficulty system
 */

import {
  calculateDifficultyRecommendation,
  PerformanceData,
  THRESHOLDS,
} from '../adaptiveDifficulty';
import type { Difficulty } from '@k12buddy/shared';

describe('Adaptive Difficulty System', () => {
  const createPerformanceData = (overrides: Partial<PerformanceData> = {}): PerformanceData => ({
    correct: 0,
    incorrect: 0,
    hintsUsed: 0,
    averageResponseTime: 15,
    streakLength: 0,
    recentAccuracy: 0,
    ...overrides,
  });

  describe('calculateDifficultyRecommendation', () => {
    describe('insufficient data', () => {
      it('should not recommend change with less than MIN_SAMPLES interactions', () => {
        const performance = createPerformanceData({
          correct: 3,
          incorrect: 1,
        });

        const result = calculateDifficultyRecommendation('average', performance);

        expect(result.shouldAdjust).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.reason).toContain('Not enough data');
      });
    });

    describe('promotion (difficulty increase)', () => {
      it('should recommend promotion for high accuracy, fast responses, no hints', () => {
        const performance = createPerformanceData({
          correct: 9,
          incorrect: 1,
          hintsUsed: 0,
          averageResponseTime: 5,
          streakLength: 5,
        });

        const result = calculateDifficultyRecommendation('average', performance);

        expect(result.recommendedDifficulty).toBe('advanced');
        expect(result.shouldAdjust).toBe(true);
        expect(result.reason).toContain('Excellent performance');
      });

      it('should not promote from advanced (already max)', () => {
        const performance = createPerformanceData({
          correct: 10,
          incorrect: 0,
          hintsUsed: 0,
          averageResponseTime: 5,
        });

        const result = calculateDifficultyRecommendation('advanced', performance);

        expect(result.recommendedDifficulty).toBe('advanced');
        expect(result.shouldAdjust).toBe(false);
      });

      it('should promote struggling to average', () => {
        const performance = createPerformanceData({
          correct: 9,
          incorrect: 1,
          hintsUsed: 0,
          averageResponseTime: 5,
        });

        const result = calculateDifficultyRecommendation('struggling', performance);

        expect(result.recommendedDifficulty).toBe('average');
      });

      it('should recommend promotion based on streak', () => {
        const performance = createPerformanceData({
          correct: 7,
          incorrect: 3,
          hintsUsed: 1,
          averageResponseTime: 20,
          streakLength: 6,
        });

        const result = calculateDifficultyRecommendation('average', performance);

        expect(result.recommendedDifficulty).toBe('advanced');
        expect(result.reason).toContain('streak');
      });
    });

    describe('demotion (difficulty decrease)', () => {
      it('should recommend demotion for low accuracy', () => {
        const performance = createPerformanceData({
          correct: 4,
          incorrect: 6,
          hintsUsed: 0,
          averageResponseTime: 15,
        });

        const result = calculateDifficultyRecommendation('average', performance);

        expect(result.recommendedDifficulty).toBe('struggling');
        expect(result.shouldAdjust).toBe(true);
        expect(result.reason).toContain('easier');
      });

      it('should recommend demotion for excessive hint usage', () => {
        const performance = createPerformanceData({
          correct: 7,
          incorrect: 3,
          hintsUsed: 4,
          averageResponseTime: 15,
        });

        const result = calculateDifficultyRecommendation('average', performance);

        expect(result.recommendedDifficulty).toBe('struggling');
      });

      it('should recommend demotion for slow response times', () => {
        const performance = createPerformanceData({
          correct: 7,
          incorrect: 3,
          hintsUsed: 0,
          averageResponseTime: 65,
        });

        const result = calculateDifficultyRecommendation('average', performance);

        expect(result.recommendedDifficulty).toBe('struggling');
      });

      it('should demote advanced to average', () => {
        const performance = createPerformanceData({
          correct: 3,
          incorrect: 7,
        });

        const result = calculateDifficultyRecommendation('advanced', performance);

        expect(result.recommendedDifficulty).toBe('average');
      });

      it('should not demote from struggling (already min)', () => {
        const performance = createPerformanceData({
          correct: 3,
          incorrect: 7,
        });

        const result = calculateDifficultyRecommendation('struggling', performance);

        expect(result.recommendedDifficulty).toBe('struggling');
        expect(result.shouldAdjust).toBe(false);
      });
    });

    describe('maintain current difficulty', () => {
      it('should maintain difficulty for moderate performance', () => {
        const performance = createPerformanceData({
          correct: 6,
          incorrect: 4,
          hintsUsed: 1,
          averageResponseTime: 25,
          streakLength: 2,
        });

        const result = calculateDifficultyRecommendation('average', performance);

        expect(result.recommendedDifficulty).toBe('average');
        expect(result.shouldAdjust).toBe(false);
        expect(result.reason).toContain('appropriate');
      });
    });

    describe('confidence calculation', () => {
      it('should have higher confidence with more samples', () => {
        const smallSample = createPerformanceData({
          correct: 5,
          incorrect: 0,
          hintsUsed: 0,
          averageResponseTime: 5,
        });

        const largeSample = createPerformanceData({
          correct: 18,
          incorrect: 2,
          hintsUsed: 0,
          averageResponseTime: 5,
        });

        const smallResult = calculateDifficultyRecommendation('average', smallSample);
        const largeResult = calculateDifficultyRecommendation('average', largeSample);

        expect(largeResult.confidence).toBeGreaterThan(smallResult.confidence);
      });

      it('should require minimum confidence for adjustment', () => {
        const lowConfidencePerformance = createPerformanceData({
          correct: 5,
          incorrect: 0,
          hintsUsed: 0,
          averageResponseTime: 5,
        });

        const result = calculateDifficultyRecommendation('average', lowConfidencePerformance);

        if (result.confidence < THRESHOLDS.MIN_CONFIDENCE) {
          expect(result.shouldAdjust).toBe(false);
        }
      });

      it('should be more conservative for promotions', () => {
        const goodPerformance = createPerformanceData({
          correct: 9,
          incorrect: 1,
          hintsUsed: 0,
          averageResponseTime: 5,
        });

        const poorPerformance = createPerformanceData({
          correct: 1,
          incorrect: 9,
          hintsUsed: 0,
          averageResponseTime: 15,
        });

        const promotionResult = calculateDifficultyRecommendation('average', goodPerformance);
        const demotionResult = calculateDifficultyRecommendation('average', poorPerformance);

        // Both should have similar raw performance signal but promotion should be more conservative
        expect(promotionResult.confidence).toBeLessThanOrEqual(demotionResult.confidence + 0.1);
      });
    });

    describe('thresholds', () => {
      it('should use PROMOTE_ACCURACY threshold (85%)', () => {
        const belowThreshold = createPerformanceData({
          correct: 8,
          incorrect: 2,
          hintsUsed: 0,
          averageResponseTime: 5,
        }); // 80%

        const atThreshold = createPerformanceData({
          correct: 17,
          incorrect: 3,
          hintsUsed: 0,
          averageResponseTime: 5,
        }); // 85%

        const belowResult = calculateDifficultyRecommendation('average', belowThreshold);
        const atResult = calculateDifficultyRecommendation('average', atThreshold);

        expect(atResult.recommendedDifficulty).toBe('advanced');
      });

      it('should use DEMOTE_ACCURACY threshold (50%)', () => {
        const atThreshold = createPerformanceData({
          correct: 5,
          incorrect: 5,
        }); // 50%

        const result = calculateDifficultyRecommendation('average', atThreshold);

        expect(result.recommendedDifficulty).toBe('struggling');
      });
    });
  });

  describe('difficulty transitions', () => {
    const difficulties: Difficulty[] = ['struggling', 'average', 'advanced'];

    difficulties.forEach((difficulty) => {
      it(`should return valid difficulty for ${difficulty}`, () => {
        const performance = createPerformanceData({
          correct: 7,
          incorrect: 3,
        });

        const result = calculateDifficultyRecommendation(difficulty, performance);

        expect(difficulties).toContain(result.recommendedDifficulty);
        expect(difficulties).toContain(result.currentDifficulty);
      });
    });
  });
});
