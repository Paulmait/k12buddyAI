/**
 * Performance Optimization Utilities
 * Implements lazy loading, memoization, and performance monitoring
 */

import React, { lazy, Suspense, ComponentType } from 'react';
import { InteractionManager, View, ActivityIndicator, StyleSheet } from 'react-native';

// ============ Lazy Loading ============

/**
 * Create a lazy-loaded component with fallback
 */
export function createLazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  LoadingComponent?: ComponentType
): ComponentType<P> {
  const LazyComponent = lazy(importFn);

  const Fallback = LoadingComponent || DefaultLoadingFallback;

  return function LazyWrapper(props: P) {
    return (
      <Suspense fallback={<Fallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  } as ComponentType<P>;
}

function DefaultLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="small" color="#6366F1" />
    </View>
  );
}

// ============ Deferred Execution ============

/**
 * Run code after interactions complete (better UX)
 */
export function runAfterInteractions<T>(callback: () => T): Promise<T> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      resolve(callback());
    });
  });
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, waitMs);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastRun >= limitMs) {
      func(...args);
      lastRun = now;
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        func(...args);
        lastRun = Date.now();
        timeoutId = null;
      }, limitMs - (now - lastRun));
    }
  };
}

// ============ Memoization ============

/**
 * Simple memoization with LRU cache
 */
export function memoize<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  maxSize: number = 100
): T {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();

  return function memoized(...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      const entry = cache.get(key)!;
      entry.timestamp = Date.now();
      return entry.value;
    }

    const result = func(...args);

    // Evict oldest entries if cache is full
    if (cache.size >= maxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      cache.forEach((entry, k) => {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = k;
        }
      });

      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, { value: result, timestamp: Date.now() });
    return result;
  } as T;
}

/**
 * Async memoization with TTL
 */
export function memoizeAsync<T extends (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>>(
  func: T,
  ttlMs: number = 60000
): T {
  const cache = new Map<string, { value: Awaited<ReturnType<T>>; expiresAt: number }>();

  return async function memoizedAsync(...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    const key = JSON.stringify(args);
    const now = Date.now();

    if (cache.has(key)) {
      const entry = cache.get(key)!;
      if (entry.expiresAt > now) {
        return entry.value;
      }
      cache.delete(key);
    }

    const result = await func(...args);
    cache.set(key, { value: result, expiresAt: now + ttlMs });
    return result;
  } as T;
}

// ============ Performance Monitoring ============

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

const metrics: PerformanceMetric[] = [];
const MAX_METRICS = 100;

/**
 * Start measuring a performance metric
 */
export function startMeasure(name: string): () => number {
  const metric: PerformanceMetric = {
    name,
    startTime: Date.now(),
  };

  return () => {
    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;

    // Add to metrics array
    metrics.push(metric);

    // Trim old metrics
    if (metrics.length > MAX_METRICS) {
      metrics.splice(0, metrics.length - MAX_METRICS);
    }

    return metric.duration;
  };
}

/**
 * Measure an async operation
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const endMeasure = startMeasure(name);
  const result = await operation();
  const duration = endMeasure();

  return { result, duration };
}

/**
 * Get performance metrics summary
 */
export function getPerformanceMetrics(): {
  metrics: PerformanceMetric[];
  averages: Record<string, number>;
} {
  const averages: Record<string, { total: number; count: number }> = {};

  for (const metric of metrics) {
    if (metric.duration !== undefined) {
      if (!averages[metric.name]) {
        averages[metric.name] = { total: 0, count: 0 };
      }
      averages[metric.name].total += metric.duration;
      averages[metric.name].count += 1;
    }
  }

  const averageMap: Record<string, number> = {};
  for (const [name, { total, count }] of Object.entries(averages)) {
    averageMap[name] = Math.round(total / count);
  }

  return { metrics: [...metrics], averages: averageMap };
}

/**
 * Clear performance metrics
 */
export function clearPerformanceMetrics(): void {
  metrics.length = 0;
}

// ============ List Optimization ============

/**
 * Window function for virtualized lists
 */
export function getItemLayout(
  itemHeight: number,
  separatorHeight: number = 0
) {
  return (_data: unknown, index: number) => ({
    length: itemHeight + separatorHeight,
    offset: (itemHeight + separatorHeight) * index,
    index,
  });
}

/**
 * Key extractor for lists
 */
export function createKeyExtractor<T>(idField: keyof T = 'id' as keyof T) {
  return (item: T, index: number): string => {
    const id = item[idField];
    return id ? String(id) : `item-${index}`;
  };
}

// ============ Memory Management ============

/**
 * Check if running low on memory (simple heuristic)
 */
let lastGCHint = 0;
export function suggestGC(): void {
  const now = Date.now();
  // Only suggest GC every 30 seconds
  if (now - lastGCHint > 30000) {
    lastGCHint = now;
    // Clear caches that might be large
    if (typeof global.gc === 'function') {
      global.gc();
    }
  }
}

/**
 * Create a disposable resource pattern
 */
export function createDisposable<T>(
  create: () => T,
  dispose: (resource: T) => void
): { use: <R>(fn: (resource: T) => R) => R } {
  return {
    use<R>(fn: (resource: T) => R): R {
      const resource = create();
      try {
        return fn(resource);
      } finally {
        dispose(resource);
      }
    },
  };
}

// ============ Batch Operations ============

/**
 * Batch multiple operations together
 */
export async function batchOperations<T>(
  items: T[],
  operation: (item: T) => Promise<void>,
  batchSize: number = 10,
  delayMs: number = 0
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(operation));

    if (delayMs > 0 && i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Process items with concurrency limit
 */
export async function processWithLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  limit: number = 5
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = processor(item).then((result) => {
      results.push(result);
    });

    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      // Remove completed promises
      executing.splice(
        0,
        executing.length,
        ...executing.filter((e) => {
          let isResolved = false;
          e.then(() => (isResolved = true)).catch(() => (isResolved = true));
          return !isResolved;
        })
      );
    }
  }

  await Promise.all(executing);
  return results;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default {
  createLazyComponent,
  runAfterInteractions,
  debounce,
  throttle,
  memoize,
  memoizeAsync,
  startMeasure,
  measureAsync,
  getPerformanceMetrics,
  clearPerformanceMetrics,
  getItemLayout,
  createKeyExtractor,
  suggestGC,
  createDisposable,
  batchOperations,
  processWithLimit,
};
