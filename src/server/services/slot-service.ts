import { redis } from "@/lib/redis";

export interface SlotIdentifier {
  courtId: string | number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm e.g. "19:00"
}

export interface SlotLockRecord {
  courtId: string | number;
  date: string;
  startTime: string;
  userId: string;
  lockedAt: number;
  expiresAt: number;
}

export type SlotSSEEvent =
  | { type: "LOCKED"; data: SlotLockRecord }
  | { type: "RELEASED"; data: SlotIdentifier }
  | { type: "BOOKED"; data: SlotIdentifier };

type SSEListener = (event: SlotSSEEvent) => void;
const sseListeners = new Set<SSEListener>();

export function subscribeToSlotEvents(listener: SSEListener) {
  sseListeners.add(listener);
  return () => {
    sseListeners.delete(listener);
  };
}

export function broadcastSlotEvent(event: SlotSSEEvent) {
  for (const listener of sseListeners) {
    try {
      listener(event);
    } catch (e) {
      console.error("[SSE] Failed to send event to listener:", e);
    }
  }
}

function getLockKey(courtId: string | number, date: string, startTime: string) {
  return `padel:slot_lock:${courtId}:${date}:${startTime}`;
}

export async function acquireSlotLock(
  courtId: string | number,
  date: string,
  startTime: string,
  userId: string,
  ttlSeconds: number = 600 // 10 minutes default
): Promise<{ success: boolean; lock?: SlotLockRecord; message?: string }> {
  const key = getLockKey(courtId, date, startTime);
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;

  const record: SlotLockRecord = {
    courtId,
    date,
    startTime,
    userId,
    lockedAt: now,
    expiresAt,
  };

  try {
    // 1. Atomic NX lock attempt
    const setResult = await redis.set(key, JSON.stringify(record), {
      nx: true,
      ex: ttlSeconds,
    });

    if (setResult === "OK") {
      // Successfully acquired new lock
      broadcastSlotEvent({ type: "LOCKED", data: record });
      return { success: true, lock: record };
    }

    // 2. If NX failed, check if it was locked by the SAME user (re-entrant / refresh)
    const existing = await redis.get<string | SlotLockRecord>(key);
    if (existing) {
      let parsed: SlotLockRecord;
      if (typeof existing === "string") {
        try {
          parsed = JSON.parse(existing);
        } catch {
          parsed = { courtId, date, startTime, userId: String(existing), lockedAt: 0, expiresAt: 0 };
        }
      } else {
        parsed = existing;
      }

      if (parsed.userId === userId) {
        // Refresh lock for same user
        await redis.set(key, JSON.stringify(record), { ex: ttlSeconds });
        return { success: true, lock: record };
      }
    }

    // Locked by someone else
    return {
      success: false,
      message: "Slot waktu ini sedang dipilih/dikunci oleh pengguna lain.",
    };
  } catch (error) {
    console.warn("[SlotLock] Redis error, operating in resilient mode:", error);
    return { success: true, lock: record };
  }
}

export async function releaseSlotLock(
  courtId: string | number,
  date: string,
  startTime: string,
  userId?: string
): Promise<boolean> {
  const key = getLockKey(courtId, date, startTime);
  try {
    if (userId) {
      const existing = await redis.get<string | SlotLockRecord>(key);
      if (existing) {
        const parsed = typeof existing === "string" ? JSON.parse(existing) : existing;
        if (parsed.userId && parsed.userId !== userId) {
          return false; // Can only release own lock
        }
      }
    }

    await redis.del(key);
    broadcastSlotEvent({
      type: "RELEASED",
      data: { courtId, date, startTime },
    });
    return true;
  } catch (error) {
    console.error("[SlotLock] Failed to release slot lock:", error);
    return false;
  }
}

export async function getActiveSlotLocks(date?: string): Promise<SlotLockRecord[]> {
  try {
    const pattern = date ? `padel:slot_lock:*:${date}:*` : "padel:slot_lock:*";
    const keys = await redis.keys(pattern);
    if (!keys || keys.length === 0) return [];

    const records: SlotLockRecord[] = [];
    for (const key of keys) {
      const raw = await redis.get<string | SlotLockRecord>(key);
      if (raw) {
        if (typeof raw === "string") {
          try {
            records.push(JSON.parse(raw));
          } catch {
            // ignore malformed
          }
        } else {
          records.push(raw);
        }
      }
    }
    return records;
  } catch (error) {
    console.warn("[SlotLock] Failed to get active locks from Redis:", error);
    return [];
  }
}
