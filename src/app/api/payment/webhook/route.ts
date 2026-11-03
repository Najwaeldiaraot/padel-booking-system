import { NextResponse } from "next/server";
import { processMidtransWebhook } from "@/server/services/payment-service";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const result = await processMidtransWebhook(payload);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Midtrans Webhook] Error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 400 }
    );
  }
}
