/**
 * Security Utilities
 * Implements security best practices for K-12 application
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// ============ Secure Storage ============

/**
 * Securely store sensitive data
 */
export async function secureStore(key: string, value: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch (error) {
    console.error('Secure store error:', error);
    return false;
  }
}

/**
 * Retrieve securely stored data
 */
export async function secureRetrieve(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error('Secure retrieve error:', error);
    return null;
  }
}

/**
 * Delete securely stored data
 */
export async function secureDelete(key: string): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch (error) {
    console.error('Secure delete error:', error);
    return false;
  }
}

// ============ Input Sanitization ============

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Only allow https URLs
    if (parsed.protocol !== 'https:') {
      return null;
    }

    // Block javascript: protocol attempts
    if (url.toLowerCase().includes('javascript:')) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

// ============ Hash & Encryption ============

/**
 * Generate a cryptographically secure random string
 */
export async function generateSecureRandom(length: number = 32): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(length);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a string using SHA-256
 */
export async function hashString(input: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
}

/**
 * Generate device fingerprint for session binding
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const timestamp = Date.now().toString();
  const random = await generateSecureRandom(16);
  return await hashString(`${timestamp}-${random}`);
}

// ============ Session Security ============

const SESSION_TOKEN_KEY = 'session_token';
const DEVICE_ID_KEY = 'device_id';

/**
 * Store session token securely
 */
export async function storeSessionToken(token: string): Promise<boolean> {
  return await secureStore(SESSION_TOKEN_KEY, token);
}

/**
 * Retrieve session token
 */
export async function getSessionToken(): Promise<string | null> {
  return await secureRetrieve(SESSION_TOKEN_KEY);
}

/**
 * Clear session token on logout
 */
export async function clearSessionToken(): Promise<boolean> {
  return await secureDelete(SESSION_TOKEN_KEY);
}

/**
 * Get or create device ID for tracking
 */
export async function getDeviceId(): Promise<string> {
  let deviceId = await secureRetrieve(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = await generateSecureRandom(32);
    await secureStore(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

// ============ Rate Limiting Helpers ============

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitCache = new Map<string, RateLimitEntry>();

/**
 * Check if action is rate limited
 */
export function isRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = rateLimitCache.get(key);

  if (!entry) {
    rateLimitCache.set(key, { count: 1, firstRequest: now });
    return false;
  }

  if (now - entry.firstRequest > windowMs) {
    // Window expired, reset
    rateLimitCache.set(key, { count: 1, firstRequest: now });
    return false;
  }

  if (entry.count >= maxRequests) {
    return true;
  }

  entry.count++;
  return false;
}

// ============ COPPA Compliance ============

/**
 * Check if user is under 13 (COPPA)
 */
export function isUnder13(birthDate: Date): boolean {
  const today = new Date();
  const thirteenYearsAgo = new Date(
    today.getFullYear() - 13,
    today.getMonth(),
    today.getDate()
  );
  return birthDate > thirteenYearsAgo;
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * Validate parental consent token
 */
export async function validateParentalConsent(
  token: string,
  expectedHash: string
): Promise<boolean> {
  const tokenHash = await hashString(token);
  return tokenHash === expectedHash;
}

// ============ Data Privacy ============

/**
 * Anonymize user ID for analytics
 */
export async function anonymizeUserId(userId: string): Promise<string> {
  // Salt with app-specific value
  const salt = 'k12buddy_analytics_salt_v1';
  return await hashString(`${salt}:${userId}`);
}

/**
 * Remove PII from object before logging
 */
export function removePII<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const piiFields = [
    'email',
    'password',
    'phone',
    'address',
    'ssn',
    'name',
    'displayName',
    'birthDate',
    'parentEmail',
  ];

  const cleaned: Partial<T> = { ...obj };

  for (const field of piiFields) {
    if (field in cleaned) {
      delete cleaned[field as keyof T];
    }
  }

  return cleaned;
}

// ============ Security Validation ============

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check for common password patterns
 */
export function isCommonPassword(password: string): boolean {
  const commonPatterns = [
    '123456',
    'password',
    'qwerty',
    'abc123',
    'letmein',
    'welcome',
    'monkey',
    'dragon',
    'master',
    'login',
  ];

  const lowerPassword = password.toLowerCase();
  return commonPatterns.some((pattern) => lowerPassword.includes(pattern));
}

export default {
  secureStore,
  secureRetrieve,
  secureDelete,
  sanitizeInput,
  sanitizeObject,
  sanitizeUrl,
  generateSecureRandom,
  hashString,
  generateDeviceFingerprint,
  storeSessionToken,
  getSessionToken,
  clearSessionToken,
  getDeviceId,
  isRateLimited,
  isUnder13,
  calculateAge,
  validateParentalConsent,
  anonymizeUserId,
  removePII,
  validatePassword,
  validateEmail,
  isCommonPassword,
};
