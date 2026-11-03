import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastSlotEvent } from "@/server/services/slot-service";

function generateBookingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `RLY-${suffix}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");

    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        court: true,
        payment: true,
        review: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedBookings = bookings.map((b) => ({
      ...b,
      status: b.checkedInAt && b.status === "CONFIRMED" ? "CHECKED_IN" : b.status,
    }));

    return NextResponse.json(formattedBookings);
  } catch (error: any) {
    console.error("[API Bookings GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      courtId,
      date,
      startTime,
      durationHours = 1,
      customerName,
      customerContact,
      userId,
      totalPrice,
      source = "online",
    } = body;

    if (!courtId || !date || !startTime || !customerName) {
      return NextResponse.json(
        { error: "courtId, date, startTime, and customerName are required" },
        { status: 400 }
      );
    }

    const [h, m] = startTime.split(":").map(Number);
    const endMinutes = h * 60 + m + Math.round(durationHours * 60);
    const bookingEndTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    // 1. Double check slot conflict in DB
    const existingBooking = await prisma.booking.findFirst({
      where: {
        courtId: Number(courtId),
        date,
        startTime: { lt: bookingEndTime },
        status: {
          in: ["HOLD", "PENDING_PAYMENT", "CONFIRMED"],
        },
      },
    });

    if (existingBooking) {
      return NextResponse.json(
        { error: "Slot waktu ini sudah dipesan oleh pengguna lain." },
        { status: 409 }
      );
    }

    // 2. Double check court block (maintenance) conflict in DB
    const existingBlock = await prisma.courtBlock.findFirst({
      where: {
        courtId: Number(courtId),
        date,
        startTime: { lt: bookingEndTime },
        endTime: { gt: startTime },
      },
    });

    if (existingBlock) {
      return NextResponse.json(
        { error: `Lapangan ini sedang dalam pemeliharaan (${existingBlock.reason}).` },
        { status: 409 }
      );
    }

    const court = await prisma.court.findUnique({
      where: { id: Number(courtId) },
    });

    if (!court) {
      return NextResponse.json({ error: "Court not found" }, { status: 404 });
    }

    const calculatedTotal = totalPrice || (court.pricePerHour * Number(durationHours));
    const code = body.code || generateBookingCode();
    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const newBooking = await prisma.booking.create({
      data: {
        code,
        userId: userId || null,
        customerName,
        customerContact: customerContact || "-",
        courtId: Number(courtId),
        date,
        startTime,
        durationHours: Number(durationHours),
        totalPrice: calculatedTotal,
        status: "PENDING_PAYMENT",
        holdExpiresAt,
        source,
        payment: {
          create: {
            amount: calculatedTotal,
            gateway: source === "walk-in" ? "manual" : "midtrans",
            status: "pending",
          },
        },
      },
      include: {
        court: true,
        payment: true,
      },
    });

    // Broadcast SSE slot event
    broadcastSlotEvent({
      type: "BOOKED",
      data: {
        courtId: Number(courtId),
        date,
        startTime,
      },
    });

    return NextResponse.json(newBooking, { status: 201 });
  } catch (error: any) {
    console.error("[API Bookings POST] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create booking" },
      { status: 500 }
    );
  }
}
