import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateCache } from "@/server/services/cache-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const blocks = await prisma.courtBlock.findMany({
      include: { court: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(blocks);
  } catch (error: any) {
    console.error("[API Admin Blocks GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch court blocks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { courtId, date, startTime, endTime, reason } = body;

    if (!courtId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: "courtId, date, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    const block = await prisma.courtBlock.create({
      data: {
        courtId: Number(courtId),
        date,
        startTime,
        endTime,
        reason: reason || "Perawatan lapangan",
      },
      include: { court: true },
    });

    await invalidateCache("club_catalog");

    return NextResponse.json(block, { status: 201 });
  } catch (error: any) {
    console.error("[API Admin Blocks POST] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create block" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.courtBlock.delete({
      where: { id },
    });

    await invalidateCache("club_catalog");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API Admin Blocks DELETE] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete block" },
      { status: 500 }
    );
  }
}
