import { describe, it, expect } from "vitest";
import {
  generateMidtransSignature,
  verifyMidtransSignature,
} from "@/lib/midtrans";
import { processMidtransWebhook } from "@/server/services/payment-service";

describe("Midtrans Payment Gateway & Webhook Security", () => {
  it("generates and verifies SHA512 signature correctly", () => {
    const orderId = "ORDER-PADEL-101";
    const statusCode = "200";
    const grossAmount = "150000.00";

    const signature = generateMidtransSignature(orderId, statusCode, grossAmount);
    expect(signature).toBeDefined();
    expect(typeof signature).toBe("string");
    expect(signature.length).toBe(128); // SHA512 hex string length is 128 chars

    const isValid = verifyMidtransSignature(orderId, statusCode, grossAmount, signature);
    expect(isValid).toBe(true);

    const isTampered = verifyMidtransSignature(
      orderId,
      statusCode,
      grossAmount,
      "fake_tampered_signature"
    );
    expect(isTampered).toBe(false);
  });

  it("processes settlement webhook and enforces idempotency", async () => {
    const orderId = `TEST-ORDER-${Date.now()}`;
    const statusCode = "200";
    const grossAmount = "200000.00";
    const signature = generateMidtransSignature(orderId, statusCode, grossAmount);

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: "settlement" as const,
    };

    // First call: Should succeed
    const firstCall = await processMidtransWebhook(payload);
    expect(firstCall.status).toBe("SUCCESS");
    expect(firstCall.bookingState).toBe("CONFIRMED");

    // Second call with same payload: Idempotent duplicate, should return ALREADY_PROCESSED
    const secondCall = await processMidtransWebhook(payload);
    expect(secondCall.status).toBe("ALREADY_PROCESSED");
  });
});
