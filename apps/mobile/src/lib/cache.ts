/**
 * Caching Layer
 * Provides efficient data caching with TTL and memory/storage hybrid approach
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = 'k12buddy_cache_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh
}

// Default TTL values (in milliseconds)
export const CacheTTL = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
};

// Memory cache for fast access
const memoryCache = new Map<string, CacheEntry<unknown>>();
const MAX_MEMORY_ENTRIES = 100;

/**
 * Cache class with memory + storage backing
 */
export class Cache {
  private prefix: string;

  constructor(namespace: string = 'default') {
    this.prefix = `${CACHE_KEY_PREFIX}${namespace}_`;
  }

  /**
   * Get item from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.prefix + key;

    // Check memory cache first
    const memoryEntry = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
    if (memoryEntry) {
      if (this.isValid(memoryEntry)) {
        return memoryEntry.data;
      }
      memoryCache.delete(cacheKey);
    }

    // Check storage
    try {
      const stored = await AsyncStorage.getItem(cacheKey);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        if (this.isValid(entry)) {
          // Restore to memory cache
          memoryCache.set(cacheKey, entry);
          return entry.data;
        }
        // Expired - remove from storage
        await AsyncStorage.removeItem(cacheKey);
      }
    } catch (error) {
      console.error('Cache get error:', error);
    }

    return null;
  }

  /**
   * Set item in cache
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.prefix + key;
    const ttl = options.ttl || CacheTTL.MEDIUM;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    // Store in memory
    this.setMemoryEntry(cacheKey, entry);

    // Store in AsyncStorage
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Remove item from cache
   */
  async remove(key: string): Promise<void> {
    const cacheKey = this.prefix + key;
    memoryCache.delete(cacheKey);

    try {
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Cache remove error:', error);
    }
  }

  /**
   * Clear all items in this namespace
   */
  async clear(): Promise<void> {
    // Clear memory cache entries with this prefix
    for (const key of memoryCache.keys()) {
      if (key.startsWith(this.prefix)) {
        memoryCache.delete(key);
      }
    }

    // Clear storage entries
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => key.startsWith(this.prefix));
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get or fetch data with caching
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);

    if (cached !== null) {
      // If staleWhileRevalidate, refresh in background
      if (options.staleWhileRevalidate) {
        this.refreshInBackground(key, fetcher, options);
      }
      return cached;
    }

    // Fetch fresh data
    const data = await fetcher();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Check if entry is still valid
   */
  private isValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Set entry in memory cache with LRU eviction
   */
  private setMemoryEntry<T>(key: string, entry: CacheEntry<T>): void {
    // Evict oldest entries if at capacity
    if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
      const oldestKey = memoryCache.keys().next().value;
      if (oldestKey) {
        memoryCache.delete(oldestKey);
      }
    }

    memoryCache.set(key, entry);
  }

  /**
   * Refresh data in background without blocking
   */
  private async refreshInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    try {
      const data = await fetcher();
      await this.set(key, data, options);
    } catch (error) {
      // Silently fail background refresh
      console.debug('Background cache refresh failed:', error);
    }
  }
}

// Pre-configured caches for different data types
export const caches = {
  // User data cache (longer TTL)
  user: new Cache('user'),

  // Gamification data cache
  gamification: new Cache('gamification'),

  // API response cache
  api: new Cache('api'),

  // Temporary data cache (short TTL)
  temp: new Cache('temp'),
};

/**
 * Cache wrapper for API calls
 */
export async function cachedFetch<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = { ttl: CacheTTL.MEDIUM }
): Promise<T> {
  return caches.api.getOrFetch(cacheKey, fetchFn, options);
}

/**
 * Invalidate specific cache entries
 */
export async function invalidateCache(
  namespace: 'user' | 'gamification' | 'api' | 'temp',
  key?: string
): Promise<void> {
  const cache = caches[namespace];

  if (key) {
    await cache.remove(key);
  } else {
    await cache.clear();
  }
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  await Promise.all([
    caches.user.clear(),
    caches.gamification.clear(),
    caches.api.clear(),
    caches.temp.clear(),
  ]);
  memoryCache.clear();
}

export default Cache;
