import {
  createSnapTransaction,
  createQrisTransaction,
  verifyMidtransSignature,
  type MidtransChargeParams,
} from "@/lib/midtrans";
import { releaseSlotLock } from "./slot-service";
import { prisma } from "@/lib/prisma";
import { sendBookingInvoiceEmail } from "./email-service";

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

        sendBookingInvoiceEmail({
          bookingId: booking.id,
          bookingCode: booking.code,
          customerName: booking.customerName,
          customerEmail: booking.customerContact?.includes("@") ? booking.customerContact : "player@contoh.id",
          courtName: booking.court.name,
          date: booking.date,
          startTime: booking.startTime,
          endTime: endTimeStr,
          totalPrice: booking.totalPrice,
          paymentMethod: payment_type === "qris" ? "QRIS (Midtrans)" : payment_type || "Midtrans Online",
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
