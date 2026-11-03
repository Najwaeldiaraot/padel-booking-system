import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  LockKeyhole,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Sliders,
  Star,
  Trash2,
  TrendingUp,
} from "lucide-react"
import { api } from "../api"
import {
  button,
  dangerButton,
  dateLabel,
  endTime,
  eyebrow,
  field,
  money,
  nextDay,
  outlineButton,
  paymentMethodLabel,
  ratingSummary,
  startsAt,
  textLink,
  today,
  useApp,
  type Booking,
} from "../club"
import { errorMessage } from "../i18n"
import { ScrollArea, Spinner } from "../ui"
import { LuxurySelect, LuxuryDatePicker } from "./CustomUI"
import {
  AdminDialog,
  DatePicker,
  Empty,
  PaymentBadge,
  Panel,
  StatusBadge,
  adminSelect,
  availableStarts,
  customerName,
  downloadCsv,
  id,
  initials,
  useAdmin,
} from "./shared"
import { AdminLiveOperations } from "./AdminLiveOperations"

/* ---------- Shared building blocks ---------- */

export function useDebounce<T>(value: T, delay = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export function TestingModeCard() {
  const { notify } = useAdmin()
  const [bypassMode, setBypassMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("padel_bypass_checkin_mode") === "true"
    }
    return false
  })

  const toggleBypass = () => {
    const next = !bypassMode
    setBypassMode(next)
    if (typeof window !== "undefined") {
      localStorage.setItem("padel_bypass_checkin_mode", String(next))
      window.dispatchEvent(new Event("storage"))
    }
    notify(
      next
        ? "Mode Testing Aktif: Check-in dapat dilakukan kapan saja tanpa batasan tanggal/jam."
        : "Mode Normal Aktif: Check-in dibatasi ketat sesuai jadwal hari ini dan jam bermain."
    )
  }

  return (
    <Panel>
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center bg-secondary text-primary">
              <Sliders size={20} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl">Mode Testing (Bypass Check-in)</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold ${bypassMode ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
                  <ShieldCheck size={12} />
                  {bypassMode ? "Bypass Aktif" : "Sesuai Jadwal"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {bypassMode
                  ? "Staf dapat melakukan check-in dan rotasi pemain kapan saja tanpa batasan tanggal dan jam bermain."
                  : "Check-in dibatasi ketat: hanya bisa dilakukan pada tanggal booking dan maksimal 30 menit sebelum jadwal mulai."}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={bypassMode}
            aria-label="Toggle Mode Testing Bypass Check-in"
            onClick={toggleBypass}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              bypassMode ? "bg-amber-500" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                bypassMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </Panel>
  )
}

function useMutation(onDone?: () => void) {
  const { notify, reload } = useAdmin()
  const { refresh } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const run = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setError("")
    try {
      await task()
      await Promise.all([reload(), refresh?.()])
      notify(success)
      onDone?.()
    } catch (problem) {
      setError(errorMessage(problem, id))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run, setError }
}

function BookingTable({ items, onOpen }: { items: Booking[]; onOpen: (booking: Booking) => void }) {
  if (!items.length) return null
  return (
    <ScrollArea>
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="border-y border-border bg-surface text-2xs font-medium tracking-eyebrow text-muted-foreground uppercase">
          <tr>
            {["Pemain / Kode", "Lapangan", "Jadwal · WIB", "Jumlah", "Status", ""].map((heading, index) => (
              <th key={index} scope="col" className="px-5 py-3 font-medium">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((booking) => (
            <tr key={booking.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/30">
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center bg-secondary text-2xs font-semibold" aria-hidden="true">{initials(customerName(booking))}</span>
                  <div>
                    <p className="font-medium">{customerName(booking)}</p>
                    <p className="mt-1 text-2xs text-muted-foreground">{booking.id}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                {booking.courtName}
                <p className="mt-1 text-2xs text-muted-foreground">{booking.source === "walk-in" ? "Booking manual" : "Online"}</p>
              </td>
              <td className="px-5 py-4">
                <p>{dateLabel(booking.date, true)}</p>
                <p className="mt-1 text-muted-foreground">{booking.time}–{endTime(booking.time, booking.duration)}</p>
              </td>
              <td className="px-5 py-4 font-medium">{money(booking.total)}</td>
              <td className="px-5 py-4"><StatusBadge status={booking.status} /></td>
              <td className="px-3 py-4">
                <button type="button" aria-label={`Detail ${booking.id}`} onClick={() => onOpen(booking)} className="flex size-11 items-center justify-center transition hover:bg-secondary">
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  )
}

function ScheduleGrid({ date, onOpen, onCreate }: { date: string; onOpen: (booking: Booking) => void; onCreate: (court: number, time: string) => void }) {
  const { club, notify } = useApp()
  const { bookings, blocks } = useAdmin()
  const courts = club.courtOptions.filter((court) => court.active)
  const hours = Array.from({ length: club.closeHour - club.openHour }, (_, index) => club.openHour + index)
  const halfHours = hours.flatMap((hour) => [`${String(hour).padStart(2, "0")}:00`, `${String(hour).padStart(2, "0")}:30`])
  const active = bookings.filter((item) => item.date === date && item.status !== "cancelled")
  if (!courts.length) return <Empty title="Belum ada lapangan aktif." description="Aktifkan lapangan melalui menu Lapangan untuk membuka jadwal." />
  return (
    <>
      <ScrollArea>
        <div className="min-w-[1180px] pb-3">
          <div className="flex border-b border-border">
            <div className="w-36 shrink-0 px-5 py-3 text-2xs text-muted-foreground">LAPANGAN / WIB</div>
            <div className="flex flex-1 pr-4">
              {hours.map((hour) => (
                <div key={hour} className="flex-1 py-3 text-left text-2xs text-muted-foreground tabular-nums">{String(hour).padStart(2, "0")}:00</div>
              ))}
            </div>
          </div>
          {courts.map((court) => (
            <div key={court.id} className="flex min-h-20 border-b border-border last:border-0">
              <div className="flex w-36 shrink-0 flex-col justify-center px-5">
                <span className="text-xs font-medium">{court.name.split(" · ")[0]}</span>
                <span className="mt-1 text-2xs text-muted-foreground">{court.type}</span>
              </div>
              <div className="flex flex-1 items-stretch gap-0.5 py-4 pr-4">
                {halfHours.map((time) => {
                  const booking = active.find((item) => item.court === court.id && item.time < endTime(time, 30) && endTime(item.time, item.duration) > time)
                  const block = blocks.find((item) => item.court === court.id && item.date === date && item.time < endTime(time, 30) && endTime(item.time, item.duration) > time)
                  const past = startsAt(date, time) <= Date.now()
                  const label = booking ? `${customerName(booking)}` : block ? `diblokir: ${block.reason}` : past ? "sudah lewat" : "tersedia"
                  return (
                    <button
                      key={time}
                      type="button"
                      disabled={!booking && !block && past}
                      title={`${court.name} · ${time} · ${label}`}
                      aria-label={`${court.name} ${time} ${label}`}
                      onClick={() => (booking ? onOpen(booking) : block ? notify(`Diblokir: ${block.reason}. Kelola di daftar slot terblokir.`) : onCreate(court.id, time))}
                      className={`group flex min-h-11 flex-1 items-center justify-center text-2xs transition ${
                        booking
                          ? booking.status === "completed"
                            ? "bg-forest-deep text-white"
                            : "bg-clay text-white hover:bg-clay/90"
                          : block
                            ? "bg-muted text-muted-foreground"
                            : past
                              ? "bg-surface opacity-50"
                              : "bg-secondary hover:bg-accent"
                      }`}
                    >
                      {booking ? (time === booking.time ? initials(customerName(booking)) : "") : block ? <LockKeyhole size={12} aria-hidden="true" /> : !past ? <Plus size={12} aria-hidden="true" className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="flex flex-wrap gap-4 border-t border-border px-5 py-3 text-2xs text-muted-foreground">
        {[["bg-clay", "Terbooking"], ["bg-forest-deep", "Selesai"], ["bg-secondary", "Tersedia"], ["bg-muted", "Diblokir"]].map(([tone, label]) => (
          <span key={label} className="flex items-center gap-1.5"><span className={`size-2.5 ${tone}`} aria-hidden="true" />{label}</span>
        ))}
      </div>
    </>
  )
}

/* ---------- Dialogs ---------- */

export function OperationDialog({ kind, preset, close }: { kind: "booking" | "block"; preset?: { court?: number; date?: string; time?: string }; close: () => void }) {
  const { club, busy: busySlots } = useApp()
  const courts = club.courtOptions.filter((court) => court.active)
  const [court, setCourt] = useState(preset?.court || courts[0]?.id || 0)
  const [date, setDate] = useState(preset?.date || today())
  const [duration, setDuration] = useState(60)
  const [time, setTime] = useState(preset?.time || "")
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [isWalkInInstant, setIsWalkInInstant] = useState(true)
  const [reason, setReason] = useState("Perawatan lapangan")
  const { busy, error, run } = useMutation(close)
  const starts = availableStarts(club, busySlots, court, date, duration)
  const chosen = starts.includes(time) ? time : ""
  const price = courts.find((item) => item.id === court)?.price || 0
  return (
    <AdminDialog title={kind === "block" ? "Blokir slot lapangan" : "Booking Lapangan (Walk-in & Manual)"} close={close}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!chosen) return
          if (kind === "block") {
            run(() => api.admin.addBlock({ court, date, time: chosen, duration, reason }), "Slot berhasil diblokir.")
          } else {
            run(async () => {
              const b = await api.admin.createBooking({ name, contact, court, date, time: chosen, duration })
              if (isWalkInInstant) {
                await api.admin.checkin(b.id)
              }
            }, isWalkInInstant ? "Pemain walk-in berhasil didaftarkan dan langsung masuk status Sedang Bermain!" : "Booking manual tersimpan.")
          }
        }}
      >
        <p className="text-xs leading-6 text-muted-foreground">
          {kind === "block" ? "Slot yang diblokir langsung tidak tersedia di halaman booking pemain." : "Untuk pemain walk-in langsung main atau reservasi manual. Pembayaran dicatat tunai di klub."}
        </p>
        {kind === "booking" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">Nama pemain<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Budi Santoso" className={`${field} mt-2`} /></label>
              <label className="block text-xs">Kontak <span className="text-muted-foreground">(opsional)</span><input maxLength={100} value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Email atau nomor HP" className={`${field} mt-2`} /></label>
            </div>

            <label className="flex items-start gap-3 border border-border bg-surface p-3 cursor-pointer hover:border-primary/50 transition">
              <input
                type="checkbox"
                checked={isWalkInInstant}
                onChange={(e) => setIsWalkInInstant(e.target.checked)}
                className="mt-0.5 size-4 accent-forest-deep"
              />
              <div className="text-xs">
                <span className="font-semibold text-foreground block">Pemain sudah tiba di klub (Langsung Main ke Lapangan)</span>
                <span className="text-2xs text-muted-foreground block mt-0.5">
                  Langsung ubah status menjadi &quot;Sedang Bermain&quot; di Papan Antrean tanpa perlu check-in terpisah.
                </span>
              </div>
            </label>
          </>
        )}
        <div className="space-y-1">
          <span className="block text-xs font-medium">Lapangan</span>
          <LuxurySelect
            value={court}
            onChange={(val) => setCourt(Number(val))}
            options={courts.map((item) => ({
              value: item.id,
              label: `${item.name} · ${money(item.price)}/jam`,
            }))}
            className="w-full"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <span className="block text-xs font-medium">Tanggal</span>
            <LuxuryDatePicker value={date} onChange={setDate} />
          </div>
          <div className="space-y-1">
            <span className="block text-xs font-medium">Durasi</span>
            <LuxurySelect
              value={duration}
              onChange={(val) => setDuration(Number(val))}
              options={[30, 60, 90, 120, 180, 240].map((value) => ({
                value,
                label: `${value} menit`,
              }))}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <span className="block text-xs font-medium">Mulai · WIB</span>
            <LuxurySelect
              value={chosen}
              onChange={(val) => setTime(String(val))}
              options={
                starts.length
                  ? starts.map((slot) => ({ value: slot, label: `${slot}–${endTime(slot, duration)}` }))
                  : [{ value: "", label: "Tidak ada slot" }]
              }
              placeholder={starts.length ? "Pilih jam" : "Tidak ada slot"}
              className="w-full"
            />
          </div>
        </div>
        {kind === "block" ? (
          <label className="block text-xs">Alasan blokir<input required maxLength={160} value={reason} onChange={(event) => setReason(event.target.value)} className={`${field} mt-2`} /></label>
        ) : (
          <div className="flex items-center justify-between bg-secondary p-4 text-xs">
            <span>Total · dibayar tunai di klub</span>
            <strong>{money((price * duration) / 60)}</strong>
          </div>
        )}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <button type="submit" disabled={busy || !chosen} className={`${button} w-full`}>
          {busy ? <Spinner className="text-primary-foreground" /> : <>{kind === "block" ? "Blokir slot" : isWalkInInstant ? "Simpan & Masuk Lapangan" : "Simpan booking"} <Check size={16} /></>}
        </button>
      </form>
    </AdminDialog>
  )
}

export function BookingDetailDialog({ booking, close }: { booking: Booking; close: () => void }) {
  const { club, busy: busySlots } = useApp()
  const { isOwner, payments, notify } = useAdmin()
  const [mode, setMode] = useState<"view" | "move" | "edit" | "cancel" | "delete">("view")
  const [court, setCourt] = useState(booking.court)
  const [date, setDate] = useState(booking.date)
  const [time, setTime] = useState("")
  const [name, setName] = useState(booking.customerName || "")
  const [contact, setContact] = useState(booking.customerContact || "")
  const [reason, setReason] = useState("")
  const { busy, error, run } = useMutation(close)
  const courts = club.courtOptions.filter((item) => item.active)
  const starts = availableStarts(club, busySlots, court, date, booking.duration, booking.id)
  const paid = payments.filter((item) => item.bookingId === booking.id)
  const isBypass = typeof window !== "undefined" && localStorage.getItem("padel_bypass_checkin_mode") === "true"
  const isToday = booking.date === today()
  return (
    <AdminDialog title="Detail booking" close={close} wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-muted-foreground">{booking.id}</p>
        <StatusBadge status={booking.status} />
      </div>
      <h3 className="mt-5 font-display text-3xl">{customerName(booking)}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{booking.customerContact || "Kontak tidak dicatat"} · {booking.source === "walk-in" ? "Booking manual" : "Online"}</p>
      <dl className="mt-6 grid gap-4 border-y border-border py-5 text-xs sm:grid-cols-2">
        {[
          ["Lapangan", booking.courtName],
          ["Tanggal", dateLabel(booking.date)],
          ["Waktu WIB", `${booking.time}–${endTime(booking.time, booking.duration)} · ${booking.duration} menit`],
          ["Total", money(booking.total)],
          ["Ubah jadwal oleh pemain", `${booking.rescheduleCount}× dari ${club.policy.maxReschedules}×`],
          ...(booking.refundAmount ? [["Dana dikembalikan", money(booking.refundAmount)]] : []),
          ...(booking.cancelReason ? [["Alasan pembatalan", booking.cancelReason]] : []),
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {isOwner && paid.length > 0 && (
        <div className="mt-5">
          <p className={`${eyebrow} text-muted-foreground`}>Pembayaran</p>
          <ul className="mt-3 space-y-2 text-xs">
            {paid.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{paymentMethodLabel(payment.method)} · {payment.gatewayRef}</span>
                <PaymentBadge status={payment.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5">
        <p className={`${eyebrow} text-muted-foreground`}>Riwayat</p>
        <ol className="mt-3 space-y-2 border-l border-border pl-4 text-xs">
          {booking.history.map((entry, index) => (
            <li key={index}>
              <span className="font-medium">{({ hold: "Slot ditahan", pending_payment: "Checkout dimulai", confirmed: "Dikonfirmasi", checked_in: "Check-in (sedang bermain)", completed: "Selesai bermain", cancelled: "Dibatalkan", expired: "Kedaluwarsa", rescheduled: "Jadwal dipindahkan", reviewed: "Penilaian dikirim", updated: "Data diperbarui" } as Record<string, string>)[entry.type]}</span>
              <span className="text-muted-foreground"> · {({ player: "pemain", staff: "staf", owner: "pemilik", system: "sistem" } as Record<string, string>)[entry.actor]} · {new Date(entry.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
            </li>
          ))}
        </ol>
      </div>
      {booking.status === "confirmed" && mode === "view" && (
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className={`${button} w-full ${!isBypass && !isToday ? "bg-muted text-muted-foreground hover:bg-muted/80" : "bg-forest-dark hover:bg-forest text-white"} flex items-center justify-center gap-2`}
            onClick={() => {
              if (!isBypass && !isToday) {
                notify(`Jadwal booking ini adalah tanggal ${dateLabel(booking.date, true)} (${booking.time} WIB). Aktifkan Mode Testing di menu Pengaturan Klub jika ingin bypass check-in.`)
                return
              }
              run(() => api.admin.checkin(booking.id), "Pemain berhasil check-in. Status kini: Sedang Bermain.")
            }}
            disabled={busy}
          >
            {busy ? <Spinner className="text-white" /> : !isBypass && !isToday ? `Check-in Pemain (${dateLabel(booking.date, true)} — Butuh Mode Testing)` : "Check-in Pemain (Sedang Bermain)"}
          </button>
          <div className="grid gap-3 sm:grid-cols-4">
            <button type="button" className={outlineButton} onClick={() => setMode("move")}>Pindahkan jadwal</button>
            <button type="button" className={outlineButton} onClick={() => setMode("edit")}>Edit data pemain</button>
            <button type="button" className={`${outlineButton} text-destructive`} onClick={() => setMode("cancel")}>Batalkan</button>
            <button type="button" className={`${outlineButton} text-destructive flex items-center justify-center gap-1.5`} onClick={() => setMode("delete")}><Trash2 size={13} /> Hapus booking</button>
          </div>
        </div>
      )}
      {booking.status === "checked_in" && mode === "view" && (
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className={`${button} w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2`}
            onClick={() => run(() => api.admin.complete(booking.id), "Sesi bermain selesai. Lapangan siap dibersihkan / rotasi pemain.")}
            disabled={busy}
          >
            {busy ? <Spinner className="text-white" /> : <><Check size={15} /> Tandai Sesi Selesai (Rotasi Pemain)</>}
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className={`${outlineButton} w-full`} onClick={() => setMode("edit")}>Edit data pemain</button>
            <button type="button" className={`${outlineButton} w-full text-destructive flex items-center justify-center gap-1.5`} onClick={() => setMode("delete")}><Trash2 size={13} /> Hapus booking</button>
          </div>
        </div>
      )}
      {booking.status !== "confirmed" && booking.status !== "checked_in" && mode === "view" && (
        <div className="mt-6 flex flex-wrap gap-3">
          {booking.status !== "cancelled" && <button type="button" className={`${outlineButton} flex-1`} onClick={() => setMode("edit")}>Edit data pemain</button>}
          <button type="button" className={`${outlineButton} text-destructive flex items-center justify-center gap-1.5`} onClick={() => setMode("delete")}><Trash2 size={13} /> Hapus booking</button>
        </div>
      )}
      {mode === "move" && (
        <form className="mt-6 space-y-4 border-t border-border pt-5" onSubmit={(event) => { event.preventDefault(); run(() => api.admin.rescheduleBooking(booking.id, { court, date, time }), "Jadwal booking dipindahkan.") }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className="block text-xs mb-1 font-medium">Lapangan</span>
              <LuxurySelect
                value={court}
                onChange={(val) => { setCourt(Number(val)); setTime("") }}
                options={courts.map((item) => ({ value: item.id, label: item.name }))}
                className="w-full"
              />
            </div>
            <div>
              <span className="block text-xs mb-1 font-medium">Tanggal</span>
              <LuxuryDatePicker
                value={date}
                onChange={(d) => { if (d) { setDate(d); setTime("") } }}
                className="w-full"
              />
            </div>
            <div>
              <span className="block text-xs mb-1 font-medium">Mulai</span>
              <LuxurySelect
                value={time}
                onChange={(val) => setTime(String(val))}
                options={starts.length ? starts.map((slot) => ({ value: slot, label: `${slot}–${endTime(slot, booking.duration)}` })) : [{ value: "", label: "Tidak ada slot" }]}
                placeholder="Pilih jam"
                className="w-full"
              />
            </div>
          </div>
          <p className="text-2xs text-muted-foreground">Harga tetap {money(booking.total)}. Pemain menerima email perubahan jadwal.</p>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-3"><button type="button" className={outlineButton} onClick={() => setMode("view")}>Kembali</button><button disabled={busy || !time} className={`${button} flex-1`}>{busy ? <Spinner className="text-primary-foreground" /> : "Simpan jadwal baru"}</button></div>
        </form>
      )}
      {mode === "edit" && (
        <form className="mt-6 space-y-4 border-t border-border pt-5" onSubmit={(event) => { event.preventDefault(); run(() => api.admin.updateContact(booking.id, { name, contact }), "Data pemain diperbarui.") }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">Nama pemain<input required value={name} onChange={(event) => setName(event.target.value)} className={`${field} mt-2`} /></label>
            <label className="block text-xs">Kontak<input value={contact} onChange={(event) => setContact(event.target.value)} className={`${field} mt-2`} /></label>
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-3"><button type="button" className={outlineButton} onClick={() => setMode("view")}>Kembali</button><button disabled={busy} className={`${button} flex-1`}>{busy ? <Spinner className="text-primary-foreground" /> : "Simpan"}</button></div>
        </form>
      )}
      {mode === "cancel" && (
        <form className="mt-6 space-y-4 border-t border-border pt-5" onSubmit={(event) => { event.preventDefault(); run(() => api.admin.cancelBooking(booking.id, reason), "Booking dibatalkan dan slot dibuka kembali.") }}>
          <label className="block text-xs">Alasan pembatalan<input required maxLength={160} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Mis. lapangan dalam perbaikan" className={`${field} mt-2`} /></label>
          <p className="text-xs leading-6 text-destructive">Slot dibuka kembali. Pembayaran online dikembalikan penuh dan pemain menerima email pembatalan.</p>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-3"><button type="button" className={outlineButton} onClick={() => setMode("view")}>Pertahankan</button><button disabled={busy} className={`${dangerButton} flex-1`}>{busy ? <Spinner className="text-white" /> : "Batalkan booking"}</button></div>
        </form>
      )}
      {mode === "delete" && (
        <div className="mt-6 space-y-4 border-t border-border pt-5">
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <Trash2 size={16} /> Konfirmasi Hapus Booking
            </h4>
            <p className="mt-2 text-xs leading-6 text-foreground/80">
              Apakah Anda yakin ingin menghapus booking <strong>{booking.id}</strong> atas nama <strong>{customerName(booking)}</strong>? Tindakan ini bersifat permanen dan data booking serta riwayat pembayaran akan dihapus dari sistem.
            </p>
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-3">
            <button type="button" className={outlineButton} onClick={() => setMode("view")}>Batal</button>
            <button
              disabled={busy}
              className={`${dangerButton} flex-1 flex items-center justify-center gap-2`}
              onClick={() => run(() => api.admin.deleteBooking(booking.id), "Booking berhasil dihapus secara permanen.")}
            >
              {busy ? <Spinner className="text-white" /> : <><Trash2 size={14} /> Hapus Permanen</>}
            </button>
          </div>
        </div>
      )}
    </AdminDialog>
  )
}

/* ---------- Sections ---------- */

export function Overview({ openDetail, openOperation }: { openDetail: (booking: Booking) => void; openOperation: (kind: "booking" | "block", preset?: { court?: number; date?: string; time?: string }) => void }) {
  const { club } = useApp()
  const { bookings, blocks, audit, isOwner, reload, notify } = useAdmin()
  const [date, setDate] = useState(today())
  const [period, setPeriod] = useState(7)
  const courts = club.courtOptions.filter((court) => court.active)
  const days = Array.from({ length: period }, (_, index) => nextDay(today(), index - period + 1))
  const paid = bookings.filter((item) => days.includes(item.date) && (item.status === "confirmed" || item.status === "checked_in" || item.status === "completed"))
  const revenue = paid.reduce((sum, item) => sum + item.total, 0)
  const week = days.slice(-7)
  const daily = week.map((day) => paid.filter((item) => item.date === day).reduce((sum, item) => sum + item.total, 0))
  const largest = Math.max(...daily, 1)
  const onDate = bookings.filter((item) => item.date === date && item.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time))
  const hoursBooked = onDate.filter((item) => courts.some((court) => court.id === item.court)).reduce((sum, item) => sum + item.duration / 60, 0)
  const blocked = blocks.filter((item) => item.date === date && courts.some((court) => court.id === item.court)).reduce((sum, item) => sum + item.duration / 60, 0)
  const capacity = Math.max(0, courts.length * (club.closeHour - club.openHour) - blocked)
  const occupancy = capacity ? Math.min(100, Math.round((hoursBooked / capacity) * 100)) : 0
  const reviewSummary = ratingSummary(bookings.filter((item) => item.rating).map((item) => ({ rating: item.rating! })))
  const upcoming = bookings.filter((item) => (item.status === "confirmed" || item.status === "checked_in") && item.date >= today() && item.date <= nextDay(today(), 6)).length
  const dateTitle = date === today() ? "hari ini" : dateLabel(date, true)
  const stats = [
    isOwner
      ? { label: "Nilai booking", value: money(revenue), note: `${paid.length} booking aktif/selesai · ${period} hari terakhir`, icon: CreditCard }
      : { label: "Booking 7 hari ke depan", value: String(upcoming).padStart(2, "0"), note: "Status aktif", icon: CalendarDays },
    { label: `Booking ${dateTitle}`, value: String(onDate.length).padStart(2, "0"), note: "Tidak termasuk yang dibatalkan", icon: CalendarDays },
    { label: `Okupansi ${dateTitle}`, value: `${occupancy}%`, note: `${hoursBooked} dari ${capacity} jam tersedia`, icon: TrendingUp },
    { label: "Rating pemain", value: reviewSummary.count ? `${reviewSummary.average.toFixed(1)} / 5` : "—", note: `${reviewSummary.count} ulasan dari booking selesai`, icon: Star },
  ]
  return (
    <>
      <AdminLiveOperations bookings={bookings} reload={reload} notify={notify} />

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="relative overflow-hidden bg-primary p-6 text-primary-foreground md:p-8">
          <div className="relative z-10 max-w-[65%]">
            <p className={`${eyebrow} text-sage-light`}>Klubmu, hari ini</p>
            <h2 className="mt-4 font-display text-4xl">Ruang untuk<br />rally berikutnya.</h2>
            <p className="mt-3 text-xs text-white/75">{courts.length} lapangan aktif · {club.area}</p>
            <Link to="/admin/schedule" className={`${textLink} mt-3 text-sage-light`}>Kelola jadwal <ArrowRight size={15} /></Link>
          </div>
          <img src={club.heroPhoto} alt="" className="absolute inset-y-0 right-0 h-full w-[57%] object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-transparent" />
        </div>
        <div className="flex flex-col justify-between border border-border bg-secondary p-6">
          <p className={`${eyebrow} text-muted-foreground`}>Kondisi lapangan</p>
          <p className="mt-4 flex items-baseline gap-2"><span className="font-display text-6xl">{courts.length}</span><span className="text-xs text-muted-foreground">dari {club.courtOptions.length} lapangan aktif</span></p>
          <div className="mt-5 flex flex-wrap gap-2">
            {club.courtOptions.map((court) => (
              <span key={court.id} className="flex items-center gap-1.5 border border-primary/10 bg-card/60 px-2.5 py-1.5 text-2xs">
                <span className={`size-1.5 ${court.active ? "bg-forest-muted" : "bg-muted-foreground"}`} aria-hidden="true" />
                {court.name.split(" · ")[0]}
              </span>
            ))}
          </div>
          <p className="mt-4 text-2xs text-muted-foreground">Buka {String(club.openHour).padStart(2, "0")}:00–{String(club.closeHour).padStart(2, "0")}:00 WIB</p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Performa klub</p>
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <LuxurySelect
              ariaLabel="Periode laporan"
              value={period}
              onChange={(val) => setPeriod(Number(val))}
              options={[
                { value: 7, label: "7 hari terakhir" },
                { value: 30, label: "30 hari terakhir" },
              ]}
              className="w-40"
            />
          )}
          <DatePicker value={date} onChange={setDate} />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <stat.icon size={16} strokeWidth={1.5} className="text-sage" aria-hidden="true" />
            </div>
            <p className="mt-5 font-display text-4xl leading-none">{stat.value}</p>
            <p className="mt-3 text-2xs text-muted-foreground">{stat.note}</p>
          </div>
        ))}
      </div>
      <div className="mb-6 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        {isOwner ? (
          <Panel title="Ritme pendapatan" description="Nilai booking · 7 hari terakhir · bukan settlement bank" action={<Link to="/admin/transactions" className={textLink}>Lihat transaksi <ArrowUpRight size={13} /></Link>}>
            <div className="mx-5 mb-5 flex h-40 gap-3 border-b border-border" role="img" aria-label={week.map((day, index) => `${dateLabel(day, true)}: ${money(daily[index])}`).join("; ")}>
              {week.map((day, index) => (
                <div key={day} className="flex h-full flex-1 flex-col items-center justify-end">
                  <div className="flex h-32 w-full items-end justify-center">
                    <div className={`w-full max-w-10 ${index === 6 ? "bg-sage-light" : "bg-forest-muted"}`} style={{ height: `${Math.max(3, (daily[index] / largest) * 100)}%` }} />
                  </div>
                  <span className="py-2 text-2xs text-muted-foreground">{new Date(`${day}T12:00:00+07:00`).toLocaleDateString("id-ID", { weekday: "short", timeZone: "Asia/Jakarta" })}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Mendatang" description="Booking terkonfirmasi 7 hari ke depan">
            <BookingTable items={bookings.filter((item) => item.status === "confirmed" && item.date >= today()).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 5)} onOpen={openDetail} />
          </Panel>
        )}
        <Panel title="Aktivitas klub" action={<Link to="/admin/settings" className={textLink}>Semua</Link>}>
          <div className="space-y-4 px-5 pb-5">
            {audit.slice(0, 4).map((entry) => (
              <div key={entry.id} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center bg-secondary" aria-hidden="true"><Check size={12} /></span>
                <div>
                  <p className="text-xs leading-5">{entry.message}</p>
                  <p className="mt-1 text-2xs text-muted-foreground">{entry.actor} · {new Date(entry.timestamp).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} WIB</p>
                </div>
              </div>
            ))}
            {!audit.length && <p className="text-xs text-muted-foreground">Aktivitas pengelolaan akan tercatat di sini.</p>}
          </div>
        </Panel>
      </div>
      <Panel className="mb-6" title={`Jadwal ${dateTitle}`} description="Klik booking untuk detail, atau slot kosong untuk booking manual." action={<Link to="/admin/schedule" className={textLink}>Kalender lengkap <ArrowRight size={13} /></Link>}>
        <ScheduleGrid date={date} onOpen={openDetail} onCreate={(court, time) => openOperation("booking", { court, date, time })} />
      </Panel>
      <Panel title={`Booking ${dateTitle} · ${onDate.length}`} action={<Link to="/admin/bookings" className={textLink}>Semua booking <ArrowUpRight size={13} /></Link>}>
        {onDate.length ? <BookingTable items={onDate.slice(0, 6)} onOpen={openDetail} /> : <Empty title="Lapangan siap untuk rally." description="Belum ada booking pada tanggal ini." />}
      </Panel>
    </>
  )
}

export function BookingsSection({ openDetail }: { openDetail: (booking: Booking) => void }) {
  const { club } = useApp()
  const { bookings } = useAdmin()
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get("q") || "")
  const debouncedQuery = useDebounce(query, 400)
  const [status, setStatus] = useState("all")
  const [court, setCourt] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const filtered = useMemo(
    () =>
      bookings
        .filter((booking) =>
          `${booking.id} ${customerName(booking)} ${booking.customerContact || ""} ${booking.courtName}`.toLowerCase().includes(debouncedQuery.toLowerCase()) &&
          (status === "all" || booking.status === status) &&
          (court === "all" || String(booking.court) === court) &&
          (!from || booking.date >= from) &&
          (!to || booking.date <= to),
        )
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [bookings, debouncedQuery, status, court, from, to],
  )
  const dirty = query || status !== "all" || court !== "all" || from || to
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-5">
        <label className="relative min-w-52 flex-1">
          <span className="sr-only">Cari booking</span>
          <Search size={16} className="absolute top-3.5 left-3 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari pemain, kode, atau lapangan…" className={`${field} min-h-11 pl-9`} />
        </label>
        <LuxurySelect
          ariaLabel="Filter status"
          value={status}
          onChange={(val) => setStatus(String(val))}
          options={[
            { value: "all", label: "Semua status" },
            { value: "pending_payment", label: "Menunggu bayar" },
            { value: "confirmed", label: "Dikonfirmasi" },
            { value: "checked_in", label: "Sedang Bermain" },
            { value: "completed", label: "Selesai" },
            { value: "cancelled", label: "Dibatalkan" },
          ]}
          className="w-44"
        />
        <LuxurySelect
          ariaLabel="Filter lapangan"
          value={court}
          onChange={(val) => setCourt(String(val))}
          options={[
            { value: "all", label: "Semua lapangan" },
            ...club.courtOptions.map((item) => ({ value: String(item.id), label: item.name })),
          ]}
          className="w-48"
        />
        <button
          type="button"
          className={`${outlineButton} !min-h-11 text-xs`}
          onClick={() =>
            downloadCsv(`booking-${today()}.csv`, [
              ["Kode", "Pemain", "Kontak", "Lapangan", "Tanggal", "Waktu WIB", "Durasi menit", "Jumlah IDR", "Status", "Sumber"],
              ...filtered.map((item) => [item.id, customerName(item), item.customerContact || "", item.courtName || "", item.date, item.time, item.duration, item.total, item.status, item.source]),
            ])
          }
        >
          <ArrowDownToLine size={14} /> Ekspor CSV
        </button>
        <div className="flex w-full flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Rentang tanggal</span>
          <LuxuryDatePicker value={from} onChange={(val) => setFrom(val)} />
          <span aria-hidden="true">–</span>
          <LuxuryDatePicker value={to} onChange={(val) => setTo(val)} />
          {dirty && (
            <button type="button" className={textLink} onClick={() => { setQuery(""); setStatus("all"); setCourt("all"); setFrom(""); setTo("") }}>
              Reset filter
            </button>
          )}
          <span className="ml-auto">{filtered.length} hasil</span>
        </div>
      </div>
      {filtered.length ? <BookingTable items={filtered} onOpen={openDetail} /> : <Empty title="Belum ada booking yang cocok." description="Ubah pencarian atau filter." />}
    </Panel>
  )
}

export function ScheduleSection({ openDetail, openOperation }: { openDetail: (booking: Booking) => void; openOperation: (kind: "booking" | "block", preset?: { court?: number; date?: string; time?: string }) => void }) {
  const { club } = useApp()
  const { blocks } = useAdmin()
  const [date, setDate] = useState(today())
  const { busy, run } = useMutation()
  const dayBlocks = blocks.filter((block) => block.date === date)
  return (
    <>
      <Panel title="Kalender operasional" description="Setiap kotak mewakili 30 menit." action={<DatePicker value={date} onChange={setDate} />}>
        <ScheduleGrid date={date} onOpen={openDetail} onCreate={(court, time) => openOperation("booking", { court, date, time })} />
      </Panel>
      <Panel className="mt-5" title={`Slot terblokir · ${dateLabel(date, true)}`} action={<button type="button" className={outlineButton} onClick={() => openOperation("block", { date })}><LockKeyhole size={14} /> Blokir slot</button>}>
        {dayBlocks.length ? (
          <div className="divide-y divide-border border-t border-border px-5">
            {dayBlocks.map((block) => (
              <div key={block.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="flex items-center gap-2 text-xs font-medium"><LockKeyhole size={14} aria-hidden="true" />{club.courtOptions.find((item) => item.id === block.court)?.name} · {block.time}–{endTime(block.time, block.duration)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{block.reason}</p>
                </div>
                <button type="button" disabled={busy} className={outlineButton} onClick={() => run(() => api.admin.removeBlock(block.id), "Slot dibuka kembali.")}>Buka slot</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t border-border px-5 py-7 text-xs text-muted-foreground">Tidak ada slot terblokir pada tanggal ini.</p>
        )}
      </Panel>
    </>
  )
}

export function TransactionsSection({ openDetail }: { openDetail: (booking: Booking) => void }) {
  const { payments, bookings } = useAdmin()
  const [status, setStatus] = useState("all")
  const [method, setMethod] = useState("all")
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 400)
  const rows = payments
    .map((payment) => ({ payment, booking: bookings.find((item) => item.id === payment.bookingId) }))
    .filter(({ payment, booking }) =>
      (status === "all" || payment.status === status) &&
      (method === "all" || payment.method === method) &&
      `${payment.gatewayRef} ${payment.bookingId} ${booking ? customerName(booking) : ""}`.toLowerCase().includes(debouncedQuery.toLowerCase()),
    )
    .sort((a, b) => b.payment.createdAt.localeCompare(a.payment.createdAt))
  const sum = (match: string) => payments.filter((item) => item.status === match).reduce((total, item) => total + (match === "refunded" ? item.refundedAmount || item.amount : item.amount), 0)
  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Pembayaran berhasil", money(sum("success"))],
          ["Dana dikembalikan", money(sum("refunded"))],
          ["Gagal / kedaluwarsa", String(payments.filter((item) => item.status === "failed" || item.status === "expired").length)],
        ].map(([label, value]) => (
          <div key={label} className="border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-4 font-display text-4xl">{value}</p>
          </div>
        ))}
      </div>
      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-5">
          <label className="relative min-w-52 flex-1">
            <span className="sr-only">Cari transaksi</span>
            <Search size={16} className="absolute top-3.5 left-3 text-muted-foreground" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari referensi, kode, atau pemain…" className={`${field} min-h-11 pl-9`} />
          </label>
          <LuxurySelect
            ariaLabel="Filter status pembayaran"
            value={status}
            onChange={(val) => setStatus(String(val))}
            options={[
              { value: "all", label: "Semua status" },
              { value: "success", label: "Berhasil" },
              { value: "pending", label: "Menunggu" },
              { value: "failed", label: "Gagal" },
              { value: "expired", label: "Kedaluwarsa" },
              { value: "refunded", label: "Dikembalikan" },
            ]}
          />
          <LuxurySelect
            ariaLabel="Filter metode"
            value={method}
            onChange={(val) => setMethod(String(val))}
            options={[
              { value: "all", label: "Semua metode" },
              { value: "bca_va", label: paymentMethodLabel("bca_va" as never) },
              { value: "mandiri_va", label: paymentMethodLabel("mandiri_va" as never) },
              { value: "gopay", label: paymentMethodLabel("gopay" as never) },
              { value: "ovo", label: paymentMethodLabel("ovo" as never) },
              { value: "cash", label: paymentMethodLabel("cash" as never) },
            ]}
          />
          <button
            type="button"
            className={`${outlineButton} !min-h-11 text-xs`}
            onClick={() =>
              downloadCsv(`transaksi-${today()}.csv`, [
                ["Referensi", "Kode booking", "Pemain", "Metode", "Gateway", "Jumlah IDR", "Dikembalikan IDR", "Status", "Dibuat", "Dibayar"],
                ...rows.map(({ payment, booking }) => [payment.gatewayRef, payment.bookingId, booking ? customerName(booking) : "", paymentMethodLabel(payment.method), payment.gateway, payment.amount, payment.refundedAmount || 0, payment.status, payment.createdAt, payment.paidAt || ""]),
              ])
            }
          >
            <ArrowDownToLine size={14} /> Ekspor CSV
          </button>
        </div>
        {rows.length ? (
          <ScrollArea>
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-border bg-surface text-2xs font-medium tracking-eyebrow text-muted-foreground uppercase">
                <tr>{["Referensi", "Booking", "Metode", "Jumlah", "Status", "Waktu"].map((heading) => <th key={heading} scope="col" className="px-5 py-3 font-medium">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(({ payment, booking }) => (
                  <tr key={payment.id} className="border-b border-border/70 last:border-0">
                    <td className="px-5 py-4 font-mono">{payment.gatewayRef}</td>
                    <td className="px-5 py-4">
                      {booking ? <button type="button" className={textLink} onClick={() => openDetail(booking)}>{booking.id}</button> : payment.bookingId}
                      <p className="mt-1 text-2xs text-muted-foreground">{booking ? customerName(booking) : ""}</p>
                    </td>
                    <td className="px-5 py-4">{paymentMethodLabel(payment.method)}</td>
                    <td className="px-5 py-4 font-medium">{money(payment.amount)}{payment.refundedAmount ? <p className="mt-1 text-2xs text-clay">−{money(payment.refundedAmount)}</p> : null}</td>
                    <td className="px-5 py-4"><PaymentBadge status={payment.status} /></td>
                    <td className="px-5 py-4 text-muted-foreground">{new Date(payment.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          <Empty title="Belum ada transaksi yang cocok." description="Ubah pencarian atau filter." />
        )}
        <p className="border-t border-border px-5 py-4 text-2xs leading-5 text-muted-foreground">Status pembayaran nantinya diperbarui otomatis oleh webhook payment gateway. Angka di sini bukan mutasi rekening.</p>
      </Panel>
    </>
  )
}

export function CustomersSection() {
  const { bookings } = useAdmin()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 400)
  const [playerToDelete, setPlayerToDelete] = useState<{ name: string; count: number } | null>(null)
  const { busy, error, run } = useMutation(() => setPlayerToDelete(null))

  const players = [...new Set(bookings.map(customerName))]
    .map((name) => {
      const history = bookings.filter((item) => customerName(item) === name)
      return {
        name,
        history,
        contact: history.find((item) => item.customerContact)?.customerContact,
        spent: history.filter((item) => item.status === "confirmed" || item.status === "completed").reduce((sum, item) => sum + item.total, 0),
        last: history.map((item) => item.date).sort().at(-1),
      }
    })
    .filter((player) => `${player.name} ${player.contact || ""}`.toLowerCase().includes(debouncedQuery.toLowerCase()))
    .sort((a, b) => (b.last || "").localeCompare(a.last || ""))
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-5">
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Cari pemain</span>
          <Search size={16} className="absolute top-3.5 left-3 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau kontak…" className={`${field} min-h-11 pl-9`} />
        </label>
        <span className="ml-auto text-xs text-muted-foreground">{players.length} pemain</span>
      </div>
      {players.length ? (
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          {players.map((player) => (
            <div key={player.name} className="flex flex-col justify-between border border-border p-5">
              <div>
                <span className="flex size-11 items-center justify-center bg-secondary font-display text-2xl" aria-hidden="true">{player.name[0]}</span>
                <h2 className="mt-4 text-sm font-medium">{player.name}</h2>
                <p className="mt-2 text-xs text-muted-foreground">{player.history.length} booking · {money(player.spent)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{player.contact || "Kontak tidak dicatat"}</p>
                {player.last && <p className="mt-1 text-2xs text-muted-foreground">Terakhir: {dateLabel(player.last, true)}</p>}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
                <button type="button" className={textLink} onClick={() => navigate(`/admin/bookings?q=${encodeURIComponent(player.name)}`)}>
                  Lihat riwayat <ArrowUpRight size={14} />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs text-destructive transition-colors hover:underline"
                  onClick={() => setPlayerToDelete({ name: player.name, count: player.history.length })}
                >
                  <Trash2 size={13} /> Hapus Pemain
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Pemain belum ditemukan." description="Data pemain muncul setelah ada booking." />
      )}
      {playerToDelete && (
        <AdminDialog title="Hapus Pemain" close={() => setPlayerToDelete(null)}>
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <Trash2 size={16} /> Konfirmasi Hapus Pemain
              </h4>
              <p className="mt-2 text-xs leading-6 text-foreground/80">
                Apakah Anda yakin ingin menghapus data pemain <strong>{playerToDelete.name}</strong> beserta seluruh {playerToDelete.count} riwayat booking yang tersimpan? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
              </p>
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" className={outlineButton} onClick={() => setPlayerToDelete(null)}>
                Batal
              </button>
              <button
                disabled={busy}
                className={`${dangerButton} flex-1 flex items-center justify-center gap-2`}
                onClick={() =>
                  run(
                    () => api.admin.deleteCustomer(playerToDelete.name),
                    `Data pemain ${playerToDelete.name} berhasil dihapus.`
                  )
                }
              >
                {busy ? <Spinner className="text-white" /> : <><Trash2 size={14} /> Hapus Pemain</>}
              </button>
            </div>
          </div>
        </AdminDialog>
      )}
    </Panel>
  )
}

export function ReviewsSection() {
  const { bookings } = useAdmin()
  const [reply, setReply] = useState<Booking | null>(null)
  const { busy, run } = useMutation()
  const reviews = bookings.filter((item) => item.rating).sort((a, b) => (b.reviewedAt || "").localeCompare(a.reviewedAt || ""))
  const summary = ratingSummary(reviews.map((item) => ({ rating: item.rating! })))
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-6 border border-border bg-secondary p-6">
        <div>
          <p className={`${eyebrow} text-muted-foreground`}>Suara pemain</p>
          <p className="mt-3 font-display text-5xl">{summary.count ? summary.average.toFixed(1) : "—"}<span className="text-2xl text-muted-foreground"> / 5</span></p>
        </div>
        <p className="text-xs text-muted-foreground">{summary.count} ulasan · {reviews.filter((item) => item.hiddenReview).length} disembunyikan</p>
        <p className="max-w-sm text-xs leading-6 text-muted-foreground md:ml-auto">Rating sama dengan yang tampil di website (ulasan tersembunyi tidak dihitung di halaman publik). Balas dengan hangat; sembunyikan hanya konten yang tidak pantas.</p>
      </div>
      <div className="space-y-4">
        {reviews.map((booking) => (
          <article key={booking.id} className="border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">{customerName(booking)}</h2>
                <p className="mt-1 text-2xs text-muted-foreground">{booking.courtName} · {dateLabel(booking.date, true)} · {booking.id}</p>
              </div>
              <span className="flex items-center gap-2 text-xs">
                <Star size={14} className="fill-rating text-rating" aria-hidden="true" /> {booking.rating} / 5
                {booking.hiddenReview && <span className="bg-muted px-2 py-1 text-2xs">Disembunyikan</span>}
              </span>
            </div>
            <p className="mt-5 text-sm leading-7">{booking.review || "Pemain memberikan rating tanpa komentar."}</p>
            {booking.adminReply && (
              <div className="mt-4 bg-secondary/60 p-4">
                <p className="text-2xs font-semibold">BALASAN KLUB</p>
                <p className="mt-2 text-xs leading-6">{booking.adminReply}</p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-4">
              <button type="button" className={textLink} onClick={() => setReply(booking)}><MessageSquare size={14} /> {booking.adminReply ? "Edit balasan" : "Balas ulasan"}</button>
              <button type="button" disabled={busy} className={`${textLink} text-muted-foreground`} onClick={() => run(() => api.admin.setReviewHidden(booking.id, !booking.hiddenReview), booking.hiddenReview ? "Ulasan ditampilkan." : "Ulasan disembunyikan.")}>
                {booking.hiddenReview ? <Eye size={14} /> : <EyeOff size={14} />} {booking.hiddenReview ? "Tampilkan" : "Sembunyikan"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!reviews.length && <Panel><Empty title="Setiap rally punya cerita." description="Ulasan muncul setelah pemain menilai booking yang selesai." /></Panel>}
      {reply && <ReplyDialog booking={reply} close={() => setReply(null)} />}
    </>
  )
}

function ReplyDialog({ booking, close }: { booking: Booking; close: () => void }) {
  const [text, setText] = useState(booking.adminReply || "")
  const { busy, error, run } = useMutation(close)
  return (
    <AdminDialog title="Balas ulasan" close={close}>
      <form onSubmit={(event) => { event.preventDefault(); run(() => api.admin.replyReview(booking.id, text), "Balasan tersimpan.") }}>
        <p className="mb-5 text-xs leading-6 text-muted-foreground">Balasan tampil di bawah ulasan pada halaman booking pemain.</p>
        <label className="block text-xs">Balasan klub<textarea required maxLength={600} value={text} onChange={(event) => setText(event.target.value)} className={`${field} mt-2 min-h-32 py-3`} placeholder="Terima kasih sudah bermain bersama kami…" /></label>
        {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
        <button disabled={busy} className={`${button} mt-5 w-full`}>{busy ? <Spinner className="text-primary-foreground" /> : <>Simpan balasan <Check size={16} /></>}</button>
      </form>
    </AdminDialog>
  )
}
