/**
 * Redis client singleton with ioredis
 * Provides caching utilities with graceful fallback to direct API calls
 */

import Redis from "ioredis";

// Redis client singleton
let redisClient: Redis | null = null;
let redisAvailable = true;
let shutdownInProgress = false;

/**
 * Validate and parse Redis URL
 * @param url - Redis connection URL
 * @returns Validated URL string
 * @throws Error if URL is invalid
 */
function validateAndParseRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
      throw new Error(`Invalid Redis protocol: ${parsed.protocol}. Use redis:// or rediss://`);
    }

    const port = parsed.port ? parseInt(parsed.port, 10) : 6379;
    if (port < 1 || port > 65535) {
      throw new Error(`Invalid Redis port: ${port}`);
    }

    return url;
  } catch (error) {
    throw new Error(`Invalid REDIS_URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get or create Redis client singleton
 * Gracefully handles connection errors
 */
export function getRedisClient(): Redis | null {
  if (!redisAvailable) {
    return null;
  }

  if (!redisClient) {
    try {
      const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

      const validatedUrl = validateAndParseRedisUrl(redisUrl);

      console.log(`[Redis] Connecting to ${validatedUrl.replace(/:[^:@]+@/, ':****@')}`);

      redisClient = new Redis(validatedUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          // Reconnect after a delay
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        enableReadyCheck: true,
        lazyConnect: false,
        // Connection pooling configuration
        enableOfflineQueue: true,
        connectTimeout: 10000,
      });

      redisClient.on("error", (error) => {
        console.error("[Redis] Connection error:", error.message);
        // Mark Redis as unavailable but don't crash
        redisAvailable = false;
      });

      redisClient.on("connect", () => {
        console.log("[Redis] Connected successfully");
        redisAvailable = true;
      });

      redisClient.on("ready", () => {
        console.log("[Redis] Client ready");
        redisAvailable = true;
      });

      redisClient.on("reconnecting", () => {
        console.log("[Redis] Reconnecting...");
      });

      redisClient.on("close", () => {
        console.log("[Redis] Connection closed");
      });
    } catch (error) {
      console.error("[Redis] Failed to initialize client:", error);
      redisAvailable = false;
      redisClient = null;
    }
  }

  return redisClient;
}

/**
 * Generic cache helper with cache-aside pattern
 * Checks cache -> fetches if miss -> stores in cache
 * Falls back to direct API call if Redis is unavailable
 *
 * @param key - Cache key
 * @param fetcher - Function to fetch data if cache miss
 * @param ttl - Time to live in seconds
 * @returns Cached or freshly fetched data
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const client = getRedisClient();

  if (!client) {
    return await fetcher();
  }

  try {
    // Check connection state immediately before use
    if (client.status !== 'ready') {
      console.warn(`[Redis] Client not ready (${client.status}), fetching directly: ${key}`);
      return await fetcher();
    }

    const cached = await client.get(key);

    if (cached) {
      try {
        console.log(`[Redis] Cache hit: ${key}`);
        return JSON.parse(cached) as T;
      } catch (parseError) {
        console.error(`[Redis] Failed to parse cached data for ${key}:`, parseError);
        await client.del(key).catch(console.error);
      }
    }

    console.log(`[Redis] Cache miss: ${key}`);
    const data = await fetcher();

    // Check again before writing
    if (client.status === 'ready') {
      try {
        const serialized = JSON.stringify(data);

        if (serialized.length > 100 * 1024 * 1024) {
          console.warn(`[Redis] Data too large to cache (${serialized.length} bytes): ${key}`);
        } else {
          await client.setex(key, ttl, serialized);
        }
      } catch (serializeError) {
        console.error(`[Redis] Failed to serialize data for ${key}:`, serializeError);
      }
    }

    return data;
  } catch (error) {
    console.error(`[Redis] Error in getCached for key ${key}:`, error);
    return await fetcher();
  }
}

/**
 * Cache data with jittered TTL to prevent thundering herd problem
 * @param key - Cache key
 * @param fetcher - Function to fetch data on cache miss
 * @param ttl - Base TTL in seconds
 * @param jitterPercent - Percentage of jitter to add (default: 10%)
 */
export async function getCachedWithJitter<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  jitterPercent = 10
): Promise<T> {
  const jitter = ttl * (jitterPercent / 100) * (Math.random() * 2 - 1);
  const adjustedTtl = Math.max(1, Math.floor(ttl + jitter));

  return getCached(key, fetcher, adjustedTtl);
}

/**
 * Delete a key from cache
 * @param key - Cache key to delete
 */
export async function deleteCached(key: string): Promise<void> {
  const client = getRedisClient();

  if (!client || !redisAvailable) {
    return;
  }

  try {
    await client.del(key);
    console.log(`[Redis] Deleted key: ${key}`);
  } catch (error) {
    console.error(`[Redis] Error deleting key ${key}:`, error);
  }
}

/**
 * Delete multiple keys matching a pattern
 * @param pattern - Pattern to match (e.g., "departures:*")
 */
export async function deletePattern(pattern: string): Promise<void> {
  const client = getRedisClient();

  if (!client || !redisAvailable) {
    return;
  }

  try {
    const stream = client.scanStream({
      match: pattern,
      count: 100
    });

    const keysToDelete: string[] = [];

    stream.on('data', (keys: string[]) => {
      keysToDelete.push(...keys);

      if (keysToDelete.length >= 100) {
        const batch = keysToDelete.splice(0, 100);
        client.del(...batch).catch((error) => {
          console.error(`[Redis] Error deleting batch:`, error);
        });
      }
    });

    stream.on('end', () => {
      if (keysToDelete.length > 0) {
        client.del(...keysToDelete).catch((error) => {
          console.error(`[Redis] Error deleting final batch:`, error);
        });
      }
      console.log(`[Redis] Deleted keys matching pattern: ${pattern}`);
    });

    stream.on('error', (error) => {
      console.error(`[Redis] Error scanning pattern ${pattern}:`, error);
    });
  } catch (error) {
    console.error(`[Redis] Error deleting pattern ${pattern}:`, error);
  }
}

/**
 * Gracefully disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (!redisClient || shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;

  try {
    await Promise.race([
      redisClient.quit(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Disconnect timeout')), 5000)
      )
    ]);
    console.log("[Redis] Client disconnected gracefully");
  } catch (error) {
    console.error("[Redis] Error during disconnect:", error);
    redisClient.disconnect();
  } finally {
    redisClient = null;
    shutdownInProgress = false;
  }
}

// Cleanup on process termination
if (typeof process !== "undefined") {
  const shutdown = (signal: string) => {
    if (shutdownInProgress) return;

    console.log(`${signal} received, disconnecting Redis...`);

    disconnectRedis()
      .catch(console.error)
      .finally(() => {
        process.exit(0);
      });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}
