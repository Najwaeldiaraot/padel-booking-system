import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedData, setCachedData } from "@/server/services/cache-service";

export async function GET() {
  try {
    // 1. Check Redis cache first (non-sensitive public reviews)
    const cachedReviews = await getCachedData<any[]>("public_reviews");
    if (cachedReviews) {
      return NextResponse.json(cachedReviews);
    }

    // 2. Fetch from Supabase PostgreSQL
    const reviews = await prisma.review.findMany({
      where: { isHidden: false },
      include: {
        booking: {
          include: { court: true },
        },
        user: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const publicReviews = reviews.map((r) => {
      const nameParts = (r.user?.name || r.booking.customerName || "Pemain").split(" ");
      const formattedName =
        nameParts.length > 1
          ? `${nameParts[0]} ${nameParts[1][0]}.`
          : nameParts[0];

      return {
        id: r.id,
        name: formattedName,
        rating: r.rating,
        review: r.comment || "",
        court: r.booking.courtId,
        courtName: r.booking.court.name,
        date: r.booking.date,
        reply: r.adminReply || undefined,
      };
    });

    // 3. Cache in Upstash Redis (TTL 300s)
    await setCachedData("public_reviews", publicReviews, 300);

    return NextResponse.json(publicReviews);
  } catch (error: any) {
    console.error("[API Reviews GET] Error:", error);
    return NextResponse.json([]);
  }
}
