"use client"

import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Grid2X2,
  RotateCcw,
  Search,
  Sliders,
  Timer,
  UserCheck,
} from "lucide-react"
import { api } from "@/lib/api"
import {
  button,
  dateLabel,
  endTime,
  field,
  money,
  outlineButton,
  today,
  useApp,
  type Booking,
} from "@/lib/club"
import { Spinner } from "@/components/ui"
import { LuxurySelect } from "./CustomUI"
import { customerName, useAdmin } from "./shared"

interface AdminLiveBoardProps {
  openDetail?: (booking: Booking) => void
}

function calculateCountdown(dateStr: string, startTimeStr: string, durationMinutes: number, now: Date, checkedInAt?: string) {
  const [endH, endM] = endTime(startTimeStr, durationMinutes).split(":").map(Number)
  const [bYear, bMonth, bDay] = dateStr.split("-").map(Number)
  let endTarget = new Date(bYear, bMonth - 1, bDay, endH, endM, 0)

  // Jika di-checkin di luar jadwal (misal mode testing/bypass untuk besok),
  // sesuaikan target durasi bermain dari waktu check-in agar timer tetap realistis
  if (checkedInAt) {
    const checkinTime = new Date(checkedInAt).getTime()
    if (!isNaN(checkinTime)) {
      const durationMs = durationMinutes * 60 * 1000
      const testModeEnd = new Date(checkinTime + durationMs)
      // Jika scheduled end lebih dari 2 jam di masa depan dari checkin (bukan sesi hari ini), gunakan durasi checkin
      if (endTarget.getTime() - now.getTime() > durationMs + 7200000) {
        endTarget = testModeEnd
      }
    }
  }

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
      text: overdueMinutes > 0 ? `Waktu habis (+${overdueMinutes}m)` : "Waktu habis",
      progressPercent: 100,
    }
  }

  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  let formattedText = ""
  if (hours > 0) {
    formattedText = `${hours}j ${mins}m ${secs}d`
  } else {
    formattedText = `${mins}m ${secs}d`
  }

  return {
    isExpired: false,
    text: `Sisa ${formattedText}`,
    progressPercent,
  }
}

export default function AdminLiveBoard({ openDetail }: AdminLiveBoardProps) {
  const { bookings, reload, notify } = useAdmin()
  const { club } = useApp()
  const [now, setNow] = useState<Date>(new Date())
  const [search, setSearch] = useState("")
  const [courtFilter, setCourtFilter] = useState("all")
  const [durationFilter, setDurationFilter] = useState("all")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<"waiting" | "playing" | "completed" | null>(null)

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

  const courtOptions = useMemo(() => [
    { value: "all", label: "Semua Lapangan" },
    ...(club?.courtOptions || [
      { id: "court-1", name: "Court 01 · Panoramic" },
      { id: "court-2", name: "Court 02 · Garden" },
      { id: "court-3", name: "Court 03 · Covered" },
    ]).map((item) => ({ value: String(item.id), label: item.name })),
  ], [club?.courtOptions])

  // Filter booking hari ini (atau semua jika bypass aktif) dengan search, filter lapangan, dan filter durasi
  const activeBookings = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bookings.filter((b) => {
      const matchDay = isBypass || b.date === todayStr || (b as any).manuallyReopened
      if (!matchDay) return false

      if (courtFilter !== "all") {
        const matchCourt =
          String(b.court) === courtFilter ||
          (b.courtName && b.courtName.toLowerCase().includes(courtFilter.toLowerCase()))
        if (!matchCourt) return false
      }

      if (durationFilter !== "all") {
        if (String(b.duration) !== durationFilter) return false
      }

      if (!q) return true
      const fullText = `${b.id} ${customerName(b)} ${b.customerContact || ""} ${b.courtName}`.toLowerCase()
      return fullText.includes(q)
    })
  }, [bookings, isBypass, todayStr, search, courtFilter, durationFilter])

  // Kolom 1: Menunggu Check-in (confirmed hari ini)
  const waitingList = useMemo(() => {
    return activeBookings
      .filter((b) => String(b.status).toLowerCase() === "confirmed")
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [activeBookings])

  // Kolom 2: Sedang Bermain (checked_in)
  const playingList = useMemo(() => {
    return activeBookings
      .filter((b) => String(b.status).toLowerCase() === "checked_in")
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [activeBookings])

  // Kolom 3: Selesai (completed hari ini)
  const completedList = useMemo(() => {
    return activeBookings
      .filter((b) => String(b.status).toLowerCase() === "completed")
      .sort((a, b) => b.time.localeCompare(a.time))
  }, [activeBookings])

  // Aksi interaktif: Check-in Pemain
  const handleCheckin = async (bookingId: string) => {
    setProcessingId(bookingId)
    try {
      await api.admin.checkin(bookingId)
      notify(`Pemain ${bookingId} berhasil check-in. Status: Sedang Bermain.`)
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

  // Aksi interaktif: Undo Check-in (Kembali ke Menunggu Check-in)
  const handleUndoCheckin = async (bookingId: string) => {
    setProcessingId(bookingId)
    try {
      await api.admin.undoCheckin(bookingId)
      notify(`Check-in ${bookingId} dibatalkan. Booking dikembalikan ke status Menunggu Check-in.`)
      await reload()
    } catch (err: any) {
      notify(err?.message || "Gagal membatalkan check-in.")
    } finally {
      setProcessingId(null)
    }
  }

  // Aksi interaktif: Undo Selesai (Kembali ke Sedang Bermain)
  const handleUndoComplete = async (bookingId: string) => {
    setProcessingId(bookingId)
    try {
      await api.admin.undoComplete(bookingId)
      notify(`Status selesai ${bookingId} dibatalkan. Pemain dikembalikan ke lapangan (Sedang Bermain).`)
      await reload()
    } catch (err: any) {
      notify(err?.message || "Gagal mengembalikan status booking.")
    } finally {
      setProcessingId(null)
    }
  }

  // Handle Drag and Drop antar kolom
  const handleDrop = (e: React.DragEvent, targetCol: "waiting" | "playing" | "completed") => {
    e.preventDefault()
    setDragOverCol(null)
    const bookingId = e.dataTransfer.getData("text/plain")
    const sourceCol = e.dataTransfer.getData("sourceCol")
    if (!bookingId || sourceCol === targetCol) return

    if (sourceCol === "waiting" && targetCol === "playing") {
      handleCheckin(bookingId)
    } else if (sourceCol === "playing" && targetCol === "waiting") {
      handleUndoCheckin(bookingId)
    } else if (sourceCol === "playing" && targetCol === "completed") {
      handleComplete(bookingId)
    } else if (sourceCol === "completed" && targetCol === "playing") {
      handleUndoComplete(bookingId)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar: Pencarian & Filter Dropdown (Sesuai Gaya Admin Bookings) */}
      <div className="flex flex-wrap items-center gap-3 border border-border bg-card p-4">
        <label className="relative min-w-52 flex-1">
          <span className="sr-only">Cari booking</span>
          <Search size={16} className="absolute top-3.5 left-3 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pemain, kode, atau lapangan…"
            className={`${field} min-h-11 pl-9`}
          />
        </label>
        <LuxurySelect
          ariaLabel="Filter Lapangan"
          value={courtFilter}
          onChange={(val) => setCourtFilter(String(val))}
          options={courtOptions}
          className="w-48"
        />
        <LuxurySelect
          ariaLabel="Filter Durasi"
          value={durationFilter}
          onChange={(val) => setDurationFilter(String(val))}
          options={[
            { value: "all", label: "Semua Durasi" },
            { value: "60", label: "60 Menit" },
            { value: "90", label: "90 Menit" },
            { value: "120", label: "120 Menit" },
          ]}
          className="w-40"
        />
        {(search || courtFilter !== "all" || durationFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearch("")
              setCourtFilter("all")
              setDurationFilter("all")
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline px-1"
          >
            Reset Filter
          </button>
        )}
      </div>

      {/* Mode Testing Notice (High-contrast & Brand consistent) */}
      {isBypass && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-secondary px-2.5 py-1 text-2xs font-semibold text-primary">
              <Sliders size={13} className="text-primary" />
              Mode Testing Aktif
            </span>
            <p className="text-xs text-foreground">
              Papan antrean menampilkan seluruh data booking dan mengizinkan check-in tanpa pembatasan jadwal operasional.
            </p>
          </div>
          <Link
            to="/admin/settings"
            className="text-xs font-medium text-primary underline hover:text-forest-hover"
          >
            Ubah di Pengaturan Klub →
          </Link>
        </div>
      )}

      {/* Kanban 3 Kolom dengan Drag and Drop & Undo */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ================= KOLOM 1: MENUNGGU CHECK-IN ================= */}
        <section
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverCol("waiting")
          }}
          onDragLeave={() => setDragOverCol(null)}
          onDrop={(e) => handleDrop(e, "waiting")}
          className={`flex flex-col border transition-all ${
            dragOverCol === "waiting"
              ? "border-primary ring-2 ring-primary/20 bg-primary/5"
              : "border-border bg-card"
          }`}
        >
          <header className="flex items-center justify-between border-b border-white/10 bg-forest-deep px-5 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center bg-white/15 text-white">
                <Clock size={15} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">Menunggu Check-in</h3>
                <p className="text-2xs text-white/70">Booking terkonfirmasi siap main (Tarik ke sini untuk batal check-in)</p>
              </div>
            </div>
            <span className="border border-white/20 bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white rounded-full">
              {waitingList.length}
            </span>
          </header>

          <div className="flex-1 space-y-3 p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
            {waitingList.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground border-2 border-dashed border-border/50">
                <Clock size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-medium">Tidak ada antrean check-in</p>
                <p className="mt-1 text-2xs">Tarik kartu booking ke sini untuk membatalkan check-in.</p>
              </div>
            ) : (
              waitingList.map((b) => (
                <article
                  key={b.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", b.id)
                    e.dataTransfer.setData("sourceCol", "waiting")
                    setDraggingId(b.id)
                  }}
                  onDragEnd={() => {
                    setDraggingId(null)
                    setDragOverCol(null)
                  }}
                  className={`cursor-grab active:cursor-grabbing border bg-background p-4 transition-all ${
                    draggingId === b.id
                      ? "opacity-40 scale-[0.98] border-dashed border-primary"
                      : "border-border hover:border-primary/50 shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-2xs font-semibold text-primary">{b.id}</span>
                      <h4 className="mt-1 text-sm font-semibold text-foreground">{customerName(b)}</h4>
                      <p className="text-2xs text-muted-foreground">{b.customerContact || "Kontak tidak dicatat"}</p>
                    </div>
                    <span className="border border-border bg-secondary px-2 py-0.5 text-2xs font-medium">
                      {money(b.total)}
                    </span>
                  </div>

                  <div className="mt-3.5 space-y-1.5 border-t border-border pt-3 text-xs">
                    <div className="flex items-center gap-2 text-foreground">
                      <Grid2X2 size={13} className="text-primary shrink-0" />
                      <span className="font-medium truncate">{b.courtName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-2xs">
                      <Clock size={12} className="shrink-0" />
                      <span>{dateLabel(b.date, true)} · {b.time}–{endTime(b.time, b.duration)} WIB ({b.duration} menit)</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={processingId === b.id}
                      onClick={() => handleCheckin(b.id)}
                      className={`${button} flex-1 !min-h-9 text-xs gap-1.5 bg-forest-deep hover:bg-forest-hover text-white justify-center`}
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
                        className={`${outlineButton} !min-h-9 px-3 text-xs`}
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
        <section
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverCol("playing")
          }}
          onDragLeave={() => setDragOverCol(null)}
          onDrop={(e) => handleDrop(e, "playing")}
          className={`flex flex-col border transition-all ${
            dragOverCol === "playing"
              ? "border-primary ring-2 ring-primary/20 bg-primary/5"
              : "border-border bg-card"
          }`}
        >
          <header className="flex items-center justify-between border-b border-white/10 bg-forest-deep px-5 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center bg-white/15 text-white">
                <Timer size={15} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Sedang Bermain</h3>
                  <span className="inline-flex items-center gap-1.5 bg-white/20 text-white px-2.5 py-0.5 text-2xs font-semibold rounded-full">
                    <span className="size-1.5 rounded-full bg-white animate-pulse" />
                    AKTIF
                  </span>
                </div>
                <p className="text-2xs text-white/70">Pemain berada di lapangan (Tarik ke sini untuk check-in / kembalikan)</p>
              </div>
            </div>
            <span className="border border-white/20 bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white rounded-full">
              {playingList.length}
            </span>
          </header>

          <div className="flex-1 space-y-3 p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
            {playingList.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground border-2 border-dashed border-border/50">
                <Timer size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-medium">Tidak ada sesi aktif saat ini</p>
                <p className="mt-1 text-2xs">Tarik kartu ke sini untuk check-in instan, atau klik Check-in.</p>
              </div>
            ) : (
              playingList.map((b) => {
                const countdown = calculateCountdown(b.date, b.time, b.duration, now, (b as any).checkedInAt)
                return (
                  <article
                    key={b.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", b.id)
                      e.dataTransfer.setData("sourceCol", "playing")
                      setDraggingId(b.id)
                    }}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setDragOverCol(null)
                    }}
                    className={`cursor-grab active:cursor-grabbing border p-4 transition-all ${
                      draggingId === b.id
                        ? "opacity-40 scale-[0.98] border-dashed border-primary"
                        : countdown.isExpired
                          ? "border-destructive/60 bg-danger-soft/20 shadow-xs"
                          : "border-primary/40 bg-background hover:border-primary shadow-xs"
                    }`}
                  >
                    {/* Header Kartu */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 bg-secondary px-2 py-0.5 text-2xs font-medium text-foreground">
                        <Grid2X2 size={12} className="text-primary" />
                        {b.courtName}
                      </span>
                      <span className="text-2xs text-muted-foreground">{b.id}</span>
                    </div>

                    {/* Informasi Pemain */}
                    <div className="mt-2.5">
                      <h4 className="text-sm font-semibold text-foreground">{customerName(b)}</h4>
                      <p className="text-2xs text-muted-foreground">
                        {dateLabel(b.date, true)} · {b.time}–{endTime(b.time, b.duration)} WIB ({b.duration} menit)
                      </p>
                    </div>

                    {/* Live Countdown & Progress Bar */}
                    <div className="mt-3.5 space-y-2 border border-border bg-surface p-3">
                      <div className="flex items-center justify-between text-2xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          {countdown.isExpired ? (
                            <AlertTriangle size={13} className="text-destructive shrink-0" />
                          ) : (
                            <Clock size={13} className="text-primary shrink-0" />
                          )}
                          {countdown.isExpired ? "Durasi bermain selesai" : "Sisa waktu bermain"}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            countdown.isExpired ? "text-destructive" : "text-primary"
                          }`}
                        >
                          {countdown.text}
                        </span>
                      </div>

                      {/* Bar progres durasi main */}
                      <div className="h-1.5 w-full bg-border overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            countdown.isExpired ? "bg-destructive" : "bg-forest-deep"
                          }`}
                          style={{ width: `${countdown.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Tombol Interaktif: Selesai Bermain, Undo Check-in, & Detail */}
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={processingId === b.id}
                        onClick={() => handleComplete(b.id)}
                        className={`${button} flex-1 !min-h-9 text-xs gap-1.5 ${
                          countdown.isExpired
                            ? "bg-destructive hover:bg-destructive/90 text-white"
                            : "bg-forest-deep hover:bg-forest-hover text-white"
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

                      <button
                        type="button"
                        disabled={processingId === b.id}
                        onClick={() => handleUndoCheckin(b.id)}
                        className={`${outlineButton} !min-h-9 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground`}
                        title="Batalkan check-in (Kembalikan ke antrean)"
                        aria-label="Batalkan check-in"
                      >
                        <RotateCcw size={13} />
                        <span className="hidden sm:inline">Batal</span>
                      </button>

                      {openDetail && (
                        <button
                          type="button"
                          onClick={() => openDetail(b)}
                          className={`${outlineButton} !min-h-9 px-3 text-xs`}
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
        <section
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverCol("completed")
          }}
          onDragLeave={() => setDragOverCol(null)}
          onDrop={(e) => handleDrop(e, "completed")}
          className={`flex flex-col border transition-all ${
            dragOverCol === "completed"
              ? "border-primary ring-2 ring-primary/20 bg-primary/5"
              : "border-border bg-card"
          }`}
        >
          <header className="flex items-center justify-between border-b border-white/10 bg-forest-deep px-5 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center bg-white/15 text-white">
                <CheckCircle2 size={15} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">Selesai</h3>
                <p className="text-2xs text-white/70">Sesi tuntas & siap dirotasi (Tarik ke sini untuk selesai)</p>
              </div>
            </div>
            <span className="border border-white/20 bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white rounded-full">
              {completedList.length}
            </span>
          </header>

          <div className="flex-1 space-y-3 p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
            {completedList.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground border-2 border-dashed border-border/50">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-medium">Belum ada sesi selesai</p>
                <p className="mt-1 text-2xs">Tarik kartu yang sudah selesai ke kolom ini.</p>
              </div>
            ) : (
              completedList.map((b) => (
                <article
                  key={b.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", b.id)
                    e.dataTransfer.setData("sourceCol", "completed")
                    setDraggingId(b.id)
                  }}
                  onDragEnd={() => {
                    setDraggingId(null)
                    setDragOverCol(null)
                  }}
                  className={`cursor-grab active:cursor-grabbing border bg-background p-3.5 transition-all ${
                    draggingId === b.id
                      ? "opacity-40 scale-[0.98] border-dashed border-primary"
                      : "border-border hover:border-border shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-2xs text-muted-foreground">{b.id}</span>
                      <h4 className="mt-0.5 text-xs font-semibold text-foreground">{customerName(b)}</h4>
                    </div>
                    <span className="inline-flex items-center gap-1 border border-border bg-secondary px-2 py-0.5 text-2xs font-medium text-foreground">
                      <CheckCircle2 size={11} className="text-forest-muted" /> Selesai
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-2xs text-muted-foreground border-t border-border pt-2">
                    <span className="truncate">{b.courtName}</span>
                    <span>{b.time}–{endTime(b.time, b.duration)} WIB</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                    <button
                      type="button"
                      disabled={processingId === b.id}
                      onClick={() => handleUndoComplete(b.id)}
                      className="inline-flex min-h-8 items-center justify-center gap-1.5 border border-border bg-white px-2.5 text-2xs font-medium text-foreground shadow-2xs hover:bg-surface hover:border-primary/50 transition-colors"
                      title="Kembalikan ke kolom Sedang Bermain"
                    >
                      <RotateCcw size={11} /> Kembalikan ke Lapangan
                    </button>

                    {openDetail && (
                      <button
                        type="button"
                        onClick={() => openDetail(b)}
                        className="text-2xs text-primary hover:underline font-medium"
                      >
                        Detail →
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
