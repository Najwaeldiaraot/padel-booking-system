import {
  createSnapTransaction,
  createQrisTransaction,
  verifyMidtransSignature,
  type MidtransChargeParams,
  midtransConfig,
} from "@/lib/midtrans";
import { releaseSlotLock } from "./slot-service";
import { prisma } from "@/lib/prisma";
import { sendBookingInvoiceEmail } from "./email-service";
import { decryptPII } from "@/lib/encryption";

export interface MidtransWebhookPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status:
    | "capture"
    | "settlement"
    | "pending"
    | "deny"
    | "cancel"
    | "expire"
    | "refund";
  fraud_status?: "accept" | "challenge" | "deny";
  payment_type?: string;
  transaction_time?: string;
}

// In-memory idempotency cache
const processedTransactions = new Set<string>();

export async function processMidtransPaymentCharge(
  params: MidtransChargeParams & { paymentType?: string }
) {
  if (params.paymentType === "qris") {
    return await createQrisTransaction(params);
  }
  return await createSnapTransaction(params);
}

export async function processMidtransWebhook(payload: MidtransWebhookPayload) {
  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    fraud_status,
    payment_type,
  } = payload;

  // 1. Check idempotency
  const idempotencyKey = `${order_id}:${transaction_status}`;
  if (processedTransactions.has(idempotencyKey)) {
    return {
      status: "ALREADY_PROCESSED",
      orderId: order_id,
      transactionStatus: transaction_status,
    };
  }

  // 2. Cryptographic signature check
  const isValidSignature = verifyMidtransSignature(
    order_id,
    status_code,
    gross_amount,
    signature_key
  );

  if (!isValidSignature) {
    throw new Error("Invalid Midtrans signature key");
  }

  // 3. State Machine Transition
  let bookingState: "CONFIRMED" | "FAILED" | "PENDING" = "PENDING";

  if (
    transaction_status === "settlement" ||
    (transaction_status === "capture" && fraud_status === "accept")
  ) {
    bookingState = "CONFIRMED";
    processedTransactions.add(idempotencyKey);
  } else if (
    transaction_status === "cancel" ||
    transaction_status === "deny" ||
    transaction_status === "expire"
  ) {
    bookingState = "FAILED";
    processedTransactions.add(idempotencyKey);
  } else if (transaction_status === "pending") {
    bookingState = "PENDING";
  }

  // 4. Update Database in Supabase
  try {
    const booking = await prisma.booking.findFirst({
      where: {
        OR: [{ id: order_id }, { code: order_id }],
      },
      include: { court: true },
    });

    if (booking) {
      if (bookingState === "CONFIRMED") {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: "CONFIRMED",
            holdExpiresAt: null,
            payment: {
              upsert: {
                create: {
                  amount: Number(gross_amount) || booking.totalPrice,
                  gateway: "midtrans",
                  status: "settlement",
                  paymentType: payment_type,
                  paidAt: new Date(),
                },
                update: {
                  status: "settlement",
                  paymentType: payment_type,
                  paidAt: new Date(),
                },
              },
            },
          },
        });

        // Trigger E-Invoice Email & Receipt
        const [startH, startM] = booking.startTime.split(":").map(Number);
        const endHour = startH + booking.durationHours;
        const endTimeStr = `${String(endHour).padStart(2, "0")}:${String(startM || 0).padStart(2, "0")}`;
        const rawContact = decryptPII(booking.customerContact || "");

        sendBookingInvoiceEmail({
          bookingId: booking.id,
          bookingCode: booking.code,
          customerName: booking.customerName,
          customerEmail: rawContact.includes("@") ? rawContact : "player@contoh.id",
          courtName: booking.court.name,
          date: booking.date,
          startTime: booking.startTime,
          endTime: endTimeStr,
          totalPrice: booking.totalPrice,
          paymentMethod: payment_type === "qris" ? "QRIS" : payment_type ? payment_type.toUpperCase() : "Online Payment",
        }).catch((e) => console.warn("[Email Send Error]:", e));
      } else if (bookingState === "FAILED") {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            cancelReason: `Payment ${transaction_status}`,
            payment: {
              upsert: {
                create: {
                  amount: Number(gross_amount) || booking.totalPrice,
                  gateway: "midtrans",
                  status: transaction_status,
                  paymentType: payment_type,
                },
                update: {
                  status: transaction_status,
                },
              },
            },
          },
        });

        // Release redis slot lock if any
        await releaseSlotLock(booking.courtId, booking.date, booking.startTime);
      }
    }
  } catch (dbError) {
    console.error("[Midtrans Webhook DB Sync Error]:", dbError);
  }

  return {
    status: "SUCCESS",
    bookingState,
    orderId: order_id,
    transactionStatus: transaction_status,
  };
}

export interface ProcessBookingRefundParams {
  bookingId: string;
  reason: string;
  actor?: string;
}

export interface ProcessBookingRefundResult {
  success: boolean;
  booking: any;
  refundAmount: number;
  isEligibleForRefund: boolean;
  cancelReason: string;
  midtransRefund?: any;
}

/**
 * Handles booking cancellation and refund processing based on policy:
 * - >= 24 hours before game schedule: 100% refund
 * - < 24 hours before game schedule: 0% refund (rejected)
 * - If paid via QRIS / GoPay and Midtrans server key is active, triggers Midtrans Refund API
 * - Updates booking status to CANCELLED with refundAmount and cancelReason in the database
 */
export async function processBookingRefund(
  params: ProcessBookingRefundParams
): Promise<ProcessBookingRefundResult> {
  const { bookingId, reason, actor = "STAFF" } = params;

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [{ id: bookingId }, { code: bookingId }],
    },
    include: {
      court: true,
      payment: true,
    },
  });

  if (!booking) {
    throw new Error(`Booking tidak ditemukan untuk ID / Kode: ${bookingId}`);
  }

  // Calculate cancellation policy (>= 24 hours = 100%, < 24 hours = 0%)
  const [startHours = 0, startMinutes = 0] = booking.startTime.split(":").map(Number);
  const [year = 2026, month = 1, day = 1] = booking.date.split("-").map(Number);
  const bookingStart = new Date(year, month - 1, day, startHours, startMinutes, 0);

  const now = new Date();
  const diffHours = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  const isEligibleForRefund = diffHours >= 24;
  const refundAmount = isEligibleForRefund ? booking.totalPrice : 0;

  // Midtrans Refund API integration
  let midtransRefundResult: any = null;
  const isQrisOrGopay =
    booking.payment?.paymentType === "qris" ||
    booking.payment?.paymentType === "gopay";

  if (isEligibleForRefund && refundAmount > 0 && isQrisOrGopay && midtransConfig.serverKey) {
    const orderId = booking.code || booking.id;
    const refundUrl = midtransConfig.isProduction
      ? `https://api.midtrans.com/v2/${orderId}/refund`
      : `https://api.sandbox.midtrans.com/v2/${orderId}/refund`;

    try {
      const authHeader = `Basic ${Buffer.from(`${midtransConfig.serverKey}:`).toString("base64")}`;
      const response = await fetch(refundUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          refund_key: `ref-${orderId}-${Date.now()}`,
          amount: refundAmount,
          reason,
        }),
      });

      midtransRefundResult = await response.json().catch(() => ({}));
      console.log(`[Midtrans Refund API] Refund response for ${orderId}:`, midtransRefundResult);
    } catch (err) {
      console.warn(`[Midtrans Refund API] Error executing refund for ${orderId}:`, err);
    }
  }

  // Update booking record in database
  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED",
      refundAmount,
      cancelReason: reason,
      ...(booking.payment && {
        payment: {
          update: {
            status: refundAmount > 0 ? "refund" : booking.payment.status,
          },
        },
      }),
    },
    include: {
      court: true,
      payment: true,
    },
  });

  // Record audit history
  try {
    await prisma.bookingHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: "CANCELLED",
        action: "REFUND_CANCEL",
        actorRole: actor,
        note: `${reason} (${isEligibleForRefund ? `Refund 100% Rp ${refundAmount.toLocaleString("id-ID")}` : "Refund 0% / ditolak <24 jam"})`,
      },
    });
  } catch (historyErr) {
    console.warn("[BookingHistory Audit Error]:", historyErr);
  }

  // Release slot lock
  try {
    await releaseSlotLock(booking.courtId, booking.date, booking.startTime);
  } catch (slotErr) {
    console.warn("[SlotLock Release Error]:", slotErr);
  }

  return {
    success: true,
    booking: updatedBooking,
    refundAmount,
    isEligibleForRefund,
    cancelReason: reason,
    midtransRefund: midtransRefundResult,
  };
}
