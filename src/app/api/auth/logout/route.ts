import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("padel_session");
    return NextResponse.json({ success: true, message: "Berhasil keluar." });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal keluar." },
      { status: 500 }
    );
  }
}
