import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-16 bg-[#F5F3EB] text-[#183D32]">
      {/* Editorial Court Graphic / Watermark */}
      <div className="relative flex flex-col items-center text-center max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 border border-[#183D32]/20 bg-[#E9EDE2]/70 px-3.5 py-1 text-2xs font-semibold uppercase tracking-widest text-[#183D32] mb-6">
          <span>Error 404 · Out of Bounds</span>
        </div>

        {/* Large Editorial Headline */}
        <h1 className="font-display text-8xl sm:text-9xl font-bold tracking-tight text-[#183D32] leading-none select-none">
          404
        </h1>

        <div className="my-6 h-0.5 w-16 bg-[#9B7058]" />

        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#183D32]">
          Halaman Tidak Ditemukan
        </h2>

        <p className="mt-3 text-sm sm:text-base text-[#183D32]/75 leading-relaxed max-w-md">
          Bola keluar dari garis batas lapangan atau tautan yang Anda tuju telah dipindahkan.
          Mari kembali ke arena untuk melanjutkan permainan.
        </p>

        {/* CTA Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            href="/"
            className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2.5 border border-[#183D32] bg-transparent px-6 text-sm font-medium text-[#183D32] transition duration-200 hover:bg-[#183D32]/10"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Beranda</span>
          </Link>

          <Link
            href="/#booking"
            className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2.5 bg-[#183D32] px-6 text-sm font-medium text-white transition duration-200 hover:bg-[#295545] shadow-sm"
          >
            <Calendar size={16} />
            <span>Reservasi Lapangan</span>
          </Link>
        </div>

        {/* Subtle Club Microprint */}
        <p className="mt-12 text-2xs uppercase tracking-widest text-[#183D32]/50 font-mono">
          Rally Padel Club · Jakarta Selatan
        </p>
      </div>
    </main>
  );
}
