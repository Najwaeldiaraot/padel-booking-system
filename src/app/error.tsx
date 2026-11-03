"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home, AlertCircle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging purposes
    console.error("[Rally Padel App Error]:", error);
  }, [error]);

  return (
    <main className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-16 bg-[#F5F3EB] text-[#183D32]">
      <div className="relative flex flex-col items-center text-center max-w-xl mx-auto">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 border border-[#B34936]/30 bg-[#F7E9E4] px-3.5 py-1 text-2xs font-semibold uppercase tracking-widest text-[#B34936] mb-6">
          <AlertCircle size={14} />
          <span>Error 500 · Kendala Teknis</span>
        </div>

        {/* Big Editorial Headline */}
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#183D32] leading-tight">
          Terjadi Gangguan Operasional
        </h1>

        <div className="my-6 h-0.5 w-16 bg-[#9B7058]" />

        <p className="text-sm sm:text-base text-[#183D32]/80 leading-relaxed max-w-md">
          Sistem mendeteksi adanya kendala saat memproses permintaan Anda. Tim operasional klub
          telah mencatat insiden ini untuk segera ditangani.
        </p>

        {error.digest && (
          <div className="mt-4 font-mono text-2xs text-[#183D32]/60 bg-white/60 border border-[#DCDED2] px-3 py-1">
            Kode Insiden: {error.digest}
          </div>
        )}

        {/* CTA Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2.5 bg-[#183D32] px-6 text-sm font-medium text-white transition duration-200 hover:bg-[#295545] shadow-sm"
          >
            <RotateCcw size={16} />
            <span>Coba Muat Ulang</span>
          </button>

          <Link
            href="/"
            className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2.5 border border-[#183D32] bg-transparent px-6 text-sm font-medium text-[#183D32] transition duration-200 hover:bg-[#183D32]/10"
          >
            <Home size={16} />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>

        {/* Concierge Microprint */}
        <p className="mt-12 text-2xs uppercase tracking-widest text-[#183D32]/50 font-mono">
          Rally Padel Club · Butuh bantuan cepat? Hubungi halo@rallypadel.club
        </p>
      </div>
    </main>
  );
}
