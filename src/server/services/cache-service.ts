import { redis } from "@/lib/redis";

const CACHE_TTL = 300; // 5 minutes TTL for non-sensitive data

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get<string | T>(`padel:cache:${key}`);
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return raw as unknown as T;
      }
    }
    return raw as T;
  } catch (err) {
    console.warn(`[Redis Cache GET] ${key} error:`, err);
    return null;
  }
}

export async function setCachedData<T>(key: string, data: T, ttlSeconds: number = CACHE_TTL): Promise<void> {
  try {
    await redis.set(`padel:cache:${key}`, JSON.stringify(data), { ex: ttlSeconds });
  } catch (err) {
    console.warn(`[Redis Cache SET] ${key} error:`, err);
  }
}

export async function invalidateCache(key: string): Promise<void> {
  try {
    await redis.del(`padel:cache:${key}`);
  } catch (err) {
    console.warn(`[Redis Cache DEL] ${key} error:`, err);
  }
}
