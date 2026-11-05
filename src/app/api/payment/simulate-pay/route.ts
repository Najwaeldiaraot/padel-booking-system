import { NextResponse } from "next/server";
import { simulateMidtransQrisPayment } from "@/lib/midtrans";
import { processMidtransWebhook } from "@/server/services/payment-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const { orderId, issuer = "gopay" } = body || {};

    if (!orderId || typeof orderId !== "string" || orderId.trim() === "") {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    const result = await simulateMidtransQrisPayment(orderId.trim(), issuer);

    // If payment is settled, update booking in Supabase database immediately
    if (result.status === "settlement") {
      try {
        await processMidtransWebhook({
          order_id: orderId.trim(),
          status_code: "200",
          gross_amount: result.grossAmount || "0.00",
          signature_key: "simulated",
          transaction_status: "settlement",
          payment_type: "qris",
        });
      } catch (webhookError) {
        console.warn("[Simulate Pay API] Webhook update warning:", webhookError);
      }
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      settlementTime: result.settlementTime,
    });
  } catch (error: any) {
    console.error("[Simulate Pay API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to simulate payment" },
      { status: 500 }
    );
  }
}
