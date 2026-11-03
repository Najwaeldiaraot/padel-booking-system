import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { ArrowRight, ArrowUpRight, CalendarDays, CalendarPlus, CheckCircle2, Copy, FileText, Mail, QrCode, Star } from "lucide-react"
import { InvoiceModal } from "./InvoiceModal"
import { api } from "./api"
import {
  button,
  courtShortName,
  dangerButton,
  dateLabel,
  endTime,
  eyebrow,
  field,
  hoursUntil,
  money,
  outlineButton,
  useApp,
  type Booking,
} from "./club"
import { BookingStatusBadge, BookingSummary, SlotPicker, downloadCalendar } from "./BookingParts"
import { errorMessage, useLocale } from "./i18n"
import { ErrorState, Modal, PageLoader, Spinner, usePageTitle } from "./ui"

export function ConfirmationPage() {
  const { id = "" } = useParams()
  const { club, user, openAuth, notify, notifications } = useApp()
  const { t } = useLocale()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading")
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  usePageTitle(t("Konfirmasi booking", "Booking confirmation"), club.name)
  useEffect(() => {
    if (!user) return
    api.bookings
      .get(id)
      .then((item) => {
        setBooking(item)
        setState("ready")
      })
      .catch(() => setState("missing"))
  }, [id, user])
  if (!user)
    return (
      <ErrorState
        title={t("Masuk untuk melihat booking.", "Sign in to view this booking.")}
        description={t("Detail booking hanya bisa dilihat oleh pemiliknya.", "Booking details are only visible to their owner.")}
        action={<button type="button" className={button} onClick={() => openAuth()}>{t("Masuk", "Sign in")} <ArrowRight size={16} /></button>}
      />
    )
  if (state === "loading") return <PageLoader label={t("Memuat booking…", "Loading booking…")} />
  if (!booking)
    return (
      <ErrorState
        title={t("Booking tidak ditemukan.", "Booking not found.")}
        description={t("Kode ini tidak terdaftar di akunmu.", "This code isn't linked to your account.")}
        action={<Link to="/bookings" className={button}>{t("Booking saya", "My bookings")} <ArrowRight size={16} /></Link>}
      />
    )
  const cancelled = booking.status === "cancelled"
  const reminder = notifications.find((item) => item.bookingId === booking.id && item.type === "booking_reminder")
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-9 text-center">
        <CheckCircle2 className={`mx-auto ${cancelled ? "text-muted-foreground" : "text-forest-muted"}`} size={46} strokeWidth={1.3} aria-hidden="true" />
        <p className={`${eyebrow} mt-5`}>{cancelled ? t("Booking dibatalkan", "Booking cancelled") : t("Booking terkonfirmasi", "Booking confirmed")}</p>
        <h1 className="mt-4 font-display text-6xl">{cancelled ? t("Sampai di rally berikutnya.", "See you next rally.") : t("Lapanganmu sudah siap.", "Your court is ready.")}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {cancelled
            ? t("Jadwal dibatalkan dan slot kembali tersedia.", "The booking was cancelled and the slot reopened.")
            : t(`Datang ${club.policy.arrivalMinutes} menit sebelum jadwal. Ajak teman dan siapkan raket.`, `Arrive ${club.policy.arrivalMinutes} minutes early. Bring friends and your racket.`)}
        </p>
      </div>
      <BookingSummary booking={booking} venue={club} />
      <div className="flex flex-wrap items-center justify-between gap-3 border border-t-0 border-border bg-secondary p-5">
        <div>
          <p className={eyebrow}>{t("Kode booking", "Booking code")}</p>
          <p className="mt-2 font-mono text-sm">{booking.id}</p>
        </div>
        <button
          type="button"
          className={outlineButton}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(booking.id)
              notify(t("Kode booking disalin.", "Booking code copied."))
            } catch {
              notify(`${t("Kode booking", "Booking code")}: ${booking.id}`)
            }
          }}
        >
          <Copy size={15} /> {t("Salin kode", "Copy code")}
        </button>
      </div>
      {!cancelled && (
        <div className="mt-6 flex items-start gap-3 border border-border p-5 text-xs leading-6">
          <Mail size={16} className="mt-1 shrink-0" aria-hidden="true" />
          <p>
            {t("Konfirmasi dikirim ke", "Confirmation sent to")} <strong>{user.email || `+${user.phone}`}</strong>.{" "}
            {reminder?.status === "scheduled" ? t("Pengingat dijadwalkan H-1 sebelum main.", "A reminder is scheduled one day before.") : ""}
          </p>
        </div>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {!cancelled && (
          <>
            <button
              type="button"
              className={`${outlineButton} sm:col-span-2 border-primary/40 bg-primary/5 font-semibold text-primary`}
              onClick={() => setInvoiceOpen(true)}
            >
              <FileText size={16} /> {t("Lihat Invoice & QR Tiket Masuk", "View Invoice & QR Ticket")}
            </button>
            <button type="button" className={outlineButton} onClick={() => downloadCalendar(booking, club)}>
              <CalendarPlus size={16} /> {t("Tambah ke kalender", "Add to calendar")}
            </button>
          </>
        )}
        <Link to="/bookings" className={`${button} ${cancelled ? "sm:col-span-2" : ""}`}>
          {t("Lihat booking saya", "View my bookings")} <ArrowRight size={16} />
        </Link>
      </div>
      <InvoiceModal
        booking={booking}
        venue={club}
        isOpen={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
      />
    </div>
  )
}

type Tab = "upcoming" | "completed" | "cancelled" | "all"

export default function MyBookingsPage() {
  const { club, user, myBookings, ready, openAuth } = useApp()
  const { t, locale } = useLocale()
  const [tab, setTab] = useState<Tab>("upcoming")
  const [rescheduling, setRescheduling] = useState<Booking | null>(null)
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const [rating, setRating] = useState<Booking | null>(null)
  const [viewInvoice, setViewInvoice] = useState<Booking | null>(null)
  usePageTitle(t("Booking saya", "My bookings"), club.name)
  const policy = club.policy
  if (!user)
    return (
      <ErrorState
        title={t("Booking saya.", "My bookings.")}
        description={t("Masuk untuk melihat jadwal main, mengubah jadwal, dan memberi penilaian.", "Sign in to see your games, reschedule, and leave ratings.")}
        action={<button type="button" className={button} onClick={() => openAuth()}>{t("Masuk / Daftar", "Sign in / Sign up")} <ArrowRight size={16} /></button>}
      />
    )
  if (!ready) return <PageLoader label={t("Memuat booking…", "Loading bookings…")} />
  const tabs: { id: Tab; label: string; match: (booking: Booking) => boolean }[] = [
    { id: "upcoming", label: t("Mendatang", "Upcoming"), match: (booking) => ["hold", "pending_payment", "confirmed", "checked_in"].includes(booking.status) },
    { id: "completed", label: t("Selesai", "Completed"), match: (booking) => booking.status === "completed" },
    { id: "cancelled", label: t("Dibatalkan", "Cancelled"), match: (booking) => booking.status === "cancelled" },
    { id: "all", label: t("Semua", "All"), match: () => true },
  ]
  const active = tabs.find((item) => item.id === tab)!
  const items = myBookings
    .filter(active.match)
    .sort((a, b) =>
      tab === "upcoming" ? `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`) : `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`),
    )
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      <p className={`${eyebrow} text-sage`}>{t("Rencana bermainmu", "Your game plan")}</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-6xl">{t("Booking saya.", "My bookings.")}</h1>
        <Link to="/book" className={outlineButton}>{t("Booking lapangan", "Book a court")} <ArrowUpRight size={15} /></Link>
      </div>
      <div role="tablist" aria-label={t("Filter booking", "Filter bookings")} className="mt-8 flex flex-wrap gap-2 border-b border-border pb-5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-11 px-4 text-xs transition ${tab === item.id ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`}
          >
            {item.label} <span className="ml-1 opacity-60">{myBookings.filter(item.match).length}</span>
          </button>
        ))}
      </div>
      <div className="mt-7 space-y-5">
        {items.map((booking) => {
          const hours = hoursUntil(booking.date, booking.time)
          const canCancel = booking.status === "confirmed" && hours > policy.cancellationHours
          const canReschedule =
            booking.status === "confirmed" && policy.allowReschedule && hours > policy.rescheduleHours && booking.rescheduleCount < policy.maxReschedules
          const court = club.courtOptions.find((item) => item.id === booking.court)
          return (
            <article key={booking.id} className="grid gap-5 border border-border bg-card p-5 sm:grid-cols-[160px_1fr]">
              <img src={court?.photo || club.photo} alt="" className="aspect-[1.4] h-full max-h-44 w-full object-cover" />
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`${eyebrow} text-muted-foreground`}>{booking.id}</span>
                  <BookingStatusBadge status={booking.status} />
                </div>
                <h2 className="mt-2 font-display text-3xl">{courtShortName(booking.courtName || "")}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {dateLabel(booking.date, true, locale)} · {booking.time}–{endTime(booking.time, booking.duration)} WIB · {booking.duration} {t("menit", "min")}
                </p>
                {booking.status === "cancelled" && booking.refundAmount ? (
                  <p className="mt-2 text-xs text-success-foreground">{t("Dana dikembalikan", "Refunded")} {money(booking.refundAmount)}</p>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <strong className="text-sm">{money(booking.total)}</strong>
                  <div className="flex flex-wrap gap-2">
                    {(booking.status === "hold" || booking.status === "pending_payment") && (
                      <Link className={button} to={`/checkout/${booking.id}`}>{t("Lanjutkan pembayaran", "Finish payment")}</Link>
                    )}
                    {(booking.status === "confirmed" || booking.status === "checked_in") && (
                      <>
                        <button
                          type="button"
                          className={`${outlineButton} gap-1.5 border-primary/30 text-primary`}
                          onClick={() => setViewInvoice(booking)}
                        >
                          <FileText size={14} /> {t("Invoice & QR", "Invoice & QR")}
                        </button>
                        <Link className={outlineButton} to={`/confirmation/${booking.id}`}>{t("Detail", "Details")}</Link>
                        {booking.status === "confirmed" && (
                          <>
                            <button type="button" disabled={!canReschedule} className={outlineButton} onClick={() => setRescheduling(booking)}>
                              {t("Ubah jadwal", "Reschedule")}
                            </button>
                            <button type="button" disabled={!canCancel} className={`${outlineButton} text-destructive`} onClick={() => setCancelling(booking)}>
                              {t("Batalkan", "Cancel")}
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {booking.status === "completed" &&
                      (booking.rating ? (
                        <span className="flex min-h-11 items-center gap-2 text-xs">
                          <Star size={14} className="fill-rating text-rating" aria-hidden="true" />
                          {t("Penilaianmu", "Your rating")}: {booking.rating}/5
                        </span>
                      ) : (
                        <button type="button" className={button} onClick={() => setRating(booking)}>
                          {t("Beri penilaian", "Rate your game")} <Star size={14} />
                        </button>
                      ))}
                    {(booking.status === "cancelled" || booking.status === "completed") && (
                      <Link className={outlineButton} to={`/book?court=${booking.court}`}>{t("Booking lagi", "Book again")}</Link>
                    )}
                  </div>
                </div>
                {booking.status === "confirmed" && (!canCancel || !canReschedule) && (
                  <p className="mt-3 text-2xs leading-5 text-muted-foreground">
                    {!canReschedule &&
                      (booking.rescheduleCount >= policy.maxReschedules
                        ? t("Batas ubah jadwal untuk booking ini sudah terpakai. ", "This booking has used its reschedule allowance. ")
                        : policy.allowReschedule
                          ? t(`Ubah jadwal tersedia hingga ${policy.rescheduleHours} jam sebelum main. `, `Rescheduling closes ${policy.rescheduleHours} hours before play. `)
                          : t("Ubah jadwal melalui klub. ", "Reschedule through the club. "))}
                    {!canCancel && t(`Pembatalan tersedia hingga ${policy.cancellationHours} jam sebelum main.`, `Cancellation closes ${policy.cancellationHours} hours before play.`)}
                  </p>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {!items.length && (
        <div className="py-16 text-center">
          <CalendarDays className="mx-auto text-muted-foreground" size={28} aria-hidden="true" />
          <h2 className="mt-4 font-display text-4xl">{t("Rally berikutnya menunggu.", "Your next rally awaits.")}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t("Belum ada booking di kategori ini.", "No bookings in this category yet.")}</p>
          <Link className={`${button} mt-6`} to="/book">{t("Booking lapangan", "Book a court")} <ArrowRight size={15} /></Link>
        </div>
      )}
      <RescheduleDialog booking={rescheduling} close={() => setRescheduling(null)} />
      <CancelDialog booking={cancelling} close={() => setCancelling(null)} />
      <RatingDialog booking={rating} close={() => setRating(null)} />
      <InvoiceModal
        booking={viewInvoice}
        venue={club}
        isOpen={Boolean(viewInvoice)}
        onClose={() => setViewInvoice(null)}
      />
    </div>
  )
}

function useAction(close: () => void, success: string) {
  const { refresh, notify } = useApp()
  const { t } = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true)
    setError("")
    try {
      await task()
      await refresh()
      notify(success)
      close()
    } catch (problem) {
      setError(errorMessage(problem, t))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

function RescheduleDialog({ booking, close }: { booking: Booking | null; close: () => void }) {
  const { t } = useLocale()
  return (
    <Modal open={!!booking} close={close} title={t("Pindahkan jadwal", "Reschedule")} closeLabel={t("Tutup", "Close")} wide>
      {booking && <RescheduleForm booking={booking} close={close} />}
    </Modal>
  )
}

function RescheduleForm({ booking, close }: { booking: Booking; close: () => void }) {
  const { club } = useApp()
  const { t, locale } = useLocale()
  const [date, setDate] = useState(booking.date)
  const [time, setTime] = useState("")
  const { busy, error, run } = useAction(close, t("Jadwal berhasil dipindahkan.", "Your booking has been moved."))
  const left = club.policy.maxReschedules - booking.rescheduleCount
  return (
    <div>
      <p className="text-sm leading-7 text-muted-foreground">
        {t("Jadwal saat ini", "Current slot")}: <strong className="text-foreground">{dateLabel(booking.date, true, locale)} · {booking.time}–{endTime(booking.time, booking.duration)}</strong>.{" "}
        {t(
          `${courtShortName(booking.courtName || "")} dan durasi ${booking.duration} menit tetap sama. Sisa ${left}× ubah jadwal.`,
          `${courtShortName(booking.courtName || "")} and the ${booking.duration}-minute duration stay the same. ${left} reschedule(s) left.`,
        )}
      </p>
      <div className="mt-5">
        <SlotPicker
          court={booking.court}
          date={date}
          onDateChange={(value) => {
            setDate(value)
            setTime("")
          }}
          duration={booking.duration}
          value={time}
          onChange={setTime}
          ignoreBookingId={booking.id}
        />
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <button
        type="button"
        disabled={!time || busy || (date === booking.date && time === booking.time)}
        className={`${button} mt-6 w-full`}
        onClick={() => run(() => api.bookings.reschedule(booking.id, { date, time }))}
      >
        {busy ? <Spinner className="text-primary-foreground" /> : <>{t("Pindahkan ke", "Move to")} {time ? `${time}–${endTime(time, booking.duration)}` : "…"} <ArrowRight size={15} /></>}
      </button>
    </div>
  )
}

function CancelDialog({ booking, close }: { booking: Booking | null; close: () => void }) {
  const { club } = useApp()
  const { t } = useLocale()
  const { busy, error, run } = useAction(close, t("Booking dibatalkan. Slot kembali tersedia.", "Booking cancelled. The slot is open again."))
  const refund = booking ? Math.round((booking.total * club.policy.refundPercent) / 100) : 0
  return (
    <Modal open={!!booking} close={close} title={t("Batalkan jadwal main?", "Cancel this game?")} closeLabel={t("Tutup", "Close")}>
      <p className="text-sm leading-7 text-muted-foreground">
        {t("Slot akan dibuka kembali untuk pemain lain.", "The slot will reopen for other players.")}{" "}
        {refund > 0
          ? t(`Dana dikembalikan ${money(refund)} (${club.policy.refundPercent}%).`, `${money(refund)} (${club.policy.refundPercent}%) will be refunded.`)
          : t("Sesuai kebijakan klub, tidak ada pengembalian dana.", "Under the club policy, no refund is issued.")}
      </p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <button type="button" disabled={busy} className={`${dangerButton} mt-6 w-full`} onClick={() => booking && run(() => api.bookings.cancel(booking.id))}>
        {busy ? <Spinner className="text-white" /> : t("Ya, batalkan booking", "Yes, cancel booking")}
      </button>
      <button type="button" className={`${outlineButton} mt-3 w-full`} onClick={close}>{t("Tetap main", "Keep my game")}</button>
    </Modal>
  )
}

function RatingDialog({ booking, close }: { booking: Booking | null; close: () => void }) {
  const { club } = useApp()
  const { t } = useLocale()
  const [stars, setStars] = useState(0)
  const [review, setReview] = useState("")
  const { busy, error, run } = useAction(close, t("Terima kasih! Penilaianmu tersimpan.", "Thank you! Your rating is saved."))
  useEffect(() => {
    setStars(0)
    setReview("")
  }, [booking])
  const labels = ["", t("Kurang memuaskan", "Disappointing"), t("Bisa lebih baik", "Could be better"), t("Cukup baik", "Good"), t("Menyenangkan", "Great"), t("Luar biasa!", "Outstanding!")]
  return (
    <Modal open={!!booking} close={close} title={t("Bagaimana permainanmu?", "How was your game?")} closeLabel={t("Tutup", "Close")}>
      <p className="text-sm text-muted-foreground">{t(`Penilaianmu membantu pemain lain mengenal ${club.name}.`, `Your rating helps other players get to know ${club.name}.`)}</p>
      <div className="mt-6 flex justify-center gap-2" role="radiogroup" aria-label={t("Pilih 1 sampai 5 bintang", "Choose 1 to 5 stars")}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" role="radio" aria-checked={stars === value} aria-label={`${value} / 5`} onClick={() => setStars(value)} className="flex size-12 items-center justify-center transition hover:scale-110">
            <Star size={32} strokeWidth={1.2} className={value <= stars ? "fill-rating text-rating" : "text-muted-foreground/50"} />
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-3 text-center text-sm">{stars ? labels[stars] : t("Pilih jumlah bintang", "Choose a star rating")}</p>
      <label className="mt-6 block text-xs">
        {t("Ceritakan pengalamanmu (opsional)", "Tell us about it (optional)")}
        <textarea value={review} onChange={(event) => setReview(event.target.value)} maxLength={500} className={`${field} mt-2 min-h-28 py-3`} />
      </label>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <button type="button" disabled={!stars || busy} className={`${button} mt-5 w-full`} onClick={() => booking && run(() => api.bookings.rate(booking.id, { rating: stars, review }))}>
        {busy ? <Spinner className="text-primary-foreground" /> : <>{t("Kirim penilaian", "Submit rating")} <ArrowRight size={15} /></>}
      </button>
    </Modal>
  )
}
