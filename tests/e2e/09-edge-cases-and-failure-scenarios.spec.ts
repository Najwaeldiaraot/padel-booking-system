import { test, expect } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import { redis } from "../../src/lib/redis";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function getServerKey(): string {
  try {
    const envFile = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
    const match = envFile.match(/MIDTRANS_SERVER_KEY=["']?([^"'\r\n]+)["']?/);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

test.describe("09. Edge Cases & High-Risk Failure Scenarios", () => {
  test("1. High-Concurrency: 3 simultaneous players booking the exact same court and slot", async ({ request }) => {
    // Pick an unoccupied future slot in December
    const testDate = `2026-12-${String(Math.floor(10 + Math.random() * 18)).padStart(2, "0")}`;
    const testHour = "11:00";
    const courtId = 2;

    // Send 3 simultaneous booking requests in parallel
    const [resA, resB, resC] = await Promise.all([
      request.post("/api/bookings", {
        data: {
          courtId,
          date: testDate,
          startTime: testHour,
          durationHours: 1,
          customerName: "Contender Alpha",
          customerContact: "08111111111",
          totalPrice: 275000,
        },
      }),
      request.post("/api/bookings", {
        data: {
          courtId,
          date: testDate,
          startTime: testHour,
          durationHours: 1,
          customerName: "Contender Beta",
          customerContact: "08222222222",
          totalPrice: 275000,
        },
      }),
      request.post("/api/bookings", {
        data: {
          courtId,
          date: testDate,
          startTime: testHour,
          durationHours: 1,
          customerName: "Contender Gamma",
          customerContact: "08333333333",
          totalPrice: 275000,
        },
      }),
    ]);

    const statuses = [resA.status(), resB.status(), resC.status()];
    const successCount = statuses.filter((s) => s === 201 || s === 200).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    // Exactly 1 must succeed and the other 2 must receive 409 Conflict
    expect(successCount).toBe(1);
    expect(conflictCount).toBe(2);

    // Verify in database: Only 1 active booking exists for this slot
    const countInDb = await prisma.booking.count({
      where: {
        courtId,
        date: testDate,
        startTime: testHour,
        status: { in: ["HOLD", "PENDING_PAYMENT", "CONFIRMED"] },
      },
    });
    expect(countInDb).toBe(1);
  });

  test("2. Late Check-in: Rejects check-in when match schedule has already ended", async ({ request }) => {
    // 1. Create a confirmed booking with an old date (yesterday)
    const pastDate = "2026-10-01";
    const pastBooking = await prisma.booking.create({
      data: {
        code: `RLY-EXP-${Date.now().toString().slice(-6)}`,
        courtId: 1,
        date: pastDate,
        startTime: "09:00",
        durationHours: 1,
        totalPrice: 250000,
        customerName: "Late Comer Player",
        customerContact: "081234567890",
        status: "CONFIRMED",
      },
    });

    // 2. Attempt check-in without bypass -> MUST be rejected with SCHEDULE_EXPIRED
    const checkinRes = await request.patch(`/api/bookings/${pastBooking.id}`, {
      data: { action: "checkin" },
    });

    expect(checkinRes.status()).toBe(400);
    const errData = await checkinRes.json();
    expect(errData.code).toBe("SCHEDULE_EXPIRED");
    expect(errData.error).toContain("telah berakhir");

    // 3. With admin emergency bypass flag -> succeeds
    const bypassRes = await request.patch(`/api/bookings/${pastBooking.id}`, {
      data: { action: "checkin", bypassExpired: true },
    });
    expect(bypassRes.ok()).toBeTruthy();
    const bypassData = await bypassRes.json();
    expect(bypassData.status).toBe("CHECKED_IN");

    // Clean up
    await prisma.booking.delete({ where: { id: pastBooking.id } });
  });

  test("3. Invalid Status Transition: Prevents check-in on cancelled or unconfirmed booking", async ({ request }) => {
    // Create cancelled booking
    const cancelledBooking = await prisma.booking.create({
      data: {
        code: `RLY-CANC-${Date.now().toString().slice(-6)}`,
        courtId: 1,
        date: "2026-12-28",
        startTime: "14:00",
        durationHours: 1,
        totalPrice: 250000,
        customerName: "Cancelled Player",
        customerContact: "081234567890",
        status: "CANCELLED",
        cancelReason: "Hujan deras",
      },
    });

    // Attempt check-in on cancelled booking
    const checkinAttempt = await request.patch(`/api/bookings/${cancelledBooking.id}`, {
      data: { action: "checkin" },
    });
    expect(checkinAttempt.status()).toBe(400);
    const errJson = await checkinAttempt.json();
    expect(errJson.error).toContain("CANCELLED");

    // Clean up
    await prisma.booking.delete({ where: { id: cancelledBooking.id } });
  });

  test("4. Hold Timeout & Re-acquisition: Allows new player to claim expired slot", async ({ request }) => {
    const testDate = `2026-12-${String(Math.floor(20 + Math.random() * 8)).padStart(2, "0")}`;
    const testHour = "15:00";
    const courtId = 3;

    // Create a booking with an expired HOLD timestamp (5 minutes in the past)
    const expiredHold = await prisma.booking.create({
      data: {
        code: `RLY-HLD-${Date.now().toString().slice(-6)}`,
        courtId,
        date: testDate,
        startTime: testHour,
        durationHours: 1,
        totalPrice: 300000,
        customerName: "Indecisive Player",
        customerContact: "089999999999",
        status: "EXPIRED",
        holdExpiresAt: new Date(Date.now() - 300000), // expired 5 mins ago
      },
    });

    // New player books the same slot
    const newBookingRes = await request.post("/api/bookings", {
      data: {
        courtId,
        date: testDate,
        startTime: testHour,
        durationHours: 1,
        customerName: "Decisive Player",
        customerContact: "087777777777",
        totalPrice: 300000,
      },
    });

    expect(newBookingRes.ok()).toBeTruthy();
    const newBooking = await newBookingRes.json();
    expect(newBooking.id).not.toBe(expiredHold.id);

    // Clean up
    await prisma.booking.deleteMany({
      where: { id: { in: [expiredHold.id, newBooking.id] } },
    });
  });

  test("5. Midtrans Webhook Replay & Idempotency: Protects against duplicate settlement notifications", async ({ request }) => {
    const testOrderId = `REPLAY-${Date.now()}`;
    const amount = 250000;

    // Create a real booking for this order
    const booking = await prisma.booking.create({
      data: {
        id: testOrderId,
        code: `RLY-${Date.now().toString().slice(-6)}`,
        courtId: 1,
        date: "2026-12-29",
        startTime: "10:00",
        durationHours: 1,
        totalPrice: amount,
        customerName: "Idempotent Player",
        customerContact: "081234567890",
        status: "HOLD",
      },
    });

    const serverKey = getServerKey();
    const statusCode = "200";
    const grossAmount = `${amount}.00`;
    const signatureKey = serverKey
      ? crypto
          .createHash("sha512")
          .update(`${testOrderId}${statusCode}${grossAmount}${serverKey}`)
          .digest("hex")
      : "simulated";

    const webhookPayload = {
      order_id: testOrderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: "settlement" as const,
      fraud_status: "accept" as const,
      payment_type: "qris",
    };

    // 1st Webhook delivery -> SUCCESS
    const firstDelivery = await request.post("/api/payment/webhook", {
      data: webhookPayload,
    });
    expect(firstDelivery.ok()).toBeTruthy();
    const firstResult = await firstDelivery.json();
    expect(firstResult.status).toBe("SUCCESS");

    // 2nd Webhook delivery (exact replay) -> ALREADY_PROCESSED
    const secondDelivery = await request.post("/api/payment/webhook", {
      data: webhookPayload,
    });
    expect(secondDelivery.ok()).toBeTruthy();
    const secondResult = await secondDelivery.json();
    expect(secondResult.status).toBe("ALREADY_PROCESSED");

    // Clean up
    await prisma.booking.delete({ where: { id: booking.id } });
  });

  test("6. OTP Brute-Force Rate Limiting: Locks out challenge after 5 consecutive failed attempts", async ({ request }) => {
    const email = `brute.force.${Date.now()}@rallypadel.test`;

    // 1. Register challenge
    const regRes = await request.post("/api/auth/register", {
      data: {
        name: "Target Player",
        identifier: email,
        password: "TestPassword123!",
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const { challengeId } = await regRes.json();

    // 2. Submit 4 wrong OTP codes
    for (let i = 1; i <= 4; i++) {
      const wrongRes = await request.post("/api/auth/verify-otp", {
        data: {
          challengeId,
          code: "999999", // wrong code
        },
      });
      expect(wrongRes.status()).toBe(400);
      const wrongData = await wrongRes.json();
      expect(wrongData.remaining).toBe(5 - i);
    }

    // 3. 5th wrong attempt -> MUST trigger lockout
    const fifthAttempt = await request.post("/api/auth/verify-otp", {
      data: {
        challengeId,
        code: "999999",
      },
    });
    expect(fifthAttempt.status()).toBe(400);
    const fifthData = await fifthAttempt.json();
    expect(fifthData.error).toContain("Terlalu banyak percobaan");

    // 4. Verify session is wiped from Redis
    const redisCheck = await redis.get(`otp_reg:${challengeId}`);
    expect(redisCheck).toBeNull();
  });

  test("7. Session Security: Rejects forged or tampered session token cookies", async ({ request }) => {
    // Attempt /api/auth/me with forged cookie
    const forgedToken = "forged.token.payload.with.invalid.hmac.signature";
    const meRes = await request.get("/api/auth/me", {
      headers: {
        Cookie: `padel_session=${forgedToken}`,
      },
    });

    expect(meRes.status()).toBe(401);
    const meData = await meRes.json();
    expect(meData.authenticated).toBe(false);
  });

  test("8. Input Validation: Rejects malformed or negative booking parameters", async ({ request }) => {
    // Missing required customer name & court
    const badRes = await request.post("/api/bookings", {
      data: {
        date: "2026-12-15",
        startTime: "10:00",
      },
    });
    expect(badRes.status()).toBe(400);
    const badJson = await badRes.json();
    expect(badJson.error).toBeDefined();
  });
});
