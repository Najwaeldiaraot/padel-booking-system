import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptPII } from "@/lib/encryption";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
      include: {
        court: true,
        payment: true,
        review: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const effectiveStatus =
      booking.checkedInAt && booking.status === "CONFIRMED"
        ? "CHECKED_IN"
        : booking.status;

    return NextResponse.json({
      ...booking,
      customerName: decryptPII(booking.customerName),
      customerContact: decryptPII(booking.customerContact),
      cancelReason: booking.cancelReason ? decryptPII(booking.cancelReason) : null,
      status: effectiveStatus,
    });
  } catch (error: any) {
    console.error("[API Booking Detail GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch booking details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, cancelReason, date, startTime } = body;

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (action === "cancel") {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          cancelReason: cancelReason || "Dibatalkan pemain",
        },
        include: {
          court: true,
          payment: true,
        },
      });
      return NextResponse.json(updated);
    }

    if (action === "confirm") {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          holdExpiresAt: null,
          payment: {
            update: {
              status: "settlement",
              paidAt: new Date(),
            },
          },
        },
        include: {
          court: true,
          payment: true,
        },
      });
      return NextResponse.json(updated);
    }

    if (action === "checkin") {
      // 1. Status Guard: Must be CONFIRMED
      if (booking.status !== "CONFIRMED") {
        return NextResponse.json(
          { error: `Booking tidak dapat di-checkin karena berstatus ${booking.status}` },
          { status: 400 }
        );
      }

      // 2. Schedule Expiry Guard: Check if the playing session has already ended
      const [sh, sm] = (booking.startTime || "00:00").split(":").map(Number);
      const endMinutes = sh * 60 + sm + Math.round((booking.durationHours || 1) * 60);
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTimeStr = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;

      const bookingEndIso = `${booking.date}T${endTimeStr}:00+07:00`;
      const bookingEndTime = new Date(bookingEndIso).getTime();
      const nowTime = Date.now();

      if (!isNaN(bookingEndTime) && nowTime > bookingEndTime && !body.bypassExpired) {
        return NextResponse.json(
          {
            error: "Jadwal bermain untuk booking ini telah berakhir.",
            code: "SCHEDULE_EXPIRED",
            bookingEnd: bookingEndIso,
          },
          { status: 400 }
        );
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "CHECKED_IN",
          checkedInAt: new Date(),
        },
        include: {
          court: true,
          payment: true,
        },
      });
      return NextResponse.json({
        ...updated,
        status: "CHECKED_IN",
      });
    }

    if (action === "complete") {
      if (booking.status !== "CHECKED_IN" && !body.bypassStatus) {
        return NextResponse.json(
          { error: `Hanya booking berstatus CHECKED_IN yang dapat diselesaikan (Status saat ini: ${booking.status})` },
          { status: 400 }
        );
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "COMPLETED",
        },
        include: {
          court: true,
          payment: true,
        },
      });
      return NextResponse.json(updated);
    }

    if (action === "undo_checkin") {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          checkedInAt: null,
        },
        include: {
          court: true,
          payment: true,
        },
      });
      return NextResponse.json({
        ...updated,
        status: "CONFIRMED",
      });
    }

    if (action === "undo_complete") {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "CHECKED_IN",
        },
        include: {
          court: true,
          payment: true,
        },
      });
      return NextResponse.json({
        ...updated,
        status: "CHECKED_IN",
      });
    }

    if (action === "reschedule" && date && startTime) {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          date,
          startTime,
          rescheduleCount: { increment: 1 },
        },
        include: {
          court: true,
          payment: true,
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[API Booking Detail PATCH] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update booking" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    await prisma.booking.delete({
      where: { id: booking.id },
    });

    return NextResponse.json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error: any) {
    console.error("[API Booking Detail DELETE] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete booking" },
      { status: 500 }
    );
  }
}
