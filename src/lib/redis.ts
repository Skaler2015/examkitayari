import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Redis is optional in development. If REDIS_URL is not set or the connection
 * fails, callers should degrade gracefully (the queue falls back to the
 * database-backed AutomationJob table, and caching becomes a no-op).
 */

let client: Redis | null = null;
let attempted = false;

export function getRedis(): Redis | null {
  if (attempted) return client;
  attempted = true;
  if (!env.redisUrl) {
    logger.warn("REDIS_URL not set — running without Redis (degraded cache/queue).");
    return null;
  }
  try {
    client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 200, 3000),
    });
    client.on("error", (err) => logger.error("Redis error", { err: String(err) }));
    return client;
  } catch (err) {
    logger.error("Failed to init Redis", { err: String(err) });
    client = null;
    return null;
  }
}

// Simple JSON cache helpers with graceful fallback.
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const v = await r.get(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* ignore */
  }
}

export async function cacheDel(pattern: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const keys = await r.keys(pattern);
    if (keys.length) await r.del(...keys);
  } catch {
    /* ignore */
  }
}
