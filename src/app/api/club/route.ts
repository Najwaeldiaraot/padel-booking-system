import { NextResponse } from "next/server";
import { defaultClub } from "@/server/club-data";
import { prisma } from "@/lib/prisma";
import { getCachedData, setCachedData } from "@/server/services/cache-service";

export async function GET() {
  try {
    // 1. Check Redis cache first (non-sensitive club & court catalog)
    const cachedClub = await getCachedData<typeof defaultClub>("club_catalog");
    if (cachedClub) {
      return NextResponse.json(cachedClub);
    }

    // 2. Fetch from Supabase PostgreSQL
    const dbCourts = await prisma.court.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });

    let result = defaultClub;

    if (dbCourts.length > 0) {
      result = {
        ...defaultClub,
        courtOptions: dbCourts.map((c) => {
          const fallbackCourt = defaultClub.courtOptions.find((d) => d.id === c.id);
          const photo = c.photoUrl || fallbackCourt?.photo || defaultClub.photo;
          return {
            id: c.id,
            name: c.name,
            type: (c.type.toLowerCase() === "indoor"
              ? "indoor"
              : c.type.toLowerCase() === "outdoor"
              ? "outdoor"
              : "panoramic") as "panoramic" | "indoor" | "outdoor",
            price: c.pricePerHour,
            description: c.description || "",
            active: c.isActive,
            photo,
            image: photo,
            en: { description: fallbackCourt?.en?.description || c.description || "" },
          };
        }),
      };
    }

    // 3. Cache in Upstash Redis (TTL 5 mins)
    await setCachedData("club_catalog", result, 300);

    return NextResponse.json(result);
  } catch (error) {
    console.warn("[API Club] Supabase fetch fallback to default:", error);
    return NextResponse.json(defaultClub);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const current = (await getCachedData<typeof defaultClub>("club_catalog")) || defaultClub;
    const updated = {
      ...current,
      ...body,
      whatsappNumber: body.whatsappNumber !== undefined ? body.whatsappNumber : current.whatsappNumber,
    };

    // Store in Upstash Redis (TTL 30 days)
    await setCachedData("club_catalog", updated, 86400 * 30);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[API Club PATCH] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update club configuration" },
      { status: 500 },
    );
  }
}
