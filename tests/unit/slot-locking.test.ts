import { describe, it, expect } from "vitest";
import { getCourtAvailability } from "../../src/app/club";
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

  it("prevents double-booking when court is currently played (checked_in / Sedang Bermain)", () => {
    const mockClub = {
      openHour: 7,
      closeHour: 22,
      courtOptions: [{ id: 1, name: "Court 1", active: true, price: 250000, type: "Outdoor" }],
    };

    // Simulate active game: Court 1, 08:00 - 09:00 (duration: 60) on 2026-11-04
    const busySlots = [
      {
        court: 1,
        date: "2026-11-04",
        time: "08:00",
        duration: 60,
        kind: "booking",
        bookingId: "RLY-FCMMVG",
      },
    ];

    // Reference time: 06:30 WIB on 2026-11-04 (before opening)
    const refNow = new Date("2026-11-04T06:30:00+07:00").getTime();

    const { slots, canSelect } = getCourtAvailability({
      club: mockClub,
      court: 1,
      date: "2026-11-04",
      duration: 60,
      busy: busySlots,
      now: refNow,
    });

    const slot0700Index = slots.indexOf("07:00");
    const slot0800Index = slots.indexOf("08:00");
    const slot0830Index = slots.indexOf("08:30");
    const slot0900Index = slots.indexOf("09:00");

    // 07:00 - 08:00 is free and should be selectable
    expect(canSelect(slot0700Index)).toBe(true);

    // 08:00 - 09:00 is occupied by active game -> MUST BE BLOCKED
    expect(canSelect(slot0800Index)).toBe(false);

    // 08:30 - 09:30 overlaps with active game (ends at 09:00) -> MUST BE BLOCKED
    expect(canSelect(slot0830Index)).toBe(false);

    // 09:00 - 10:00 is after the game ends -> SHOULD BE SELECTABLE
    expect(canSelect(slot0900Index)).toBe(true);

    // Now test at 07:45 WIB (after 07:30 has passed):
    // 07:00 and 07:30 are disabled because they are in the past.
    // 08:00 and 08:30 MUST ALSO be disabled because the game is active/in progress.
    const now0745 = new Date("2026-11-04T07:45:00+07:00").getTime();
    const result0745 = getCourtAvailability({
      club: mockClub,
      court: 1,
      date: "2026-11-04",
      duration: 60,
      busy: busySlots,
      now: now0745,
    });
    expect(result0745.canSelect(slot0700Index)).toBe(false);
    expect(result0745.canSelect(slot0800Index)).toBe(false);
    expect(result0745.canSelect(slot0830Index)).toBe(false);
    expect(result0745.canSelect(slot0900Index)).toBe(true);
  });
});
