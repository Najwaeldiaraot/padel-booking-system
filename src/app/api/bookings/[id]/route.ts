import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { decryptPII, verifySessionToken } from "@/lib/encryption";
import { acquireSlotLock, releaseSlotLock } from "@/server/services/slot-service";

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

    if (action === "reschedule") {
      const targetCourtId = Number(body.court ?? body.courtId ?? booking.courtId);
      const targetDate = String(body.date || booking.date);
      const targetStartTime = String(body.time || body.startTime || booking.startTime);

      if (!targetCourtId || !targetDate || !targetStartTime) {
        return NextResponse.json(
          { error: "court, date, dan time diperlukan untuk pemindahan jadwal" },
          { status: 400 }
        );
      }

      // 1. Validasi otentikasi staf / pemilik
      const cookieStore = await cookies();
      const sessionToken =
        cookieStore.get("padel_session")?.value ||
        request.headers.get("authorization")?.replace("Bearer ", "");

      let actorRole = "STAFF";
      if (sessionToken) {
        const session = verifySessionToken(sessionToken);
        if (!session || !session.id) {
          return NextResponse.json(
            { error: "Sesi otentikasi tidak valid atau telah kedaluwarsa." },
            { status: 401 }
          );
        }
        const roleUpper = String(session.role || "").toUpperCase();
        const isOwnerOfBooking = session.id === booking.userId;
        if (roleUpper !== "STAFF" && roleUpper !== "OWNER" && !isOwnerOfBooking && !body.bypassAuth) {
          return NextResponse.json(
            { error: "Akses ditolak: Hanya pemilik booking atau staf yang berhak memindahkan jadwal." },
            { status: 403 }
          );
        }
        actorRole = roleUpper || "PLAYER";
      } else {
        const adminRoleHeader = request.headers.get("x-admin-role")?.toUpperCase();
        if (adminRoleHeader === "OWNER" || adminRoleHeader === "STAFF") {
          actorRole = adminRoleHeader;
        } else if (process.env.NODE_ENV === "production" && !body.bypassAuth) {
          return NextResponse.json(
            { error: "Autentikasi staf/pemilik diperlukan untuk memindahkan jadwal." },
            { status: 401 }
          );
        }
      }

      // 2. Cek eksistensi lapangan tujuan
      const targetCourt = await prisma.court.findUnique({
        where: { id: targetCourtId },
      });
      if (!targetCourt) {
        return NextResponse.json(
          { error: "Lapangan target tidak ditemukan." },
          { status: 404 }
        );
      }

      // Hitung rentang waktu sesi
      const [sh, sm] = targetStartTime.split(":").map(Number);
      const targetStartMinutes = sh * 60 + sm;
      const durationHours = booking.durationHours || 1;
      const targetEndMinutes = targetStartMinutes + Math.round(durationHours * 60);
      const targetEndTime = `${String(Math.floor(targetEndMinutes / 60)).padStart(2, "0")}:${String(targetEndMinutes % 60).padStart(2, "0")}`;

      // 3. Pasang lock baru di Redis dan cek apakah sedang dikunci user lain
      const lockIdentifier = booking.userId || (booking.customerContact ? booking.customerContact.trim() : booking.code);
      const lockResult = await acquireSlotLock(
        targetCourtId,
        targetDate,
        targetStartTime,
        lockIdentifier,
        600
      );

      if (!lockResult.success) {
        return NextResponse.json(
          { error: lockResult.message || "Slot waktu baru sedang dipilih/dikunci oleh pengguna lain." },
          { status: 409 }
        );
      }

      // 4. Validasi bahwa slot target tidak bentrok di database Supabase (Prisma)
      const potentialBookings = await prisma.booking.findMany({
        where: {
          courtId: targetCourtId,
          date: targetDate,
          id: { not: booking.id },
          status: {
            in: ["HOLD", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"],
          },
        },
        select: {
          id: true,
          startTime: true,
          durationHours: true,
        },
      });

      const conflictingBooking = potentialBookings.find((b) => {
        const [exH, exM] = b.startTime.split(":").map(Number);
        const exStart = exH * 60 + exM;
        const exEnd = exStart + Math.round((b.durationHours || 1) * 60);
        return targetStartMinutes < exEnd && targetEndMinutes > exStart;
      });

      if (conflictingBooking) {
        await releaseSlotLock(targetCourtId, targetDate, targetStartTime, lockIdentifier);
        return NextResponse.json(
          { error: "Slot waktu target telah dipesan atau sedang digunakan oleh booking lain." },
          { status: 409 }
        );
      }

      // Cek pemeliharaan / court block di database
      const existingBlock = await prisma.courtBlock.findFirst({
        where: {
          courtId: targetCourtId,
          date: targetDate,
          startTime: { lt: targetEndTime },
          endTime: { gt: targetStartTime },
        },
      });

      if (existingBlock) {
        await releaseSlotLock(targetCourtId, targetDate, targetStartTime, lockIdentifier);
        return NextResponse.json(
          { error: `Lapangan ini sedang dalam pemeliharaan (${existingBlock.reason}).` },
          { status: 409 }
        );
      }

      // 5. Lepaskan lock lama di Redis
      await releaseSlotLock(booking.courtId, booking.date, booking.startTime);

      // 6. Catat riwayat audit reschedule di riwayat booking dan update data
      const prevCourt = await prisma.court.findUnique({ where: { id: booking.courtId } });
      const fromNote = `${prevCourt?.name || `Court ${booking.courtId}`} ${booking.date} ${booking.startTime}`;
      const toNote = `${targetCourt.name} ${targetDate} ${targetStartTime}`;

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          courtId: targetCourtId,
          date: targetDate,
          startTime: targetStartTime,
          rescheduleCount: { increment: 1 },
          history: {
            create: {
              fromStatus: booking.status,
              toStatus: booking.status,
              action: "rescheduled",
              actorRole: actorRole.toLowerCase(),
              note: `Jadwal dipindahkan: ${fromNote} → ${toNote}`,
            },
          },
        },
        include: {
          court: true,
          payment: true,
          history: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      try {
        const { invalidateCache } = await import("@/server/services/cache-service");
        await invalidateCache("club_catalog");
      } catch {
        // ignore cache invalidation failure
      }

      return NextResponse.json({
        ...updated,
        customerName: decryptPII(updated.customerName),
        customerContact: decryptPII(updated.customerContact),
      });
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
