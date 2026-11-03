"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Grid2X2,
  RefreshCw,
  Search,
  Timer,
  User,
  UserCheck,
} from "lucide-react"
import { api } from "../api"
import {
  button,
  dateLabel,
  endTime,
  eyebrow,
  money,
  outlineButton,
  today,
  type Booking,
} from "../club"
import { Spinner } from "../ui"
import { customerName, initials, useAdmin } from "./shared"

interface AdminLiveBoardProps {
  openDetail?: (booking: Booking) => void
}

function calculateCountdown(dateStr: string, startTimeStr: string, durationMinutes: number, now: Date) {
  const [endH, endM] = endTime(startTimeStr, durationMinutes).split(":").map(Number)
  const [bYear, bMonth, bDay] = dateStr.split("-").map(Number)
  const endTarget = new Date(bYear, bMonth - 1, bDay, endH, endM, 0)
  const diffMs = endTarget.getTime() - now.getTime()
  const totalSeconds = Math.floor(diffMs / 1000)

  const [startH, startM] = startTimeStr.split(":").map(Number)
  const startTarget = new Date(bYear, bMonth - 1, bDay, startH, startM, 0)
  const totalDurationMs = durationMinutes * 60 * 1000
  const elapsedMs = Math.max(0, now.getTime() - startTarget.getTime())
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)))

  if (totalSeconds <= 0) {
    const overdueMinutes = Math.floor(Math.abs(totalSeconds) / 60)
    return {
      isExpired: true,
      text: `Waktu Habis (+${overdueMinutes}m lewat)`,
      progressPercent: 100,
    }
  }

  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return {
    isExpired: false,
    text: `Sisa ${mins}m ${String(secs).padStart(2, "0")}s`,
    progressPercent,
  }
}

export default function AdminLiveBoard({ openDetail }: AdminLiveBoardProps) {
  const { bookings, reload, notify } = useAdmin()
  const [now, setNow] = useState<Date>(new Date())
  const [search, setSearch] = useState("")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Baca status Mode Testing / Bypass dari localStorage
  const [isBypass, setIsBypass] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("padel_bypass_checkin_mode") === "true"
    }
    return false
  })

  // Timer countdown real-time setiap detik
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Listener perubahan storage untuk mode bypass
  useEffect(() => {
    const handleStorage = () => {
      if (typeof window !== "undefined") {
        setIsBypass(localStorage.getItem("padel_bypass_checkin_mode") === "true")
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const todayStr = today()

  // Filter booking hari ini (atau semua jika bypass aktif)
  const activeBookings = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bookings.filter((b) => {
      const matchDay = isBypass || b.date === todayStr
      if (!matchDay) return false
      if (!q) return true
      const fullText = `${b.id} ${customerName(b)} ${b.customerContact || ""} ${b.courtName}`.toLowerCase()
      return fullText.includes(q)
    })
  }, [bookings, isBypass, todayStr, search])

  // Kolom 1: Menunggu Check-in (confirmed hari ini)
  const waitingList = useMemo(() => {
    return activeBookings
      .filter((b) => b.status === "confirmed")
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [activeBookings])

  // Kolom 2: Sedang Bermain (checked_in)
  const playingList = useMemo(() => {
    return activeBookings
      .filter((b) => b.status === "checked_in")
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [activeBookings])

  // Kolom 3: Selesai (completed hari ini)
  const completedList = useMemo(() => {
    return activeBookings
      .filter((b) => b.status === "completed")
      .sort((a, b) => b.time.localeCompare(a.time))
  }, [activeBookings])

  // Aksi interaktif: Check-in Pemain
  const handleCheckin = async (bookingId: string) => {
    setProcessingId(bookingId)
    try {
      await api.admin.checkin(bookingId)
      notify(`Pemain booking ${bookingId} berhasil check-in. Status: Sedang Bermain.`)
      await reload()
    } catch (err: any) {
      notify(err?.message || "Gagal melakukan check-in pemain.")
    } finally {
      setProcessingId(null)
    }
  }

  // Aksi interaktif: Selesai Bermain
  const handleComplete = async (bookingId: string) => {
    setProcessingId(bookingId)
    try {
      await api.admin.complete(bookingId)
      notify(`Booking ${bookingId} telah selesai. Lapangan siap dibersihkan dan rotasi pemain.`)
      await reload()
    } catch (err: any) {
      notify(err?.message || "Gagal menandai booking selesai.")
    } finally {
      setProcessingId(null)
    }
  }

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await reload()
      notify("Data antrean lapangan berhasil diperbarui.")
    } finally {
      setIsRefreshing(false)
    }
  }

  const currentTimeStr = now.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  return (
    <div className="space-y-6">
      {/* Header Bar: Status Real-time & Ringkasan */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-border bg-card p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center bg-primary text-primary-foreground">
            <Activity size={22} strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl">Live Queue Board</h2>
              <span className="flex items-center gap-1.5 border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-2xs font-bold text-primary">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                LIVE {currentTimeStr} WIB
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pemantauan rotasi lapangan dan status antrean pertandingan hari ini ({dateLabel(todayStr, true)}).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-48">
            <Search size={14} className="absolute top-3 left-3 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pemain atau lapangan…"
              className="w-full border border-border bg-background py-1.5 pr-3 pl-8 text-xs focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className={`${outlineButton} !min-h-9 text-xs gap-1.5`}
            aria-label="Segarkan data antrean"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} /> Segarkan
          </button>
        </div>
      </div>

      {/* Mode Testing Notice (jika aktif) */}
      {isBypass && (
        <div className="flex items-center gap-2.5 border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Mode Testing Aktif:</strong> Papan antrean menampilkan seluruh data booking dan mengizinkan check-in tanpa pembatasan jadwal operasional. Ubah di Pengaturan Klub.
          </span>
        </div>
      )}

      {/* Kanban 3 Kolom */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ================= KOLOM 1: MENUNGGU CHECK-IN ================= */}
        <section className="flex flex-col border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center bg-secondary text-primary">
                <Clock size={15} />
              </span>
              <div>
                <h3 className="font-display text-base">Menunggu Check-in</h3>
                <p className="text-3xs text-muted-foreground">Booking terkonfirmasi siap main</p>
              </div>
            </div>
            <span className="border border-border bg-secondary px-2.5 py-0.5 font-mono text-xs font-bold text-foreground">
              {waitingList.length}
            </span>
          </header>

          <div className="flex-1 space-y-3.5 p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
            {waitingList.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <Clock size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-medium">Tidak ada antrean check-in</p>
                <p className="mt-1 text-2xs">Semua booking hari ini sudah check-in atau belum ada jadwal baru.</p>
              </div>
            ) : (
              waitingList.map((b) => (
                <article
                  key={b.id}
                  className="group relative border border-border/80 bg-background p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-2xs font-bold text-primary">{b.id}</span>
                      <h4 className="mt-1 text-sm font-semibold text-foreground">{customerName(b)}</h4>
                      <p className="text-2xs text-muted-foreground">{b.customerContact || "Kontak tidak dicatat"}</p>
                    </div>
                    <span className="border border-border/60 bg-secondary/80 px-2 py-0.5 font-mono text-2xs font-medium">
                      {money(b.total)}
                    </span>
                  </div>

                  <div className="mt-3.5 space-y-1.5 border-t border-border/50 pt-3 text-xs">
                    <div className="flex items-center gap-2 text-foreground/90">
                      <Grid2X2 size={13} className="text-primary shrink-0" />
                      <span className="font-medium truncate">{b.courtName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock size={13} className="shrink-0" />
                      <span>{b.time}–{endTime(b.time, b.duration)} WIB · {b.duration} menit</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={processingId === b.id}
                      onClick={() => handleCheckin(b.id)}
                      className={`${button} flex-1 !min-h-9 text-xs gap-1.5 bg-forest-dark hover:bg-forest text-white justify-center`}
                    >
                      {processingId === b.id ? (
                        <Spinner className="text-white" />
                      ) : (
                        <>
                          <UserCheck size={14} /> Check-in Pemain
                        </>
                      )}
                    </button>
                    {openDetail && (
                      <button
                        type="button"
                        onClick={() => openDetail(b)}
                        className={`${outlineButton} !min-h-9 px-3 text-2xs`}
                        aria-label={`Lihat detail booking ${b.id}`}
                      >
                        Detail
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* ================= KOLOM 2: SEDANG BERMAIN ================= */}
        <section className="flex flex-col border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border bg-emerald-500/10 dark:bg-emerald-950/30 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-base">Sedang Bermain</h3>
                  <span className="bg-emerald-500/20 px-1.5 py-0.2 font-mono text-3xs font-bold text-emerald-800 dark:text-emerald-300">
                    AKTIF
                  </span>
                </div>
                <p className="text-3xs text-muted-foreground">Pemain berada di lapangan</p>
              </div>
            </div>
            <span className="border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-900 dark:text-emerald-200">
              {playingList.length}
            </span>
          </header>

          <div className="flex-1 space-y-3.5 p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
            {playingList.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <Timer size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-medium">Tidak ada sesi aktif saat ini</p>
                <p className="mt-1 text-2xs">Pemain yang check-in akan otomatis tampil dengan live countdown di sini.</p>
              </div>
            ) : (
              playingList.map((b) => {
                const countdown = calculateCountdown(b.date, b.time, b.duration, now)
                return (
                  <article
                    key={b.id}
                    className={`group relative border p-4 transition-all ${
                      countdown.isExpired
                        ? "border-amber-500 bg-amber-500/10 shadow-sm"
                        : "border-emerald-500/40 bg-background shadow-xs hover:border-emerald-600"
                    }`}
                  >
                    {/* Header Kartu: Status Pulsing & Kode */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="relative flex size-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                        </span>
                        <span className="font-mono text-2xs font-bold text-emerald-700 dark:text-emerald-400">
                          {b.courtName}
                        </span>
                      </div>
                      <span className="font-mono text-3xs text-muted-foreground">{b.id}</span>
                    </div>

                    {/* Informasi Pemain */}
                    <div className="mt-2.5">
                      <h4 className="text-sm font-semibold text-foreground">{customerName(b)}</h4>
                      <p className="text-2xs text-muted-foreground">
                        Jadwal: {b.time}–{endTime(b.time, b.duration)} WIB ({b.duration} menit)
                      </p>
                    </div>

                    {/* Live Countdown & Progress Bar */}
                    <div className="mt-3.5 space-y-2 rounded-sm border border-border/70 bg-secondary/50 p-2.5">
                      <div className="flex items-center justify-between text-2xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                          {countdown.isExpired ? (
                            <AlertTriangle size={13} className="text-amber-600 animate-bounce" />
                          ) : (
                            <Clock size={13} className="text-emerald-600" />
                          )}
                          Sisa Waktu Bermain:
                        </span>
                        <span
                          className={`font-mono text-xs font-bold ${
                            countdown.isExpired
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {countdown.text}
                        </span>
                      </div>

                      {/* Bar progres durasi main */}
                      <div className="h-1.5 w-full overflow-hidden bg-border/60">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            countdown.isExpired ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${countdown.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Tombol Interaktif: Selesai Bermain */}
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={processingId === b.id}
                        onClick={() => handleComplete(b.id)}
                        className={`${button} flex-1 !min-h-9 text-xs gap-1.5 ${
                          countdown.isExpired
                            ? "bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        } justify-center`}
                      >
                        {processingId === b.id ? (
                          <Spinner className="text-white" />
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Selesai Bermain
                          </>
                        )}
                      </button>
                      {openDetail && (
                        <button
                          type="button"
                          onClick={() => openDetail(b)}
                          className={`${outlineButton} !min-h-9 px-3 text-2xs`}
                          aria-label={`Lihat detail booking ${b.id}`}
                        >
                          Detail
                        </button>
                      )}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>

        {/* ================= KOLOM 3: SELESAI ================= */}
        <section className="flex flex-col border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center bg-secondary text-primary">
                <CheckCircle2 size={15} />
              </span>
              <div>
                <h3 className="font-display text-base">Selesai</h3>
                <p className="text-3xs text-muted-foreground">Sesi tuntas & siap dirotasi</p>
              </div>
            </div>
            <span className="border border-border bg-secondary px-2.5 py-0.5 font-mono text-xs font-bold text-foreground">
              {completedList.length}
            </span>
          </header>

          <div className="flex-1 space-y-3 p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
            {completedList.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-medium">Belum ada sesi selesai</p>
                <p className="mt-1 text-2xs">Sesi yang ditandai selesai akan diarsipkan di sini.</p>
              </div>
            ) : (
              completedList.map((b) => (
                <article
                  key={b.id}
                  className="border border-border/70 bg-background/80 p-3.5 transition-colors hover:border-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-2xs text-muted-foreground">{b.id}</span>
                      <h4 className="mt-0.5 text-xs font-semibold text-foreground">{customerName(b)}</h4>
                    </div>
                    <span className="inline-flex items-center gap-1 border border-border bg-secondary px-2 py-0.5 text-3xs font-medium text-muted-foreground">
                      <CheckCircle2 size={11} className="text-forest-muted" /> Selesai
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-2xs text-muted-foreground border-t border-border/40 pt-2">
                    <span className="truncate">{b.courtName}</span>
                    <span className="font-mono">{b.time}–{endTime(b.time, b.duration)} WIB</span>
                  </div>

                  {openDetail && (
                    <div className="mt-3 pt-2 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => openDetail(b)}
                        className="text-2xs text-primary hover:underline font-medium"
                      >
                        Lihat Rincian Sesi →
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
