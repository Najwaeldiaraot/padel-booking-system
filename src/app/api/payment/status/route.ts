import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { midtransConfig, isRealMidtransConfigured } from "@/lib/midtrans";
import { processMidtransWebhook } from "@/server/services/payment-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId query parameter is required" },
        { status: 400 }
      );
    }

    // 1. Check current booking in Supabase
    const booking = await prisma.booking.findFirst({
      where: {
        OR: [{ id: orderId }, { code: orderId }],
      },
      include: { payment: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found", status: "not_found" },
        { status: 404 }
      );
    }

    if (booking.status === "CONFIRMED") {
      return NextResponse.json({
        status: "confirmed",
        orderId: booking.id,
        bookingCode: booking.code,
      });
    }

    // 2. Query Midtrans API directly if configured
    if (isRealMidtransConfigured) {
      try {
        const authHeader = `Basic ${Buffer.from(`${midtransConfig.serverKey}:`).toString("base64")}`;
        const baseUrl = midtransConfig.isProduction
          ? "https://api.midtrans.com/v2"
          : "https://api.sandbox.midtrans.com/v2";

        const res = await fetch(`${baseUrl}/${booking.id}/status`, {
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          const txStatus = data.transaction_status;

          // If paid/settled in Midtrans, process transition immediately
          if (
            txStatus === "settlement" ||
            (txStatus === "capture" && data.fraud_status === "accept")
          ) {
            await processMidtransWebhook({
              order_id: booking.id,
              status_code: data.status_code || "200",
              gross_amount: data.gross_amount || `${booking.totalPrice}.00`,
              signature_key: data.signature_key || "simulated",
              transaction_status: "settlement",
              payment_type: data.payment_type || "qris",
            });

            return NextResponse.json({
              status: "confirmed",
              orderId: booking.id,
              bookingCode: booking.code,
              midtransStatus: txStatus,
            });
          }

          if (txStatus === "expire") {
            return NextResponse.json({
              status: "expired",
              orderId: booking.id,
              midtransStatus: "expire",
              message: "Transaksi QRIS di Midtrans telah kedaluwarsa.",
            });
          }

          return NextResponse.json({
            status: "pending",
            orderId: booking.id,
            midtransStatus: txStatus,
            expiryTime: data.expiry_time,
          });
        }
      } catch (err) {
        console.warn("[API Payment Status] Midtrans fetch warning:", err);
      }
    }

    return NextResponse.json({
      status: booking.status.toLowerCase(),
      orderId: booking.id,
      bookingCode: booking.code,
    });
  } catch (error: any) {
    console.error("[API Payment Status] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check payment status" },
      { status: 500 }
    );
  }
}
