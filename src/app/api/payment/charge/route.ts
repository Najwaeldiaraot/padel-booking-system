import { NextResponse } from "next/server";
import { processMidtransPaymentCharge } from "@/server/services/payment-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, grossAmount, customerDetails, itemDetails, paymentType } = body;

    if (!orderId || !grossAmount) {
      return NextResponse.json(
        { error: "orderId and grossAmount are required" },
        { status: 400 }
      );
    }

    const result = await processMidtransPaymentCharge({
      orderId,
      grossAmount: Number(grossAmount),
      customerDetails,
      itemDetails,
      paymentType,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API Payment Charge] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment transaction" },
      { status: 500 }
    );
  }
}
