import IORedis from "ioredis"

const REDIS_ENABLED = process.env.REDIS_ENABLED !== "false"

// ─── Pipeline wrapper ─────────────────────────────────────────────────────────
// ioredis pipeline.exec() returns [Error|null, T][] — this wrapper flattens it
// to T[] so existing route code (which indexes results directly) still works.

type PipelineResult = string | number | null

class PipelineWrapper {
  private p: ReturnType<IORedis["pipeline"]>

  constructor(p: ReturnType<IORedis["pipeline"]>) {
    this.p = p
  }

  incr(key: string): this {
    this.p.incr(key)
    return this
  }

  expire(key: string, seconds: number, nx?: "NX"): this {
    if (nx) {
      this.p.expire(key, seconds, "NX")
    } else {
      this.p.expire(key, seconds)
    }
    return this
  }

  get(key: string): this {
    this.p.get(key)
    return this
  }

  async exec(): Promise<PipelineResult[]> {
    const results = await this.p.exec()
    if (!results) return []
    return results.map(([, val]) => val as PipelineResult)
  }
}

// ─── Redis wrapper ────────────────────────────────────────────────────────────
// Exposes the same interface used across lib/ and route files so no other file
// needs to change when switching from @upstash/redis to local ioredis.

class RedisWrapper {
  private client: IORedis

  constructor(client: IORedis) {
    this.client = client
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key)
      if (value === null) return null
      try {
        return JSON.parse(value) as T
      } catch {
        return value as unknown as T
      }
    } catch {
      return null
    }
  }

  async set(key: string, value: unknown, opts?: { ex?: number }): Promise<void> {
    try {
      const str = typeof value === "string" ? value : JSON.stringify(value)
      if (opts?.ex) {
        await this.client.set(key, str, "EX", opts.ex)
      } else {
        await this.client.set(key, str)
      }
    } catch {
      // fail-open
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return
    try {
      await this.client.del(...keys)
    } catch {
      // fail-open
    }
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    try {
      return await this.client.mget(...keys)
    } catch {
      return keys.map(() => null)
    }
  }

  pipeline(): PipelineWrapper {
    return new PipelineWrapper(this.client.pipeline())
  }
}

// ─── Client singleton ─────────────────────────────────────────────────────────

function createRedisClient(): RedisWrapper | null {
  if (!REDIS_ENABLED) return null
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    const client = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    })
    client.on("error", () => {
      // silence connection errors — app degrades gracefully without Redis
    })
    return new RedisWrapper(client)
  } catch {
    return null
  }
}

const globalForRedis = globalThis as unknown as { __redis: RedisWrapper | null | undefined }

export const redis: RedisWrapper | null =
  globalForRedis.__redis !== undefined
    ? globalForRedis.__redis
    : (globalForRedis.__redis = createRedisClient())

if (process.env.NODE_ENV !== "production") {
  globalForRedis.__redis = redis
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null
  return redis.get<T>(key)
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return
  await redis.set(key, value, { ex: ttlSeconds })
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return
  await redis.del(...keys)
}

export async function cacheWrap<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  if (redis) {
    try {
      const cached = await redis.get<T>(key)
      if (cached !== null) return cached
    } catch {
      // fall through to loader
    }
  }

  const value = await loader()

  if (value !== null && value !== undefined && redis) {
    await redis.set(key, value, { ex: ttlSeconds })
  }

  return value
}
