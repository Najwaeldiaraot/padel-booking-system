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
