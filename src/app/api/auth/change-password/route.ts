import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  verifySessionToken,
  verifyPassword,
  hashPassword,
} from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("padel_session")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Silakan masuk terlebih dahulu." },
        { status: 401 }
      );
    }

    const session = verifySessionToken(token);
    if (!session || !session.id) {
      return NextResponse.json(
        { error: "Sesi login berakhir. Silakan masuk kembali." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Kata sandi saat ini dan kata sandi baru wajib diisi." },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Kata sandi baru minimal 8 karakter." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    // Verify current password
    if (user.passwordHash) {
      const isValid = verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Kata sandi saat ini salah." },
          { status: 400 }
        );
      }
    }

    // Update with new password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(newPassword),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Kata sandi berhasil diperbarui.",
    });
  } catch (error: any) {
    console.error("[API Auth Change Password] Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengubah kata sandi." },
      { status: 500 }
    );
  }
}
