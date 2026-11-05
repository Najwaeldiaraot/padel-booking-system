import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  encryptPII,
  generateBlindIndex,
  hashPassword,
  maskPII,
} from "@/lib/encryption";
import { sendOtpEmail } from "@/server/services/email-service";

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
    const { name, identifier, password } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Nama lengkap minimal 2 karakter." },
        { status: 400 }
      );
    }

    if (!identifier || typeof identifier !== "string") {
      return NextResponse.json(
        { error: "Masukkan email atau nomor HP yang valid." },
        { status: 400 }
      );
    }

    const parsed = normalizeIdentifier(identifier);
    if (!parsed) {
      return NextResponse.json(
        { error: "Format email atau nomor HP belum tepat." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Kata sandi minimal 8 karakter." },
        { status: 400 }
      );
    }

    // Check existing user in Prisma DB
    const existing = await prisma.user.findFirst({
      where:
        parsed.type === "email"
          ? { email: parsed.value }
          : { phoneBlindIndex: generateBlindIndex(parsed.value) },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email atau nomor HP sudah terdaftar. Silakan langsung masuk." },
        { status: 409 }
      );
    }

    // Generate 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const challengeId = `otp-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const ttlSeconds = 600; // 10 minutes

    const challengeData = {
      name: name.trim(),
      email: parsed.type === "email" ? parsed.value : null,
      phone: parsed.type === "phone" ? parsed.value : null,
      passwordHash: hashPassword(password),
      code,
      attempts: 0,
      createdAt: Date.now(),
    };

    await redis.set(`otp_reg:${challengeId}`, challengeData, { ex: ttlSeconds });

    // Send real OTP email via Resend if registered with email
    if (parsed.type === "email") {
      try {
        await sendOtpEmail(parsed.value, code, "register");
      } catch (mailErr) {
        console.warn("[API Auth Register] Failed to dispatch OTP email:", mailErr);
      }
    }

    const destination = maskPII(parsed.value, parsed.type);

    return NextResponse.json({
      success: true,
      challengeId,
      destination,
      expiresAt: Date.now() + ttlSeconds * 1000,
      preview: code, // For demo & seamless testing in any environment
    });
  } catch (error: any) {
    console.error("[API Auth Register] Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses pendaftaran." },
      { status: 500 }
    );
  }
}
