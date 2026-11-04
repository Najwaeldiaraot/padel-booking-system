import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, decryptPII } from "@/lib/encryption";

export const dynamic = "force-dynamic";

function calculateLoyaltyTier(totalBookings: number) {
  if (totalBookings >= 10) return "VIP Player";
  if (totalBookings >= 5) return "Regular Player";
  return "Club Member";
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("padel_session")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ success: true, user: null, authenticated: false });
    }

    const session = verifySessionToken(token);
    if (!session || !session.id) {
      return NextResponse.json(
        { error: "Sesi tidak valid atau telah kedaluwarsa.", user: null, authenticated: false },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: {
        bookings: {
          select: {
            id: true,
            date: true,
            startTime: true,
            status: true,
            courtId: true,
            court: {
              select: { name: true },
            },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: true, user: null });
    }

    const decryptedName = decryptPII(user.name) || "Pemain Padel";
    const decryptedPhone = user.phone ? decryptPII(user.phone) : null;

    const validBookings = user.bookings.filter(
      (b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN" || b.status === "COMPLETED"
    );
    const totalBookings = validBookings.length;

    let daysSinceLastVisit: number | null = null;
    let lastBookingDate: string | null = null;

    if (validBookings.length > 0) {
      lastBookingDate = validBookings[0].date;
      const [y, m, d] = lastBookingDate.split("-").map(Number);
      const lastDate = new Date(y, m - 1, d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - lastDate.getTime();
      daysSinceLastVisit = Math.max(0, Math.floor(diffTime / (1000 * 3600 * 24)));
    }

    // Determine favorite court
    const courtCounts: Record<string, number> = {};
    for (const b of validBookings) {
      const cName = b.court?.name || `Court ${b.courtId}`;
      courtCounts[cName] = (courtCounts[cName] || 0) + 1;
    }
    const favoriteCourt =
      Object.entries(courtCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const loyaltyTier = calculateLoyaltyTier(totalBookings);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: decryptedName,
        email: user.email,
        phone: decryptedPhone,
        role: user.role.toLowerCase(),
        isVerified: true,
        createdAt: user.createdAt.toISOString(),
        totalBookings,
        lastBookingDate,
        daysSinceLastVisit,
        loyaltyTier,
        favoriteCourt,
      },
    });
  } catch (error: any) {
    console.error("[API Auth Me] Error:", error);
    return NextResponse.json({ success: true, user: null });
  }
}
