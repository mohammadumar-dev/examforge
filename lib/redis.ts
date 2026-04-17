import Redis from "ioredis"

const REDIS_ENABLED = process.env.REDIS_ENABLED !== "false"
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379"

function createRedisClient(): Redis | null {
  if (!REDIS_ENABLED) return null
  try {
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      // Silently fail — never block exam if Redis is down
      reconnectOnError: () => true,
    })
    client.on("error", () => {
      // Swallow errors — fail-open
    })
    return client
  } catch {
    return null
  }
}

const globalForRedis = globalThis as unknown as { __redis: Redis | null | undefined }

export const redis: Redis | null =
  globalForRedis.__redis !== undefined
    ? globalForRedis.__redis
    : (globalForRedis.__redis = createRedisClient())

if (process.env.NODE_ENV !== "production") {
  globalForRedis.__redis = redis
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    const val = await redis.get(key)
    if (!val) return null
    return JSON.parse(val) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds)
  } catch {
    // fail-open
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return
  try {
    await redis.del(...keys)
  } catch {
    // fail-open
  }
}

/**
 * Read-through cache: return cached value if present, otherwise call loader,
 * cache the result, and return it. Falls through to loader if Redis is down.
 */
export async function cacheWrap<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  if (redis) {
    try {
      const cached = await redis.get(key)
      if (cached) return JSON.parse(cached) as T
    } catch {
      // fall through to loader
    }
  }

  const value = await loader()

  if (value !== null && value !== undefined && redis) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds)
    } catch {
      // fail-open
    }
  }

  return value
}
