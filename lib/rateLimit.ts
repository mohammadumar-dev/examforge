import { redis } from "./redis";
import { CacheKeys } from "./cacheKeys";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-process fallback when Redis is unavailable
const store = new Map<string, RateLimitEntry>();

function inMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  if (!redis) {
    return inMemoryRateLimit(key, maxRequests, windowMs);
  }

  const redisKey = CacheKeys.rate(key);
  const windowSec = Math.ceil(windowMs / 1000);
  const now = Date.now();
  const resetAt = now + windowMs;

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, windowSec, "NX"); // only set TTL on first INCR
    const results = await pipeline.exec();

    const count = (results?.[0]?.[1] as number) ?? 1;
    const remaining = Math.max(0, maxRequests - count);
    const success = count <= maxRequests;

    return { success, remaining, resetAt };
  } catch {
    return inMemoryRateLimit(key, maxRequests, windowMs);
  }
}

export function getClientIp(req: Request): string {
  const forwarded = (req as Request & { headers: Headers }).headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
