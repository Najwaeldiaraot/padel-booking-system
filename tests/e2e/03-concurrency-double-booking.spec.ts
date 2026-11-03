import { test, expect } from "@playwright/test";

test.describe("03. Concurrency & Double-Booking Protection (Upstash Redis)", () => {
  test("prevents two simultaneous users from acquiring the same court slot", async ({ request }) => {
    const testCourtId = 1;
    const testDate = "2026-11-20";
    const testSlot = "17:00";
    const userA = "player_concurrency_a";
    const userB = "player_concurrency_b";

    // First ensure slot is clean
    await request.post("/api/slots/lock", {
      data: {
        courtId: testCourtId,
        date: testDate,
        startTime: testSlot,
        userId: userA,
        action: "release",
      },
    });

    // Launch 2 concurrent lock requests simultaneously
    const [resA, resB] = await Promise.all([
      request.post("/api/slots/lock", {
        data: {
          courtId: testCourtId,
          date: testDate,
          startTime: testSlot,
          userId: userA,
          action: "acquire",
        },
      }),
      request.post("/api/slots/lock", {
        data: {
          courtId: testCourtId,
          date: testDate,
          startTime: testSlot,
          userId: userB,
          action: "acquire",
        },
      }),
    ]);

    const statusA = resA.status();
    const statusB = resB.status();

    // Exactly one must succeed (200) and one must be rejected (409)
    const successCount = (statusA === 200 ? 1 : 0) + (statusB === 200 ? 1 : 0);
    const conflictCount = (statusA === 409 ? 1 : 0) + (statusB === 409 ? 1 : 0);

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);

    // Clean up: release lock
    await request.post("/api/slots/lock", {
      data: {
        courtId: testCourtId,
        date: testDate,
        startTime: testSlot,
        userId: statusA === 200 ? userA : userB,
        action: "release",
      },
    });
  });
});
