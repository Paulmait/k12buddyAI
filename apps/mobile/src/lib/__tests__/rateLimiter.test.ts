/**
 * Unit tests for rate limiter
 */

import { RateLimiter, chatRateLimiter, scanRateLimiter, apiRateLimiter } from '../rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });

      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit('user1');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('should block requests exceeding limit', () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60000 });

      // Use up all requests
      for (let i = 0; i < 3; i++) {
        limiter.checkLimit('user1');
      }

      // Next request should be blocked
      const result = limiter.checkLimit('user1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should track different keys separately', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60000 });

      limiter.checkLimit('user1');
      limiter.checkLimit('user1');

      // user1 is now limited
      expect(limiter.checkLimit('user1').allowed).toBe(false);

      // user2 should still be allowed
      expect(limiter.checkLimit('user2').allowed).toBe(true);
    });

    it('should reset after window expires', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

      limiter.checkLimit('user1');
      limiter.checkLimit('user1');
      expect(limiter.checkLimit('user1').allowed).toBe(false);

      // Advance time past the window
      jest.advanceTimersByTime(1001);

      // Should be allowed again
      const result = limiter.checkLimit('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });

  describe('cooldown functionality', () => {
    it('should enforce cooldown period', () => {
      const limiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        cooldownMs: 2000,
      });

      const first = limiter.checkLimit('user1');
      expect(first.allowed).toBe(true);

      // Request immediately after should be blocked by cooldown
      const second = limiter.checkLimit('user1');
      expect(second.allowed).toBe(false);
      expect(second.retryAfter).toBeLessThanOrEqual(2000);
    });

    it('should allow request after cooldown expires', () => {
      const limiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        cooldownMs: 1000,
      });

      limiter.checkLimit('user1');
      jest.advanceTimersByTime(1001);

      const result = limiter.checkLimit('user1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getRemainingRequests', () => {
    it('should return max requests for new key', () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
      expect(limiter.getRemainingRequests('newuser')).toBe(5);
    });

    it('should return correct remaining after requests', () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
      limiter.checkLimit('user1');
      limiter.checkLimit('user1');
      expect(limiter.getRemainingRequests('user1')).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset limits for a key', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60000 });

      limiter.checkLimit('user1');
      limiter.checkLimit('user1');
      expect(limiter.checkLimit('user1').allowed).toBe(false);

      limiter.reset('user1');

      expect(limiter.checkLimit('user1').allowed).toBe(true);
      expect(limiter.getRemainingRequests('user1')).toBe(1);
    });
  });

  describe('resetAll', () => {
    it('should reset all limits', () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60000 });

      limiter.checkLimit('user1');
      limiter.checkLimit('user2');

      expect(limiter.checkLimit('user1').allowed).toBe(false);
      expect(limiter.checkLimit('user2').allowed).toBe(false);

      limiter.resetAll();

      expect(limiter.checkLimit('user1').allowed).toBe(true);
      expect(limiter.checkLimit('user2').allowed).toBe(true);
    });
  });

  describe('pre-configured limiters', () => {
    it('chatRateLimiter should be configured correctly', () => {
      const result = chatRateLimiter.checkLimit('testuser');
      expect(result.allowed).toBe(true);
      // Chat limiter allows 30 requests per minute
      expect(result.remaining).toBeLessThanOrEqual(29);
    });

    it('scanRateLimiter should be configured correctly', () => {
      const result = scanRateLimiter.checkLimit('testuser');
      expect(result.allowed).toBe(true);
      // Scan limiter allows 10 requests per minute
      expect(result.remaining).toBeLessThanOrEqual(9);
    });

    it('apiRateLimiter should be configured correctly', () => {
      const result = apiRateLimiter.checkLimit('testuser');
      expect(result.allowed).toBe(true);
      // API limiter allows 100 requests per minute
      expect(result.remaining).toBeLessThanOrEqual(99);
    });
  });
});
