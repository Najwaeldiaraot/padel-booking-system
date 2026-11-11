import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "@/app/api/cron/expire-bookings/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    bookingHistory: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/slot-service", () => ({
  releaseSlotLock: vi.fn().mockResolvedValue(true),
}));

describe("Cron Auto-Expire Bookings Route", () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  it("successfully expires stale hold bookings and releases locks", async () => {
    const mockStale = [
      {
        id: "b-stale-1",
        courtId: 1,
        date: "2026-11-20",
        startTime: "10:00",
        status: "HOLD",
      },
    ];

    vi.mocked(prisma.booking.findMany)
      .mockResolvedValueOnce(mockStale as any) // stale bookings
      .mockResolvedValueOnce([]); // past bookings

    vi.mocked(prisma.booking.update).mockResolvedValue({} as any);
    vi.mocked(prisma.bookingHistory.create).mockResolvedValue({} as any);

    const req = new NextRequest("http://localhost:3000/api/cron/expire-bookings", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.expiredBookings).toBe(1);
    expect(json.completedMatches).toBe(0);

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "b-stale-1" },
      data: { status: "EXPIRED" },
    });
    expect(prisma.bookingHistory.create).toHaveBeenCalled();
  });

  it("enforces CRON_SECRET authorization when secret is configured", async () => {
    process.env.CRON_SECRET = "super-secret-token";

    // 1. Without Auth Header -> 401
    const unauthReq = new NextRequest("http://localhost:3000/api/cron/expire-bookings", {
      method: "POST",
    });
    const unauthRes = await POST(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. With Wrong Auth Header -> 401
    const wrongAuthReq = new NextRequest("http://localhost:3000/api/cron/expire-bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer wrong-token",
      },
    });
    const wrongAuthRes = await POST(wrongAuthReq);
    expect(wrongAuthRes.status).toBe(401);

    // 3. With Correct Auth Header -> 200
    vi.mocked(prisma.booking.findMany).mockResolvedValue([]);
    const validReq = new NextRequest("http://localhost:3000/api/cron/expire-bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer super-secret-token",
      },
    });
    const validRes = await POST(validReq);
    expect(validRes.status).toBe(200);
    const validJson = await validRes.json();
    expect(validJson.success).toBe(true);
  });
});
