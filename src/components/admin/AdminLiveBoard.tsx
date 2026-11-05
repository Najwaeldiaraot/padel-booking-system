"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Grid2X2,
  QrCode,
  RotateCcw,
  ScanLine,
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
import { customerName, useAdmin, AdminDialog } from "./shared"

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

  // State Dialog Validasi Tiket & Scanner Kamera
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false)
  const [ticketInput, setTicketInput] = useState("")
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scannedBooking, setScannedBooking] = useState<Booking | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | number | null>(null)

  // Audio feedback (beep) saat QR berhasil terbaca
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    } catch {
      // AudioContext dibatasi browser sebelum interaksi user
    }
  }

  // Haptic feedback
  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([100, 50, 100])
    }
  }

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current as any)
      scanIntervalRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }

  const startCamera = async () => {
    setCameraError(null)
    setValidationError(null)
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError("Perangkat atau peramban tidak mendukung akses kamera.")
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      mediaStreamRef.current = stream
      setIsCameraActive(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    } catch (err: any) {
      console.error("Camera access error:", err)
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Izin akses kamera ditolak. Silakan izinkan akses kamera di pengaturan peramban."
          : "Gagal mengakses kamera: " + (err.message || "Pastikan kamera tidak digunakan aplikasi lain.")
      )
      setIsCameraActive(false)
    }
  }

  // Bersihkan stream kamera saat unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const cleanTicketCode = (raw: string): string => {
    let text = raw.trim()
    if (text.includes("://") || text.includes("/")) {
      const parts = text.split("/").filter(Boolean)
      text = parts[parts.length - 1]
    }
    if (text.includes("?id=")) {
      text = text.split("?id=")[1].split("&")[0]
    }
    return text.trim()
  }

  const handleValidateAndCheckin = async (codeToValidate?: string) => {
    const raw = (codeToValidate ?? ticketInput).trim()
    if (!raw) {
      setValidationError("Silakan masukkan atau scan kode booking / tiket.")
      return
    }

    const code = cleanTicketCode(raw)
    setIsValidating(true)
    setValidationError(null)

    // Cari booking di state aktif terlebih dahulu
    const target = bookings.find(
      (b) =>
        b.id.toLowerCase() === code.toLowerCase() ||
        (b as any).code?.toLowerCase() === code.toLowerCase()
    )

    if (target) {
      setScannedBooking(target)
      const st = String(target.status).toLowerCase()

      if (st === "checked_in") {
        setValidationError(`Pemain sudah check-in sebelumnya (${target.id} · ${customerName(target)}). Status saat ini: Sedang Bermain.`)
        setIsValidating(false)
        return
      }

      if (st === "completed") {
        setValidationError(`Sesi bermain booking ${target.id} sudah selesai.`)
        setIsValidating(false)
        return
      }

      if (st === "cancelled") {
        setValidationError(`Booking ${target.id} berstatus Dibatalkan (${target.cancelReason || "Batal"}).`)
        setIsValidating(false)
        return
      }

      try {
        await api.admin.checkin(target.id)
        notify(`Check-in berhasil! Pemain ${customerName(target)} (${target.courtName}) siap bermain.`)
        await reload()
        setIsTicketDialogOpen(false)
        setTicketInput("")
        setScannedBooking(null)
      } catch (err: any) {
        setValidationError(err?.message || "Gagal melakukan check-in pemain.")
      } finally {
        setIsValidating(false)
      }
      return
    }

    // Jika tidak ditemukan di memory lokal, panggil API backend
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin" }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Booking tidak ditemukan atau gagal divalidasi.")
      }
      notify(`Check-in berhasil untuk tiket ${code}!`)
      await reload()
      setIsTicketDialogOpen(false)
      setTicketInput("")
      setScannedBooking(null)
    } catch (err: any) {
      setValidationError(err.message || `Kode tiket / booking "${code}" tidak ditemukan.`)
    } finally {
      setIsValidating(false)
    }
  }

  const handleQrScanned = async (rawValue: string) => {
    playBeep()
    triggerHaptic()
    stopCamera()

    const extracted = cleanTicketCode(rawValue)
    setTicketInput(extracted)
    await handleValidateAndCheckin(extracted)
  }

  // Loop pembacaan frame video kamera
  useEffect(() => {
    if (!isCameraActive) return

    let isScanning = true

    const detectFrame = async () => {
      if (!videoRef.current || !isScanning) return
      const video = videoRef.current
      if (video.readyState < 2) return

      if ("BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
          const barcodes = await detector.detect(video)
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            isScanning = false
            handleQrScanned(barcodes[0].rawValue)
            return
          }
        } catch {
          // Frame decode error, continue
        }
      }
    }

    scanIntervalRef.current = setInterval(detectFrame, 250)

    return () => {
      isScanning = false
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current as any)
        scanIntervalRef.current = null
      }
    }
  }, [isCameraActive])

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
      {/* Filter Bar: Pencarian, Tombol Validasi Tiket / Scanner QR, & Filter Dropdown */}
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
        <button
          type="button"
          onClick={() => {
            setIsTicketDialogOpen(true)
            setTicketInput("")
            setValidationError(null)
            setCameraError(null)
            setScannedBooking(null)
          }}
          className={`${button} bg-forest-deep hover:bg-forest-hover text-white flex items-center gap-2 text-xs font-semibold px-4 min-h-11 shadow-xs shrink-0`}
        >
          <QrCode size={16} />
          <span>Validasi Tiket (QR)</span>
        </button>
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

      {/* Modal Dialog Validasi Tiket & Scanner Kamera */}
      {isTicketDialogOpen && (
        <AdminDialog
          title="Validasi Tiket Pemain"
          close={() => {
            stopCamera()
            setIsTicketDialogOpen(false)
            setValidationError(null)
            setCameraError(null)
          }}
          wide
        >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Arahkan kamera ke QR code tiket pemain untuk check-in instan, atau masukkan kode booking secara manual.
            </p>

            {/* Area Scanner Kamera */}
            <div className="border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ScanLine size={16} className="text-primary" />
                  <span className="text-xs font-semibold text-foreground">Kamera Pemindai QR</span>
                </div>
                {isCameraActive ? (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
                  >
                    <CameraOff size={14} /> Tutup Kamera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-forest-deep hover:bg-forest-hover transition-colors shadow-2xs"
                  >
                    <Camera size={14} /> Buka Scanner Kamera
                  </button>
                )}
              </div>

              {isCameraActive && (
                <div className="relative overflow-hidden rounded border border-border bg-black aspect-video max-h-72 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Viewfinder Target Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="relative size-48 sm:size-56 border-2 border-primary/80 rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary -mt-1 -ml-1" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary -mt-1 -mr-1" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary -mb-1 -ml-1" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary -mb-1 -mr-1" />
                      {/* Laser scanning line */}
                      <div className="w-full h-0.5 bg-primary/80 shadow-[0_0_8px_rgba(34,197,94,0.9)] animate-pulse mt-24" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <span className="bg-black/75 px-3 py-1 text-2xs font-medium text-white rounded">
                      Mendeteksi QR Code secara otomatis...
                    </span>
                  </div>
                </div>
              )}

              {cameraError && (
                <div className="mt-2.5 flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Kendala Akses Kamera</p>
                    <p className="mt-0.5 text-2xs opacity-90">{cameraError}</p>
                    <p className="mt-1 text-2xs">Anda tetap dapat memasukkan kode tiket secara manual di bawah.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Input Manual Kode Booking / Tiket */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleValidateAndCheckin()
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium mb-1.5 text-foreground">
                  Kode Booking / Nomor Tiket
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ticketInput}
                    onChange={(e) => {
                      setTicketInput(e.target.value)
                      setValidationError(null)
                    }}
                    placeholder="Contoh: RLY-20261103-8821 atau b-01"
                    className={`${field} flex-1 min-h-11 uppercase font-mono tracking-wider text-xs`}
                  />
                  <button
                    type="submit"
                    disabled={isValidating || !ticketInput.trim()}
                    className={`${button} bg-forest-deep hover:bg-forest-hover text-white px-5 min-h-11 text-xs shrink-0 font-medium`}
                  >
                    {isValidating ? <Spinner className="text-white" /> : "Validasi & Check-in"}
                  </button>
                </div>
              </div>

              {validationError && (
                <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </form>

            {/* Preview Booking Jika Ditemukan */}
            {scannedBooking && (
              <div className="border border-border bg-secondary/40 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{customerName(scannedBooking)}</span>
                  <span className="font-mono text-2xs text-primary">{scannedBooking.id}</span>
                </div>
                <p className="text-muted-foreground text-2xs">
                  {scannedBooking.courtName} · {dateLabel(scannedBooking.date, true)} ({scannedBooking.time} WIB)
                </p>
              </div>
            )}
          </div>
        </AdminDialog>
      )}
    </div>
  )
}
