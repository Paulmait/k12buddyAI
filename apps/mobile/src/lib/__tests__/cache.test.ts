/**
 * Unit tests for caching utilities
 */

import { CacheManager, createCache, profileCache, sessionCache } from '../cache';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(mockStorage))),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((key) => delete mockStorage[key]);
    return Promise.resolve();
  }),
}));

describe('CacheManager', () => {
  let cache: CacheManager<{ name: string; value: number }>;

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    cache = new CacheManager<{ name: string; value: number }>({
      prefix: 'test',
      defaultTTL: 60000, // 1 minute
      maxEntries: 10,
    });
  });

  describe('set and get', () => {
    it('should store and retrieve a value', async () => {
      const data = { name: 'test', value: 42 };
      await cache.set('key1', data);
      const retrieved = await cache.get('key1');
      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should use memory cache for repeated gets', async () => {
      const data = { name: 'test', value: 42 };
      await cache.set('key1', data);

      // First get populates memory cache
      await cache.get('key1');

      // Clear storage to prove memory cache is used
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);

      // Should still get from memory
      const result = await cache.get('key1');
      expect(result).toEqual(data);
    });
  });

  describe('TTL handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return null for expired entries', async () => {
      const shortTTLCache = new CacheManager<{ value: number }>({
        prefix: 'ttl-test',
        defaultTTL: 1000, // 1 second
        maxEntries: 10,
      });

      await shortTTLCache.set('key1', { value: 1 });

      // Advance time past TTL
      jest.advanceTimersByTime(1500);

      const result = await shortTTLCache.get('key1');
      expect(result).toBeNull();
    });

    it('should respect custom TTL', async () => {
      await cache.set('short-lived', { name: 'temp', value: 1 }, 500);
      await cache.set('long-lived', { name: 'perm', value: 2 }, 5000);

      jest.advanceTimersByTime(1000);

      expect(await cache.get('short-lived')).toBeNull();
      expect(await cache.get('long-lived')).toEqual({ name: 'perm', value: 2 });
    });
  });

  describe('delete', () => {
    it('should remove entry from cache', async () => {
      await cache.set('key1', { name: 'test', value: 1 });
      expect(await cache.get('key1')).not.toBeNull();

      await cache.delete('key1');
      expect(await cache.get('key1')).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      await cache.set('key1', { name: 'test', value: 1 });
      expect(await cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      expect(await cache.has('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries with prefix', async () => {
      await cache.set('key1', { name: 'test1', value: 1 });
      await cache.set('key2', { name: 'test2', value: 2 });

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const data = { name: 'cached', value: 100 };
      await cache.set('key1', data);

      const fetchFn = jest.fn(() => Promise.resolve({ name: 'new', value: 200 }));
      const result = await cache.getOrSet('key1', fetchFn);

      expect(result).toEqual(data);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache value if not exists', async () => {
      const fetchData = { name: 'fetched', value: 300 };
      const fetchFn = jest.fn(() => Promise.resolve(fetchData));

      const result = await cache.getOrSet('new-key', fetchFn);

      expect(result).toEqual(fetchData);
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Verify it's cached
      const cached = await cache.get('new-key');
      expect(cached).toEqual(fetchData);
    });
  });
});

describe('createCache factory', () => {
  it('should create a cache with specified options', async () => {
    const customCache = createCache<string>({
      prefix: 'custom',
      defaultTTL: 30000,
      maxEntries: 5,
    });

    await customCache.set('test', 'value');
    expect(await customCache.get('test')).toBe('value');
  });
});

describe('Pre-configured caches', () => {
  it('profileCache should exist', () => {
    expect(profileCache).toBeDefined();
    expect(profileCache.set).toBeDefined();
    expect(profileCache.get).toBeDefined();
  });

  it('sessionCache should exist', () => {
    expect(sessionCache).toBeDefined();
    expect(sessionCache.set).toBeDefined();
    expect(sessionCache.get).toBeDefined();
  });
});
