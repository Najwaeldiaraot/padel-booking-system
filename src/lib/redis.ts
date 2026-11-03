import { Redis } from "@upstash/redis"

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

// Create real Upstash client if credentials exist, otherwise provide in-memory fallback for offline/local development
export const redis =
  url && token
    ? new Redis({ url, token })
    : {
        // In-memory fallback
        _store: new Map<string, { value: unknown; expiresAt: number }>(),
        async set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }) {
          const now = Date.now()
          const existing = this._store.get(key)
          if (opts?.nx && existing && existing.expiresAt > now) {
            return null // Not set
          }
          const expiresAt = opts?.ex ? now + opts.ex * 1000 : Infinity
          this._store.set(key, { value, expiresAt })
          return "OK"
        },
        async get<T>(key: string): Promise<T | null> {
          const item = this._store.get(key)
          if (!item) return null
          if (Date.now() > item.expiresAt) {
            this._store.delete(key)
            return null
          }
          return item.value as T
        },
        async del(key: string): Promise<number> {
          return this._store.delete(key) ? 1 : 0
        },
        async keys(pattern: string): Promise<string[]> {
          const now = Date.now()
          const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$")
          const matched: string[] = []
          for (const [k, v] of this._store.entries()) {
            if (v.expiresAt > now && regex.test(k)) {
              matched.push(k)
            }
          }
          return matched
        },
        async ping(): Promise<string> {
          return "PONG"
        },
      }
