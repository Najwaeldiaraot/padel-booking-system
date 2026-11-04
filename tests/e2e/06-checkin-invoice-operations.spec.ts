import { test, expect } from "@playwright/test";
import crypto from "crypto";
import fs from "fs";
import path from "path";

function getServerKey(): string {
  try {
    const envFile = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
    const match = envFile.match(/MIDTRANS_SERVER_KEY=["']?([^"'\r\n]+)["']?/);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

test.describe("06. Check-in, Invoice & Live Operations Lifecycle", () => {
  test("performs customer check-in and finishes session via API", async ({ request }) => {
    // 1. Create a booking directly via API on a clean future slot
    const testDate = `2026-12-${String(Math.floor(10 + Math.random() * 18)).padStart(2, "0")}`;
    const randomHour = String(Math.floor(8 + Math.random() * 12)).padStart(2, "0");
    const createRes = await request.post("/api/bookings", {
      data: {
        courtId: 1,
        date: testDate,
        startTime: `${randomHour}:00`,
        durationHours: 1,
        customerName: "Budi Santoso",
        customerContact: "08123456789",
        totalPrice: 250000,
      },
    });

    expect(createRes.ok()).toBeTruthy();
    const booking = await createRes.json();
    expect(booking.id).toBeDefined();
    expect(booking.code).toMatch(/^RLY-[A-Z0-9]{6}$/);

    // Settle booking so it is CONFIRMED via webhook
    const orderId = booking.id;
    const serverKey = getServerKey();
    const statusCode = "200";
    const grossAmount = "250000.00";
    const signatureKey = serverKey
      ? crypto
          .createHash("sha512")
          .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
          .digest("hex")
      : "simulated";

    const webhookRes = await request.post("/api/payment/webhook", {
      data: {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signatureKey,
        transaction_status: "settlement",
        fraud_status: "accept",
        payment_type: "qris",
      },
    });
    expect(webhookRes.ok()).toBeTruthy();

    // 2. Perform Check-in via Admin Checkin API
    const checkinRes = await request.patch(`/api/bookings/${booking.id}`, {
      data: { action: "checkin" },
    });
    expect(checkinRes.ok()).toBeTruthy();
    const checkinData = await checkinRes.json();
    expect(checkinData.status).toBe("CHECKED_IN");
    expect(checkinData.checkedInAt).toBeDefined();

    // 3. Complete playing session via Admin Complete API
    const completeRes = await request.patch(`/api/bookings/${booking.id}`, {
      data: { action: "complete" },
    });
    expect(completeRes.ok()).toBeTruthy();
    const completeData = await completeRes.json();
    expect(completeData.status).toBe("COMPLETED");
  });
});
