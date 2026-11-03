import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { generateBlindIndex, maskPII } from "@/lib/encryption";

export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier } = body;

    if (!identifier || typeof identifier !== "string") {
      return NextResponse.json(
        { error: "Masukkan email atau nomor HP akun kamu." },
        { status: 400 }
      );
    }

    const parsed = normalizeIdentifier(identifier);
    if (!parsed) {
      return NextResponse.json(
        { error: "Format email atau nomor HP tidak valid." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where:
        parsed.type === "email"
          ? { email: parsed.value }
          : { phoneBlindIndex: generateBlindIndex(parsed.value) },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Akun dengan email atau nomor HP tersebut belum terdaftar." },
        { status: 404 }
      );
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const challengeId = `rst-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const ttlSeconds = 300;

    await redis.set(
      `otp_reset:${challengeId}`,
      {
        userId: user.id,
        identifier: parsed.value,
        code,
        attempts: 0,
        createdAt: Date.now(),
      },
      { ex: ttlSeconds }
    );

    const destination = maskPII(parsed.value, parsed.type);

    return NextResponse.json({
      success: true,
      challengeId,
      destination,
      expiresAt: Date.now() + ttlSeconds * 1000,
      preview: code, // For convenient testing
    });
  } catch (error: any) {
    console.error("[API Auth Forgot Password] Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses permintaan reset kata sandi." },
      { status: 500 }
    );
  }
}
