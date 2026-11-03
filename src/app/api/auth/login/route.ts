import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  decryptPII,
  encryptPII,
  generateBlindIndex,
  verifyPassword,
  hashPassword,
  createSessionToken,
} from "@/lib/encryption";

export const dynamic = "force-dynamic";

const PREVIEW_ACCOUNTS = [
  { role: "OWNER" as const, name: "Rafki Pratama", email: "pemilik@rallypadel.club", password: "RallyOwner1" },
  { role: "STAFF" as const, name: "Dewi Anggraini", email: "staf@rallypadel.club", password: "RallyStaff1" },
  { role: "PLAYER" as const, name: "Nadia Putri", email: "pemain@rallypadel.club", phone: "6281234567890", password: "RallyPlayer1" },
];

function normalizeIdentifier(raw: string) {
  const clean = raw.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) {
    return { type: "email" as const, value: clean };
  }
  const digits = clean.replace(/\D/g, "");
  if (digits.length >= 9 && digits.length <= 15) {
    return { type: "phone" as const, value: digits.startsWith("0") ? "62" + digits.slice(1) : digits };
  }
  return null;
}

function calculateLoyaltyTier(totalBookings: number) {
  if (totalBookings >= 10) return "VIP Player";
  if (totalBookings >= 5) return "Regular Player";
  return "Club Member";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password, scope = "player" } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Email/nomor HP dan kata sandi wajib diisi." },
        { status: 400 }
      );
    }

    const parsed = normalizeIdentifier(identifier);
    if (!parsed) {
      return NextResponse.json(
        { error: "Masukkan email atau nomor HP yang valid." },
        { status: 400 }
      );
    }

    // Rate limiting key
    const rateLimitKey = `login_fail:${parsed.value}`;
    const failedAttempts = (await redis.get<number>(rateLimitKey)) || 0;
    if (failedAttempts >= 5) {
      return NextResponse.json(
        { error: "Akun dikunci sementara karena terlalu banyak percobaan. Tunggu 15 menit." },
        { status: 429 }
      );
    }

    // Lookup user in DB
    let user = await prisma.user.findFirst({
      where:
        parsed.type === "email"
          ? { email: parsed.value }
          : { phoneBlindIndex: generateBlindIndex(parsed.value) },
      include: {
        bookings: {
          select: {
            id: true,
            date: true,
            startTime: true,
            status: true,
            courtId: true,
          },
          orderBy: { date: "desc" },
        },
      },
    });

    // Support automatic preview account initialization
    if (!user && parsed.type === "email") {
      const matchedPreview = PREVIEW_ACCOUNTS.find(
        (acc) => acc.email.toLowerCase() === parsed.value && acc.password === password
      );
      if (matchedPreview) {
        user = await prisma.user.upsert({
          where: { email: matchedPreview.email },
          update: {
            passwordHash: hashPassword(matchedPreview.password),
          },
          create: {
            name: encryptPII(matchedPreview.name),
            nameBlindIndex: generateBlindIndex(matchedPreview.name),
            email: matchedPreview.email,
            emailBlindIndex: generateBlindIndex(matchedPreview.email),
            phone: matchedPreview.phone ? encryptPII(matchedPreview.phone) : null,
            phoneBlindIndex: matchedPreview.phone ? generateBlindIndex(matchedPreview.phone) : null,
            passwordHash: hashPassword(matchedPreview.password),
            role: matchedPreview.role,
          },
          include: {
            bookings: {
              select: {
                id: true,
                date: true,
                startTime: true,
                status: true,
                courtId: true,
              },
              orderBy: { date: "desc" },
            },
          },
        });
      }
    }

    if (!user) {
      const newFails = failedAttempts + 1;
      await redis.set(rateLimitKey, newFails, { ex: 900 }); // 15 mins
      return NextResponse.json(
        { error: "Email/nomor atau kata sandi belum tepat.", remaining: 5 - newFails },
        { status: 401 }
      );
    }

    // Verify password
    let isPasswordValid = false;
    if (user.passwordHash) {
      isPasswordValid = verifyPassword(password, user.passwordHash);
    }

    if (!isPasswordValid) {
      const newFails = failedAttempts + 1;
      await redis.set(rateLimitKey, newFails, { ex: 900 });
      return NextResponse.json(
        { error: "Email/nomor atau kata sandi belum tepat.", remaining: 5 - newFails },
        { status: 401 }
      );
    }

    // Scope check: Staff dashboard rejects plain players
    if (scope === "staff" && user.role === "PLAYER") {
      return NextResponse.json(
        { error: "Akses ini khusus staf atau pemilik klub." },
        { status: 403 }
      );
    }

    // Success -> Clear rate limit
    await redis.del(rateLimitKey);

    // Decrypt user identity
    const decryptedName = decryptPII(user.name) || "Pemain Padel";
    const decryptedPhone = user.phone ? decryptPII(user.phone) : null;

    // Calculate booking statistics & recency
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

    const loyaltyTier = calculateLoyaltyTier(totalBookings);

    // Create session token & cookie
    const token = createSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const cookieStore = await cookies();
    cookieStore.set("padel_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600, // 30 days
    });

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
      },
    });
  } catch (error: any) {
    console.error("[API Auth Login] Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal masuk." },
      { status: 500 }
    );
  }
}
