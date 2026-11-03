import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  encryptPII,
  generateBlindIndex,
  createSessionToken,
} from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { challengeId, code } = body;

    if (!challengeId || !code) {
      return NextResponse.json(
        { error: "ID tantangan dan kode verifikasi wajib diisi." },
        { status: 400 }
      );
    }

    const redisKey = `otp_reg:${challengeId}`;
    const challenge = await redis.get<{
      name: string;
      email: string | null;
      phone: string | null;
      passwordHash: string;
      code: string;
      attempts: number;
    }>(redisKey);

    if (!challenge) {
      return NextResponse.json(
        { error: "Sesi verifikasi telah kedaluwarsa. Silakan ulangi pendaftaran." },
        { status: 400 }
      );
    }

    if (challenge.attempts >= 5) {
      await redis.del(redisKey);
      return NextResponse.json(
        { error: "Terlalu banyak percobaan salah. Silakan daftar ulang." },
        { status: 400 }
      );
    }

    if (challenge.code !== code.trim()) {
      challenge.attempts += 1;
      await redis.set(redisKey, challenge, { ex: 300 });
      return NextResponse.json(
        {
          error: "Kode verifikasi tidak sesuai.",
          remaining: 5 - challenge.attempts,
        },
        { status: 400 }
      );
    }

    // Create user in PostgreSQL database via Prisma
    const user = await prisma.user.create({
      data: {
        name: encryptPII(challenge.name),
        nameBlindIndex: generateBlindIndex(challenge.name),
        email: challenge.email ? challenge.email.toLowerCase() : null,
        emailBlindIndex: challenge.email ? generateBlindIndex(challenge.email) : null,
        phone: challenge.phone ? encryptPII(challenge.phone) : null,
        phoneBlindIndex: challenge.phone ? generateBlindIndex(challenge.phone) : null,
        passwordHash: challenge.passwordHash,
        role: "PLAYER",
      },
    });

    // Also sync to Customer record for unified CRM with full PII encryption
    try {
      const emailNorm = challenge.email ? challenge.email.toLowerCase() : null;
      const emailBlind = emailNorm ? generateBlindIndex(emailNorm) : null;
      const phoneBlind = challenge.phone ? generateBlindIndex(challenge.phone) : null;
      const nameBlind = generateBlindIndex(challenge.name);
      const encryptedName = encryptPII(challenge.name);
      const encryptedEmail = emailNorm ? encryptPII(emailNorm) : null;
      const encryptedPhone = challenge.phone ? encryptPII(challenge.phone) : null;

      let existingCustomer = null;
      if (emailBlind || phoneBlind) {
        existingCustomer = await prisma.customer.findFirst({
          where: {
            OR: [
              ...(emailBlind ? [{ emailBlindIndex: emailBlind }] : []),
              ...(phoneBlind ? [{ phoneBlindIndex: phoneBlind }] : []),
            ],
          },
        });
      }

      if (existingCustomer) {
        await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            name: encryptedName,
            nameBlindIndex: nameBlind,
            ...(encryptedEmail && { email: encryptedEmail, emailBlindIndex: emailBlind }),
            ...(encryptedPhone && { phone: encryptedPhone, phoneBlindIndex: phoneBlind }),
          },
        });
      } else {
        await prisma.customer.create({
          data: {
            name: encryptedName,
            nameBlindIndex: nameBlind,
            email: encryptedEmail,
            emailBlindIndex: emailBlind,
            phone: encryptedPhone,
            phoneBlindIndex: phoneBlind,
          },
        });
      }
    } catch (e) {
      console.warn("[API Auth Verify OTP] Customer sync non-blocking error:", e);
    }

    await redis.del(redisKey);

    // Create session token
    const token = createSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Set cookie
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
        name: challenge.name,
        email: user.email,
        phone: challenge.phone,
        role: "player",
        isVerified: true,
        createdAt: user.createdAt.toISOString(),
        totalBookings: 0,
        daysSinceLastVisit: null,
        loyaltyTier: "Club Member",
      },
    });
  } catch (error: any) {
    console.error("[API Auth Verify OTP] Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memverifikasi OTP." },
      { status: 500 }
    );
  }
}
