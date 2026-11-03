import { NextResponse } from "next/server";
import { acquireSlotLock, releaseSlotLock } from "@/server/services/slot-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { courtId, date, startTime, userId, action = "acquire" } = body;

    if (!courtId || !date || !startTime) {
      return NextResponse.json(
        { error: "courtId, date, and startTime are required" },
        { status: 400 }
      );
    }

    if (action === "release") {
      const released = await releaseSlotLock(courtId, date, startTime, userId);
      return NextResponse.json({ success: released });
    }

    const effectiveUserId = userId || `anon_${Date.now()}`;
    const result = await acquireSlotLock(courtId, date, startTime, effectiveUserId);

    if (!result.success) {
      return NextResponse.json(result, { status: 409 }); // Conflict / Locked
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API Slot Lock] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process slot lock" },
      { status: 500 }
    );
  }
}
