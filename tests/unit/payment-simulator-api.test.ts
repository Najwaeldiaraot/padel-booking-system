import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/payment/simulate-pay/route";
import {
  extractSimulatorFormField,
  simulateMidtransQrisPayment,
} from "@/lib/midtrans";

describe("Payment Simulator API & Midtrans Helper", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      ...originalEnv,
      MIDTRANS_SERVER_KEY: "SB-Mid-server-test-key-123",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("extractSimulatorFormField", () => {
    it("extracts field when name attribute comes before value attribute", () => {
      const html = `<input type="hidden" name="referenceId" value="ref_abc123" />`;
      expect(extractSimulatorFormField(html, "referenceId")).toBe("ref_abc123");
    });

    it("extracts field when value attribute comes before name attribute", () => {
      const html = `<input type="hidden" value="exp_xyz789" name="exploreData" />`;
      expect(extractSimulatorFormField(html, "exploreData")).toBe("exp_xyz789");
    });

    it("returns null when the requested field is not present", () => {
      const html = `<input type="hidden" name="otherField" value="123" />`;
      expect(extractSimulatorFormField(html, "referenceId")).toBeNull();
    });
  });

  describe("POST /api/payment/simulate-pay - Payload Validation", () => {
    it("returns 400 when request body is not valid JSON", async () => {
      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: "invalid-json-string",
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid JSON payload");
    });

    it("returns 400 when orderId is missing", async () => {
      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("orderId is required");
    });

    it("returns 400 when orderId is empty string or non-string", async () => {
      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: JSON.stringify({ orderId: "   " }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("orderId is required");
    });
  });

  describe("POST /api/payment/simulate-pay - Error Handling", () => {
    it("returns 500 when Midtrans status check fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ status_message: "Transaction doesn't exist." }),
      } as Response);

      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: JSON.stringify({ orderId: "NON-EXISTENT-ORDER" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain("Transaction doesn't exist.");
    });

    it("returns 500 when transaction_id is missing in Midtrans status response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transaction_status: "pending" }), // no transaction_id
      } as Response);

      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: JSON.stringify({ orderId: "ORDER-NO-TXID" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain("Midtrans transaction_id tidak ditemukan");
    });

    it("returns 500 when simulator scan request fails", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ transaction_id: "tx-12345" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          statusText: "Internal Server Error",
        } as Response);

      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: JSON.stringify({ orderId: "ORDER-SCAN-FAIL" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain("Gagal melakukan scan QR ke simulator Midtrans");
    });

    it("returns 500 when simulator scan response has missing referenceId or exploreData", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ transaction_id: "tx-12345" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `<html><body><div>Invalid response without form fields</div></body></html>`,
        } as Response);

      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: JSON.stringify({ orderId: "ORDER-CORRUPT-HTML" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain("Gagal mengekstrak referenceId atau exploreData");
    });

    it("returns 500 when simulator payment submission fails", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ transaction_id: "tx-12345" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `
            <form action="/v2/qris/payment/gopay" method="POST">
              <input type="hidden" name="referenceId" value="ref-999" />
              <input type="hidden" name="exploreData" value="exp-888" />
            </form>
          `,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          statusText: "Bad Gateway",
        } as Response);

      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: JSON.stringify({ orderId: "ORDER-PAY-FAIL" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain("Gagal mengirimkan pembayaran simulator");
    });

    it("returns 500 when transaction verification after payment fails", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ transaction_id: "tx-12345" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `
            <input type="hidden" name="referenceId" value="ref-123" />
            <input type="hidden" name="exploreData" value="exp-456" />
          `,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "Payment submitted successfully",
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          statusText: "Service Unavailable",
          json: async () => ({ status_message: "Cannot verify at this moment" }),
        } as Response);

      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: JSON.stringify({ orderId: "ORDER-VERIFY-FAIL" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain("Cannot verify at this moment");
    });
  });

  describe("POST /api/payment/simulate-pay - Success Path", () => {
    it("completes full simulation flow and returns settlement status", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        // 1. Initial status query
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            transaction_id: "midtrans-tx-001",
            transaction_status: "pending",
          }),
        } as Response)
        // 2. Scan to simulator v2
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `
            <form action="/v2/qris/payment/gopay" method="POST">
              <input type="hidden" name="referenceId" value="ref-auto-01" />
              <input type="hidden" name="exploreData" value="exp-auto-02" />
            </form>
          `,
        } as Response)
        // 3. Post to simulator payment endpoint
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "OK",
        } as Response)
        // 4. Verify transaction status
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            transaction_status: "settlement",
            settlement_time: "2026-11-04 10:30:00",
            gross_amount: "150000.00",
          }),
        } as Response);

      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: JSON.stringify({ orderId: "ORDER-SUCCESS-01" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe("settlement");
      expect(data.settlementTime).toBe("2026-11-04 10:30:00");

      // Verify fetch calls
      expect(fetchSpy).toHaveBeenCalledTimes(4);

      // Verify call 1: Midtrans status query
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "https://api.sandbox.midtrans.com/v2/ORDER-SUCCESS-01/status"
      );

      // Verify call 2: QR scan to simulator v2
      expect(fetchSpy.mock.calls[1][0]).toBe(
        "https://simulator.sandbox.midtrans.com/v2/qris/payment"
      );
      const scanBody = (fetchSpy.mock.calls[1][1]?.body as string) || "";
      expect(scanBody).toContain(
        encodeURIComponent("https://api.sandbox.midtrans.com/v2/qris/midtrans-tx-001/qr-code")
      );

      // Verify call 3: Payment execution to simulator
      expect(fetchSpy.mock.calls[2][0]).toBe(
        "https://simulator.sandbox.midtrans.com/v2/qris/payment/gopay"
      );
      const payHeaders = fetchSpy.mock.calls[2][1]?.headers as Record<string, string>;
      expect(payHeaders?.["Referer"]).toBe("https://simulator.sandbox.midtrans.com/v2/qris/payment");
      const payBody = (fetchSpy.mock.calls[2][1]?.body as string) || "";
      expect(payBody).toContain("referenceId=ref-auto-01");
      expect(payBody).toContain("exploreData=exp-auto-02");
      expect(payBody).toContain("issuer=gopay");

      // Verify call 4: Final verification status query
      expect(fetchSpy.mock.calls[3][0]).toBe(
        "https://api.sandbox.midtrans.com/v2/ORDER-SUCCESS-01/status"
      );
    });

    it("supports custom issuer parameter (e.g. shopeepay)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            transaction_id: "midtrans-tx-custom-issuer",
            transaction_status: "pending",
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `
            <input type="hidden" name="referenceId" value="ref-custom-issuer" />
            <input type="hidden" name="exploreData" value="exp-custom-issuer" />
          `,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "OK",
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            transaction_status: "settlement",
            settlement_time: "2026-11-04 10:35:00",
          }),
        } as Response);

      const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
        method: "POST",
        body: JSON.stringify({
          orderId: "ORDER-CUSTOM-ISSUER",
          issuer: "shopeepay",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      const payBody = (fetchSpy.mock.calls[2][1]?.body as string) || "";
      expect(payBody).toContain("issuer=shopeepay");
    });
  });
});
