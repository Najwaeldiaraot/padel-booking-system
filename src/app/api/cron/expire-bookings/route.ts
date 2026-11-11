import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseSlotLock } from "@/server/services/slot-service";

export const dynamic = "force-dynamic";

async function handleExpireBookings(request: NextRequest) {
  // 1. Verify Authorization Header (if CRON_SECRET is configured)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing Cron Secret" },
      { status: 401 }
    );
  }

  const now = new Date();
  let expiredCount = 0;
  let completedCount = 0;

  try {
    // 2. Fetch stale HOLD or PENDING_PAYMENT bookings
    const staleBookings = await prisma.booking.findMany({
      where: {
        status: { in: ["HOLD", "PENDING_PAYMENT"] },
        holdExpiresAt: { lt: now },
      },
      select: {
        id: true,
        courtId: true,
        date: true,
        startTime: true,
        status: true,
      },
    });

    for (const booking of staleBookings) {
      // A. Update status to EXPIRED
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "EXPIRED" },
      });

      // B. Release Redis slot lock so court is immediately bookable
      await releaseSlotLock(booking.courtId, booking.date, booking.startTime);

      // C. Record audit history
      await prisma.bookingHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: "EXPIRED",
          action: "AUTO_EXPIRE",
          actorRole: "SYSTEM",
          note: "Checkout session expired after 10 minutes",
        },
      });

      expiredCount++;
    }

    // 3. Auto-complete past confirmed/checked-in matches
    // Date format is YYYY-MM-DD
    const todayStr = now.toISOString().split("T")[0];
    const currentHourStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    // Past dates
    const pastBookings = await prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        date: { lt: todayStr },
      },
      select: { id: true, status: true },
    });

    for (const b of pastBookings) {
      await prisma.booking.update({
        where: { id: b.id },
        data: { status: "COMPLETED" },
      });

      await prisma.bookingHistory.create({
        data: {
          bookingId: b.id,
          fromStatus: b.status,
          toStatus: "COMPLETED",
          action: "AUTO_COMPLETE",
          actorRole: "SYSTEM",
          note: "Match date has ended",
        },
      });
      completedCount++;
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      expiredBookings: expiredCount,
      completedMatches: completedCount,
    });
  } catch (error: any) {
    console.error("[Cron Expire Bookings Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error during cron execution",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleExpireBookings(request);
}

export async function POST(request: NextRequest) {
  return handleExpireBookings(request);
}
