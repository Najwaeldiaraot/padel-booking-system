import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function getServerKey() {
  if (process.env.MIDTRANS_SERVER_KEY) return process.env.MIDTRANS_SERVER_KEY;
  try {
    const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
    const match = envContent.match(/MIDTRANS_SERVER_KEY=["']?([^"'\r\n]+)/);
    if (match) return match[1];
  } catch {}
  return "";
}

test.describe("04. Midtrans Payment & Webhook Lifecycle", () => {
  test("generates Midtrans Snap charge token and settles booking via webhook", async ({ request }) => {
    const testOrderId = `TEST-E2E-${Date.now()}`;
    const amount = 300000;

    // 1. Charge creation
    const chargeRes = await request.post("/api/payment/charge", {
      data: {
        orderId: testOrderId,
        grossAmount: amount,
        customerDetails: {
          first_name: "E2E Tester",
          email: "e2e@padel.test",
          phone: "08123456789",
        },
        itemDetails: [
          {
            id: "court-1",
            price: amount,
            quantity: 1,
            name: "Sewa Lapangan Panoramic 60m",
          },
        ],
      },
    });

    expect(chargeRes.ok()).toBeTruthy();
    const chargeData = await chargeRes.json();
    expect(chargeData.token).toBeDefined();

    // 2. Midtrans Webhook notification
    const serverKey = getServerKey();
    const statusCode = "200";
    const grossAmount = `${amount}.00`;
    const signatureKey = serverKey
      ? crypto
          .createHash("sha512")
          .update(`${testOrderId}${statusCode}${grossAmount}${serverKey}`)
          .digest("hex")
      : "simulated";

    const webhookRes = await request.post("/api/payment/webhook", {
      data: {
        order_id: testOrderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signatureKey,
        transaction_status: "settlement",
        fraud_status: "accept",
        payment_type: "qris",
      },
    });

    expect(webhookRes.ok()).toBeTruthy();
    const webhookData = await webhookRes.json();
    expect(webhookData.bookingState).toBe("CONFIRMED");
    expect(webhookData.status).toBe("SUCCESS");
  });

  test("generates valid EMVCo QRIS string compliant with Midtrans Simulator", async ({ request }) => {
    const testOrderId = `TEST-QRIS-${Date.now()}`;
    const amount = 220000;

    const chargeRes = await request.post("/api/payment/charge", {
      data: {
        orderId: testOrderId,
        grossAmount: amount,
        paymentType: "qris",
        customerDetails: {
          first_name: "QRIS Tester",
          email: "muhammadrafki718@gmail.com",
        },
      },
    });

    expect(chargeRes.ok()).toBeTruthy();
    const chargeData = await chargeRes.json();
    expect(chargeData.qrString).toBeDefined();

    // Must be valid EMVCo QRIS format starting with 00020101
    expect(chargeData.qrString.startsWith("00020101")).toBeTruthy();
    // Currency IDR 360 & Country ID
    expect(chargeData.qrString).toContain("5303360");
    expect(chargeData.qrString).toContain("5802ID");
  });

  test("checks payment status endpoint /api/payment/status", async ({ request }) => {
    // 1. Check with non-existent order
    const notFoundRes = await request.get("/api/payment/status?orderId=NON_EXISTENT_ORDER_9999");
    expect(notFoundRes.status()).toBe(404);
    const notFoundData = await notFoundRes.json();
    expect(notFoundData.status).toBe("not_found");

    // 2. Create a real booking to check pending status
    const testDate = `2026-11-${Math.floor(10 + Math.random() * 18)}`;
    const createRes = await request.post("/api/bookings", {
      data: {
        courtId: 1,
        date: testDate,
        startTime: "16:00",
        durationHours: 1,
        customerName: "Status Tester",
        customerContact: "081234567890",
        totalPrice: 250000,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const booking = await createRes.json();

    // Check status for this booking
    const statusRes = await request.get(`/api/payment/status?orderId=${booking.id}`);
    expect(statusRes.ok()).toBeTruthy();
    const statusData = await statusRes.json();
    expect(statusData.orderId).toBe(booking.id);
    expect(["hold", "pending", "pending_payment"]).toContain(statusData.status);
  });
});
