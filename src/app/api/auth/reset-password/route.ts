import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  hashPassword,
  createSessionToken,
  decryptPII,
} from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { challengeId, code, newPassword } = body;

    if (!challengeId || !code || !newPassword) {
      return NextResponse.json(
        { error: "Kode verifikasi dan kata sandi baru wajib diisi." },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Kata sandi baru minimal 8 karakter." },
        { status: 400 }
      );
    }

    const redisKey = `otp_reset:${challengeId}`;
    const challenge = await redis.get<{
      userId: string;
      identifier: string;
      code: string;
      attempts: number;
    }>(redisKey);

    if (!challenge) {
      return NextResponse.json(
        { error: "Sesi reset kata sandi telah kedaluwarsa. Silakan ulangi permintaan." },
        { status: 400 }
      );
    }

    if (challenge.attempts >= 5) {
      await redis.del(redisKey);
      return NextResponse.json(
        { error: "Terlalu banyak percobaan salah. Silakan minta kode baru." },
        { status: 400 }
      );
    }

    if (challenge.code !== code.trim()) {
      challenge.attempts += 1;
      if (challenge.attempts >= 5) {
        await redis.del(redisKey);
        return NextResponse.json(
          { error: "Terlalu banyak percobaan salah. Silakan minta kode baru." },
          { status: 400 }
        );
      }
      await redis.set(redisKey, challenge, { ex: 300 });
      return NextResponse.json(
        {
          error: "Kode verifikasi salah.",
          remaining: 5 - challenge.attempts,
        },
        { status: 400 }
      );
    }

    // Update password in DB
    const updatedUser = await prisma.user.update({
      where: { id: challenge.userId },
      data: {
        passwordHash: hashPassword(newPassword),
      },
      include: {
        bookings: {
          select: {
            id: true,
            date: true,
            status: true,
          },
          orderBy: { date: "desc" },
        },
      },
    });

    await redis.del(redisKey);

    // Auto-login: Create session token & cookie
    const token = createSessionToken({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    const cookieStore = await cookies();
    cookieStore.set("padel_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600, // 30 days
    });

    const decryptedName = decryptPII(updatedUser.name) || "Pemain Padel";
    const decryptedPhone = updatedUser.phone ? decryptPII(updatedUser.phone) : null;

    return NextResponse.json({
      success: true,
      message: "Kata sandi berhasil diperbarui.",
      user: {
        id: updatedUser.id,
        name: decryptedName,
        email: updatedUser.email,
        phone: decryptedPhone,
        role: updatedUser.role.toLowerCase(),
        isVerified: true,
        createdAt: updatedUser.createdAt.toISOString(),
        totalBookings: updatedUser.bookings.length,
      },
    });
  } catch (error: any) {
    console.error("[API Auth Reset Password] Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengatur ulang kata sandi." },
      { status: 500 }
    );
  }
}
