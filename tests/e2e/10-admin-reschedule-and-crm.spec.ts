import { test, expect } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";

test.describe("10. Advanced Admin Scenarios: Reschedule, Collision, Double Check-in & CRM", () => {
  test("1. Admin Reschedule Success: Moves match to free slot, releases old slot & records history", async ({ request }) => {
    const randomDate = `2026-12-${String(Math.floor(10 + Math.random() * 15)).padStart(2, "0")}`;

    // Create confirmed booking on Court 1, 09:00
    const booking = await prisma.booking.create({
      data: {
        code: `RLY-RES-${Date.now().toString().slice(-6)}`,
        courtId: 1,
        date: randomDate,
        startTime: "09:00",
        durationHours: 1,
        totalPrice: 250000,
        customerName: "Flexible Player",
        customerContact: "08111222333",
        status: "CONFIRMED",
      },
    });

    // Move to Court 2, 14:00
    const rescheduleRes = await request.patch(`/api/bookings/${booking.id}`, {
      data: {
        action: "reschedule",
        court: 2,
        date: randomDate,
        time: "14:00",
        bypassAuth: true,
      },
    });

    expect(rescheduleRes.ok()).toBeTruthy();
    const updated = await rescheduleRes.json();
    expect(updated.courtId).toBe(2);
    expect(updated.startTime).toBe("14:00");
    expect(updated.rescheduleCount).toBe(1);

    // Verify history recorded the move
    const history = await prisma.bookingHistory.findFirst({
      where: { bookingId: booking.id, action: "rescheduled" },
    });
    expect(history).not.toBeNull();
    expect(history?.note).toContain("09:00");
    expect(history?.note).toContain("14:00");

    // Clean up
    await prisma.booking.delete({ where: { id: booking.id } });
  });

  test("2. Admin Reschedule Collision: Rejects moving to an already occupied slot (409 Conflict)", async ({ request }) => {
    const randomDate = `2026-12-${String(Math.floor(10 + Math.random() * 15)).padStart(2, "0")}`;

    // Booking A at Court 1, 15:00
    const bookingA = await prisma.booking.create({
      data: {
        code: `RLY-A-${Date.now().toString().slice(-6)}`,
        courtId: 1,
        date: randomDate,
        startTime: "15:00",
        durationHours: 1,
        totalPrice: 250000,
        customerName: "Player Alpha",
        customerContact: "08111111111",
        status: "CONFIRMED",
      },
    });

    // Booking B at Court 1, 10:00
    const bookingB = await prisma.booking.create({
      data: {
        code: `RLY-B-${Date.now().toString().slice(-6)}`,
        courtId: 1,
        date: randomDate,
        startTime: "10:00",
        durationHours: 1,
        totalPrice: 250000,
        customerName: "Player Beta",
        customerContact: "08222222222",
        status: "CONFIRMED",
      },
    });

    // Attempt to move Booking B to 15:00 (already occupied by Booking A)
    const collisionRes = await request.patch(`/api/bookings/${bookingB.id}`, {
      data: {
        action: "reschedule",
        court: 1,
        date: randomDate,
        time: "15:00",
        bypassAuth: true,
      },
    });

    expect(collisionRes.status()).toBe(409);
    const errData = await collisionRes.json();
    expect(errData.error).toContain("telah dipesan");

    // Clean up
    await prisma.booking.deleteMany({
      where: { id: { in: [bookingA.id, bookingB.id] } },
    });
  });

  test("3. Admin Reschedule Maintenance Collision: Rejects moving to a slot under court block", async ({ request }) => {
    const randomDate = `2026-12-${String(Math.floor(10 + Math.random() * 15)).padStart(2, "0")}`;

    // Create court maintenance block on Court 3, 16:00 - 18:00
    const block = await prisma.courtBlock.create({
      data: {
        courtId: 3,
        date: randomDate,
        startTime: "16:00",
        endTime: "18:00",
        reason: "Penggantian lampu sorot",
      },
    });

    // Create booking on Court 3, 08:00
    const booking = await prisma.booking.create({
      data: {
        code: `RLY-MNT-${Date.now().toString().slice(-6)}`,
        courtId: 3,
        date: randomDate,
        startTime: "08:00",
        durationHours: 1,
        totalPrice: 250000,
        customerName: "Player Gamma",
        customerContact: "08333333333",
        status: "CONFIRMED",
      },
    });

    // Attempt to reschedule to 16:00 (under maintenance)
    const mntRes = await request.patch(`/api/bookings/${booking.id}`, {
      data: {
        action: "reschedule",
        court: 3,
        date: randomDate,
        time: "16:00",
        bypassAuth: true,
      },
    });

    expect(mntRes.status()).toBe(409);
    const mntData = await mntRes.json();
    expect(mntData.error).toContain("pemeliharaan");

    // Clean up
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.courtBlock.delete({ where: { id: block.id } });
  });

  test("4. Double Check-in Prevention: Rejects second check-in attempt on already checked-in ticket", async ({ request }) => {
    const randomDate = `2026-12-${String(Math.floor(10 + Math.random() * 15)).padStart(2, "0")}`;

    const booking = await prisma.booking.create({
      data: {
        code: `RLY-CHK-${Date.now().toString().slice(-6)}`,
        courtId: 1,
        date: randomDate,
        startTime: "18:00",
        durationHours: 1,
        totalPrice: 250000,
        customerName: "Eager Player",
        customerContact: "08444444444",
        status: "CONFIRMED",
      },
    });

    // 1st Check-in -> SUCCESS
    const firstCheckin = await request.patch(`/api/bookings/${booking.id}`, {
      data: { action: "checkin" },
    });
    expect(firstCheckin.ok()).toBeTruthy();

    // 2nd Check-in (duplicate scan attempt) -> MUST BE REJECTED
    const duplicateCheckin = await request.patch(`/api/bookings/${booking.id}`, {
      data: { action: "checkin" },
    });
    expect(duplicateCheckin.status()).toBe(400);
    const dupErr = await duplicateCheckin.json();
    expect(dupErr.error).toContain("CHECKED_IN");

    // Clean up
    await prisma.booking.delete({ where: { id: booking.id } });
  });

  test("5. Unknown Barcode Scan: Returns 404 for non-existent ticket code", async ({ request }) => {
    const fakeCode = "RLY-UNKNOWN-CODE-9999";
    const res = await request.patch(`/api/bookings/${fakeCode}`, {
      data: { action: "checkin" },
    });
    expect(res.status()).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("not found");
  });

  test("6. Customer CRM API: Lists customers and resists SQL/malformed query injection", async ({ request }) => {
    // Normal query
    const listRes = await request.get("/api/admin/customers");
    expect(listRes.ok()).toBeTruthy();
    const customers = await listRes.json();
    expect(Array.isArray(customers)).toBeTruthy();

    // Malicious injection attempt in search query
    const injectionQuery = "' OR '1'='1' -- ";
    const safeRes = await request.get(`/api/admin/customers?search=${encodeURIComponent(injectionQuery)}`);
    expect(safeRes.ok()).toBeTruthy();
    const safeData = await safeRes.json();
    expect(Array.isArray(safeData)).toBeTruthy();
  });
});
