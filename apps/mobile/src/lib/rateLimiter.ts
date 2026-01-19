/**
 * Client-side Rate Limiter
 * Prevents excessive API calls and provides user feedback
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_LIMIT_KEY_PREFIX = 'k12buddy_rate_limit_';

interface RateLimitConfig {
  // Maximum number of requests
  maxRequests: number;
  // Time window in milliseconds
  windowMs: number;
  // Optional: Cooldown period after hitting limit
  cooldownMs?: number;
}

interface RateLimitState {
  requests: number[];
  coolingDown: boolean;
  cooldownUntil: number | null;
}

// Default rate limits for different actions
export const RateLimits: Record<string, RateLimitConfig> = {
  // Chat messages: 20 per minute
  chat: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    cooldownMs: 30 * 1000,
  },
  // OCR scans: 10 per minute
  ocr: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    cooldownMs: 60 * 1000,
  },
  // API calls (general): 100 per minute
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
  // Auth attempts: 5 per 5 minutes
  auth: {
    maxRequests: 5,
    windowMs: 5 * 60 * 1000,
    cooldownMs: 5 * 60 * 1000,
  },
};

/**
 * Rate Limiter class for managing request limits
 */
export class RateLimiter {
  private key: string;
  private config: RateLimitConfig;
  private state: RateLimitState;

  constructor(action: string, config?: RateLimitConfig) {
    this.key = `${RATE_LIMIT_KEY_PREFIX}${action}`;
    this.config = config || RateLimits[action] || RateLimits.api;
    this.state = {
      requests: [],
      coolingDown: false,
      cooldownUntil: null,
    };
  }

  /**
   * Load state from storage
   */
  private async loadState(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.key);
      if (stored) {
        this.state = JSON.parse(stored);
      }
    } catch (error) {
      // Ignore storage errors
    }
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.key, JSON.stringify(this.state));
    } catch (error) {
      // Ignore storage errors
    }
  }

  /**
   * Clean up old requests outside the window
   */
  private cleanupOldRequests(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    this.state.requests = this.state.requests.filter(time => time > windowStart);
  }

  /**
   * Check if currently in cooldown
   */
  private checkCooldown(): boolean {
    if (!this.state.coolingDown || !this.state.cooldownUntil) {
      return false;
    }

    const now = Date.now();
    if (now >= this.state.cooldownUntil) {
      // Cooldown expired
      this.state.coolingDown = false;
      this.state.cooldownUntil = null;
      this.state.requests = [];
      return false;
    }

    return true;
  }

  /**
   * Check if a request can be made
   */
  async canMakeRequest(): Promise<{
    allowed: boolean;
    remainingRequests: number;
    retryAfter: number | null;
    message: string | null;
  }> {
    await this.loadState();

    // Check cooldown first
    if (this.checkCooldown()) {
      const retryAfter = Math.ceil((this.state.cooldownUntil! - Date.now()) / 1000);
      return {
        allowed: false,
        remainingRequests: 0,
        retryAfter,
        message: `Please wait ${retryAfter} seconds before trying again.`,
      };
    }

    // Clean up old requests
    this.cleanupOldRequests();

    const remainingRequests = this.config.maxRequests - this.state.requests.length;

    if (remainingRequests <= 0) {
      // Rate limit exceeded - enter cooldown
      if (this.config.cooldownMs) {
        this.state.coolingDown = true;
        this.state.cooldownUntil = Date.now() + this.config.cooldownMs;
        await this.saveState();
      }

      const retryAfter = Math.ceil((this.config.cooldownMs || this.config.windowMs) / 1000);
      return {
        allowed: false,
        remainingRequests: 0,
        retryAfter,
        message: "You're doing great! Take a short break and try again in a moment.",
      };
    }

    return {
      allowed: true,
      remainingRequests,
      retryAfter: null,
      message: null,
    };
  }

  /**
   * Record a request
   */
  async recordRequest(): Promise<void> {
    await this.loadState();
    this.cleanupOldRequests();
    this.state.requests.push(Date.now());
    await this.saveState();
  }

  /**
   * Reset the rate limiter
   */
  async reset(): Promise<void> {
    this.state = {
      requests: [],
      coolingDown: false,
      cooldownUntil: null,
    };
    await AsyncStorage.removeItem(this.key);
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<{
    requestsMade: number;
    remainingRequests: number;
    windowMs: number;
    coolingDown: boolean;
    cooldownRemaining: number | null;
  }> {
    await this.loadState();
    this.cleanupOldRequests();

    const cooldownRemaining = this.state.coolingDown && this.state.cooldownUntil
      ? Math.max(0, this.state.cooldownUntil - Date.now())
      : null;

    return {
      requestsMade: this.state.requests.length,
      remainingRequests: Math.max(0, this.config.maxRequests - this.state.requests.length),
      windowMs: this.config.windowMs,
      coolingDown: this.state.coolingDown,
      cooldownRemaining,
    };
  }
}

/**
 * Execute a function with rate limiting
 */
export async function withRateLimit<T>(
  action: string,
  fn: () => Promise<T>,
  onLimited?: (retryAfter: number, message: string) => void
): Promise<T | null> {
  const limiter = new RateLimiter(action);
  const check = await limiter.canMakeRequest();

  if (!check.allowed) {
    onLimited?.(check.retryAfter!, check.message!);
    return null;
  }

  await limiter.recordRequest();
  return fn();
}

/**
 * Create rate limiters for common actions
 */
export const rateLimiters = {
  chat: new RateLimiter('chat'),
  ocr: new RateLimiter('ocr'),
  api: new RateLimiter('api'),
  auth: new RateLimiter('auth'),
};

export default RateLimiter;
