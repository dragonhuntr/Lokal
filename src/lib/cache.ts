/**
 * Simple in-memory cache utility with TTL (Time To Live) support
 * Provides caching and memoization helpers for performance optimization
 */

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();

  /**
   * Set a value in the cache with optional TTL in milliseconds
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set(key: string, value: T, ttl: number = 5 * 60 * 1000): void {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns The cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Check if a key exists and is not expired
   * @param key - Cache key
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key from cache
   * @param key - Cache key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of entries in cache (including expired ones)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries from cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton cache instances for common use cases
export const apiCache = new Cache<unknown>();
export const routeCache = new Cache<unknown>();
export const vehicleCache = new Cache<unknown>();

/**
 * Memoize a function with cache support
 * @param fn - Function to memoize
 * @param keyFn - Function to generate cache key from arguments
 * @param ttl - Time to live in milliseconds
 */
export function memoize<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn | Promise<TReturn>,
  keyFn: (...args: TArgs) => string = (...args) => JSON.stringify(args),
  ttl: number = 5 * 60 * 1000
): (...args: TArgs) => TReturn | Promise<TReturn> {
  const cache = new Cache<TReturn>();

  return (...args: TArgs): TReturn | Promise<TReturn> => {
    const key = keyFn(...args);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);

    // Handle both sync and async functions
    if (result instanceof Promise) {
      return result.then((resolved) => {
        cache.set(key, resolved, ttl);
        return resolved;
      });
    } else {
      cache.set(key, result, ttl);
      return result;
    }
  };
}

/**
 * Cache decorator for async functions
 * @param ttl - Time to live in milliseconds
 */
export function cached(ttl: number = 5 * 60 * 1000) {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value as T;
    const cache = new Cache<unknown>();

    descriptor.value = async function (...args: unknown[]) {
      const key = `${propertyKey}_${JSON.stringify(args)}`;
      const cached = cache.get(key);

      if (cached !== undefined) {
        return cached;
      }

      const result = await originalMethod.apply(this, args);
      cache.set(key, result, ttl);
      return result;
    };

    return descriptor;
  };
}

/**
 * Create a cache with automatic cleanup interval
 * @param cleanupInterval - Interval in milliseconds to run cleanup (default: 1 minute)
 */
export function createAutoCleanupCache<T>(
  cleanupInterval: number = 60 * 1000
): Cache<T> {
  const cache = new Cache<T>();

  // Set up automatic cleanup
  const interval = setInterval(() => {
    cache.cleanup();
  }, cleanupInterval);

  // Cleanup on process exit
  if (typeof process !== 'undefined') {
    process.on('beforeExit', () => {
      clearInterval(interval);
      cache.clear();
    });
  }

  return cache;
}

/**
 * Invalidate cache entries by pattern
 * @param cache - Cache instance
 * @param pattern - RegExp pattern to match keys
 */
export function invalidateByPattern<T>(
  cache: Cache<T>,
  pattern: RegExp
): number {
  let count = 0;
  // Note: This requires accessing private cache property
  // In production, you might want to add a public method to Cache class
  const cacheInternal = cache as Cache<T> & { cache: Map<string, CacheEntry<T>> };

  for (const key of cacheInternal.cache.keys()) {
    if (pattern.test(key)) {
      cache.delete(key);
      count++;
    }
  }

  return count;
}

export { Cache };
export type { CacheEntry };
