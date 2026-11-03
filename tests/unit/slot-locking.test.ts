import { describe, it, expect } from "vitest";
import {
  acquireSlotLock,
  releaseSlotLock,
  subscribeToSlotEvents,
  type SlotSSEEvent,
} from "@/server/services/slot-service";

describe("Atomic Slot Locking & Concurrency Engine", () => {
  it("acquires lock and blocks concurrent user from locking the same slot", async () => {
    const slot = {
      courtId: 1,
      date: "2026-11-10",
      startTime: "19:00",
    };

    // User A locks the slot
    const lockUserA = await acquireSlotLock(
      slot.courtId,
      slot.date,
      slot.startTime,
      "user_A"
    );
    expect(lockUserA.success).toBe(true);
    expect(lockUserA.lock?.userId).toBe("user_A");

    // User B tries to lock the EXACT same slot concurrently -> Must be rejected
    const lockUserB = await acquireSlotLock(
      slot.courtId,
      slot.date,
      slot.startTime,
      "user_B"
    );
    expect(lockUserB.success).toBe(false);
    expect(lockUserB.message).toContain("sedang dipilih/dikunci oleh pengguna lain");

    // User A refreshes/re-acquires own lock -> Must succeed
    const lockUserARefresh = await acquireSlotLock(
      slot.courtId,
      slot.date,
      slot.startTime,
      "user_A"
    );
    expect(lockUserARefresh.success).toBe(true);

    // User B cannot release User A's lock
    const failedRelease = await releaseSlotLock(
      slot.courtId,
      slot.date,
      slot.startTime,
      "user_B"
    );
    expect(failedRelease).toBe(false);

    // User A releases lock -> Must succeed
    const successfulRelease = await releaseSlotLock(
      slot.courtId,
      slot.date,
      slot.startTime,
      "user_A"
    );
    expect(successfulRelease).toBe(true);

    // Now User B can acquire the slot
    const lockUserBAfterRelease = await acquireSlotLock(
      slot.courtId,
      slot.date,
      slot.startTime,
      "user_B"
    );
    expect(lockUserBAfterRelease.success).toBe(true);

    // Cleanup
    await releaseSlotLock(slot.courtId, slot.date, slot.startTime, "user_B");
  });

  it("broadcasts SSE real-time events when slot is locked and released", async () => {
    const receivedEvents: SlotSSEEvent[] = [];
    const unsubscribe = subscribeToSlotEvents((event) => {
      receivedEvents.push(event);
    });

    const slot = {
      courtId: 2,
      date: "2026-11-10",
      startTime: "20:00",
    };

    await acquireSlotLock(slot.courtId, slot.date, slot.startTime, "user_tester");
    await releaseSlotLock(slot.courtId, slot.date, slot.startTime, "user_tester");

    unsubscribe();

    expect(receivedEvents.length).toBeGreaterThanOrEqual(2);
    expect(receivedEvents.some((e) => e.type === "LOCKED")).toBe(true);
    expect(receivedEvents.some((e) => e.type === "RELEASED")).toBe(true);
  });
});
