import { test, expect } from "@playwright/test";

test.describe("05. Admin Court Maintenance & Management", () => {
  test("creates and deletes a court maintenance block", async ({ request }) => {
    const testCourtId = 2;
    const testDate = "2026-11-25";
    const startTime = "10:00";
    const endTime = "12:00";

    // 1. Create maintenance block
    const blockRes = await request.post("/api/admin/blocks", {
      data: {
        courtId: testCourtId,
        date: testDate,
        startTime,
        endTime,
        reason: "Perawatan jaring dan kaca E2E test",
      },
    });

    expect(blockRes.ok()).toBeTruthy();
    const blockData = await blockRes.json();
    expect(blockData.id).toBeDefined();

    // 2. Verify availability endpoint reflects this block
    const availRes = await request.get(`/api/availability?date=${testDate}`);
    expect(availRes.ok()).toBeTruthy();
    const busySlots = await availRes.json();
    const isBlocked = busySlots.some(
      (slot: any) =>
        slot.court === testCourtId &&
        slot.date === testDate &&
        slot.time === startTime &&
        slot.kind === "block"
    );
    expect(isBlocked).toBeTruthy();

    // 3. Verify user booking is blocked with 409 Conflict on this slot
    const bookAttemptRes = await request.post("/api/bookings", {
      data: {
        courtId: testCourtId,
        date: testDate,
        startTime,
        durationHours: 1,
        customerName: "Impatient Player",
        customerContact: "08123456789",
      },
    });
    expect(bookAttemptRes.status()).toBe(409);
    const bookAttemptData = await bookAttemptRes.json();
    expect(bookAttemptData.error).toContain("pemeliharaan");

    // 4. Clean up by deleting the block
    const deleteRes = await request.delete(`/api/admin/blocks?id=${blockData.id}`);
    expect(deleteRes.ok()).toBeTruthy();
  });
});
