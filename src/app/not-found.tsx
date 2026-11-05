import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <main className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center overflow-y-auto bg-[#0F1715] px-6 text-center text-[#F5F3EB]">
      {/* Subtle luxury badge */}
      <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-1.5 text-2xs font-semibold uppercase tracking-widest text-[#B4C29D]">
        <span>404 · Error · Out of Bounds</span>
      </div>

      {/* Massive 404 headline */}
      <h1 className="mt-6 font-display text-8xl font-bold tracking-tight text-[#F5F3EB] sm:text-9xl md:text-[11rem] select-none leading-none">
        404
      </h1>

      <div className="my-6 h-0.5 w-16 bg-[#C49A6C]/60" />

      {/* Friendly description */}
      <h2 className="font-display text-2xl font-semibold tracking-tight text-[#F5F3EB] sm:text-3xl">
        Halaman Tidak Ditemukan
      </h2>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-[#F5F3EB]/70">
        Jadwal atau halaman yang kamu tuju mungkin telah dipindahkan, dibatalkan, atau tautan tidak valid. Mari kembali ke arena.
      </p>

      {/* Primary CTA */}
      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center justify-center gap-2.5 border border-[#B4C29D]/40 bg-[#B4C29D] px-7 py-3 text-xs font-semibold uppercase tracking-wider text-[#0F1715] transition duration-200 hover:bg-[#c2cfae] shadow-lg"
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Beranda</span>
        </Link>
      </div>

      {/* Luxury Club Accent */}
      <p className="mt-14 font-mono text-2xs uppercase tracking-widest text-[#F5F3EB]/40">
        Rally Padel Club · Jakarta Selatan
      </p>
    </main>
  )
}
