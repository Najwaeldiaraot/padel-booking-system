import { NextResponse } from "next/server";
import { type BusySlot } from "@/server/club-data";
import { prisma } from "@/lib/prisma";
import { getActiveSlotLocks } from "@/server/services/slot-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    const busySlots: BusySlot[] = [];

    // 1. Fetch active bookings from Supabase PostgreSQL via Prisma
    // All bookings except cancelled and expired occupy the court slot
    const whereClause: any = {
      status: {
        notIn: ["CANCELLED", "EXPIRED"],
      },
    };
    if (date) {
      whereClause.date = date;
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      select: {
        id: true,
        courtId: true,
        date: true,
        startTime: true,
        durationHours: true,
        status: true,
      },
    });

    for (const b of bookings) {
      const isConfirmedKind =
        b.status === "CONFIRMED" ||
        b.status === "COMPLETED" ||
        (b.status as string) === "CHECKED_IN";

      busySlots.push({
        court: b.courtId,
        date: b.date,
        time: b.startTime,
        duration: b.durationHours * 60, // convert hours to minutes
        kind: isConfirmedKind ? "booking" : "hold",
        bookingId: b.id,
      });
    }

    // 2. Fetch court blocks from Supabase PostgreSQL
    const blockWhereClause: any = {};
    if (date) {
      blockWhereClause.date = date;
    }
    const blocks = await prisma.courtBlock.findMany({
      where: blockWhereClause,
    });

    for (const blk of blocks) {
      // Calculate duration in minutes if endTime and startTime are known
      const [startH, startM] = blk.startTime.split(":").map(Number);
      const [endH, endM] = blk.endTime.split(":").map(Number);
      const durationMin = (endH * 60 + endM) - (startH * 60 + startM);

      busySlots.push({
        court: blk.courtId,
        date: blk.date,
        time: blk.startTime,
        duration: durationMin > 0 ? durationMin : 60,
        kind: "block",
      });
    }

    // 3. Fetch active slot locks from Upstash Redis
    const locks = await getActiveSlotLocks(date || undefined);
    for (const lock of locks) {
      // Avoid duplicate if already in busySlots from DB
      const exists = busySlots.some(
        (s) => s.court === Number(lock.courtId) && s.date === lock.date && s.time === lock.startTime
      );
      if (!exists) {
        busySlots.push({
          court: Number(lock.courtId),
          date: lock.date,
          time: lock.startTime,
          duration: 60,
          kind: "hold",
        });
      }
    }

    return NextResponse.json(busySlots);
  } catch (error: any) {
    console.error("[API Availability] Error fetching availability:", error);
    return NextResponse.json({ error: error?.message || "Internal error", stack: error?.stack }, { status: 500 });
  }
}
