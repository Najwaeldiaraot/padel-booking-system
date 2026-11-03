import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { Bell, CalendarDays, Clock3, MapPin, Users } from "lucide-react"
import {
  courtShortName,
  dateLabel,
  endTime,
  eyebrow,
  getCourtAvailability,
  money,
  nextDay,
  today,
  useApp,
  type AppNotification,
  type Booking,
  type BookingStatus,
  type Venue,
} from "./club"
import { bookingStatusLabel, useContent, useLocale } from "./i18n"

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useLocale()
  const tone =
    status === "checked_in"
      ? "bg-emerald-600 text-white font-semibold animate-pulse"
      : status === "confirmed"
        ? "bg-success-soft text-success-foreground"
        : status === "completed"
          ? "bg-secondary text-primary"
          : status === "cancelled" || status === "expired"
            ? "bg-danger-soft text-destructive"
            : "bg-warning-soft text-foreground"
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-2xs font-medium ${tone}`}>
      <span className="size-1.5 bg-current" aria-hidden="true" />
      {bookingStatusLabel(status, t)}
    </span>
  )
}

export function SlotPicker({
  court,
  date,
  onDateChange,
  duration,
  value,
  onChange,
  ignoreBookingId,
}: {
  court: number
  date: string
  onDateChange: (date: string) => void
  duration: number
  value: string
  onChange: (time: string) => void
  ignoreBookingId?: string
}) {
  const { club, busy } = useApp()
  const { t } = useLocale()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  const { slots, canSelect } = getCourtAvailability({ club, court, date, duration, busy, now, ignoreBookingId })
  const available = slots.some((_, index) => canSelect(index))
  return (
    <div>
      <label className="block text-xs font-medium">
        {t("Tanggal main", "Date")}
        <input
          required
          type="date"
          min={today()}
          value={date}
          onChange={(event) => {
            if (event.target.value && event.target.value >= today()) onDateChange(event.target.value)
          }}
          className="mt-2 min-h-12 w-full border border-border bg-card px-4 text-sm focus:border-primary focus:outline-2 focus:outline-ring"
        />
      </label>
      <p className="mt-5 text-xs font-medium">{t("Jam mulai · WIB", "Start time · WIB")}</p>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
        {slots.map((slot, index) => {
          const open = canSelect(index)
          return (
            <button
              key={slot}
              type="button"
              disabled={!open}
              aria-pressed={value === slot}
              aria-label={`${slot} ${open ? t("tersedia", "available") : t("tidak tersedia", "unavailable")}`}
              onClick={() => onChange(slot)}
              className={`min-h-11 border text-xs tabular-nums transition ${
                value === slot
                  ? "border-primary bg-primary text-primary-foreground"
                  : open
                    ? "border-border bg-card hover:border-primary"
                    : "border-transparent bg-muted text-muted-foreground/60 line-through"
              }`}
            >
              {slot}
            </button>
          )
        })}
      </div>
      {!available && (
        <div role="status" className="mt-4 bg-secondary/60 p-4 text-xs leading-6">
          {t("Belum ada slot untuk tanggal dan durasi ini.", "No slots for this date and duration.")}{" "}
          <button type="button" onClick={() => onDateChange(nextDay(date, 1))} className="min-h-11 font-medium underline underline-offset-4">
            {t("Lihat hari berikutnya", "See the next day")}
          </button>
        </div>
      )}
      <p className="mt-3 text-2xs text-muted-foreground">
        {t("Putih: tersedia · Hijau: dipilih · Abu-abu: tidak tersedia", "White: available · Green: selected · Grey: unavailable")}
      </p>
    </div>
  )
}

export function BookingSummary({
  booking,
  venue,
}: {
  booking: Pick<Booking, "court" | "courtName" | "courtType" | "date" | "time" | "duration" | "total">
  venue: Venue
}) {
  const { t, locale } = useLocale()
  const content = useContent()
  const court = venue.courtOptions.find((item) => item.id === booking.court)
  return (
    <div className="border border-border bg-card p-6">
      <img src={court?.photo || venue.photo} alt="" className="aspect-[1.9] w-full object-cover" />
      <p className={`${eyebrow} mt-5 text-muted-foreground`}>{venue.name}</p>
      <h2 className="mt-2 font-display text-3xl">
        {court ? courtShortName(content.court(court, "name")) : courtShortName(booking.courtName || "")}
      </h2>
      <div className="mt-5 space-y-3 border-t border-border pt-5 text-xs">
        <p className="flex items-center gap-3">
          <CalendarDays size={15} aria-hidden="true" />
          {dateLabel(booking.date, false, locale)}
        </p>
        <p className="flex items-center gap-3">
          <Clock3 size={15} aria-hidden="true" />
          {booking.time}–{endTime(booking.time, booking.duration)} WIB · {booking.duration} {t("menit", "min")}
        </p>
        <p className="flex items-center gap-3">
          <Users size={15} aria-hidden="true" />
          {booking.courtName} · {booking.courtType || court?.type}
        </p>
        <p className="flex items-center gap-3">
          <MapPin size={15} aria-hidden="true" />
          {venue.address}
        </p>
      </div>
      <div className="mt-5 space-y-3 border-t border-border pt-5 text-xs">
        <p className="flex justify-between">
          <span>{t("Sewa lapangan", "Court rental")}</span>
          <span>{money(booking.total)}</span>
        </p>
        <p className="flex justify-between">
          <span>{t("Biaya layanan", "Service fee")}</span>
          <span>{money(0)}</span>
        </p>
        <p className="flex justify-between border-t border-border pt-4 text-base font-semibold">
          <span>{t("Total", "Total")}</span>
          <span>{money(booking.total)}</span>
        </p>
      </div>
    </div>
  )
}

/** Downloads an .ics file so players can add the game to any calendar. */
export function downloadCalendar(booking: Booking, venue: Venue) {
  const stamp = (date: string, time: string) =>
    new Date(`${date}T${time}:00+07:00`).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const end = endTime(booking.time, booking.duration)
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rally Padel Club//Booking//ID",
    "BEGIN:VEVENT",
    `UID:${booking.id}@rallypadel.club`,
    `DTSTAMP:${stamp(today(), "00:00")}`,
    `DTSTART:${stamp(booking.date, booking.time)}`,
    `DTEND:${end === "24:00" ? stamp(nextDay(booking.date, 1), "00:00") : stamp(booking.date, end)}`,
    `SUMMARY:Padel · ${booking.courtName} · ${venue.name}`,
    `LOCATION:${venue.address.replace(/,/g, "\\,")}`,
    `DESCRIPTION:Kode booking ${booking.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${booking.id}.ics`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function NotificationsMenu({
  items,
  describe,
  onOpen,
  onItemClick,
  label,
  emptyText,
  tone = "light",
  locale = "id",
}: {
  items: AppNotification[]
  describe: (item: AppNotification) => { title: string; body: string }
  onOpen: () => void
  onItemClick?: (item: AppNotification) => void
  label: string
  emptyText: string
  tone?: "light" | "dark"
  locale?: "id" | "en"
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const unread = items.filter((item) => !item.readAt && item.status !== "cancelled").length

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false)
    const onClick = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false)
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onClick)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onClick)
    }
  }, [open])

  const handleNotificationClick = (item: AppNotification) => {
    onItemClick?.(item)
    setOpen(false)

    if (item.audience === "admin") {
      if (item.bookingId) {
        navigate(`/admin/bookings?q=${encodeURIComponent(item.bookingId)}`)
      } else if (item.type && item.type.includes("review")) {
        navigate("/admin/reviews")
      } else if (item.type && item.type.includes("payment")) {
        navigate("/admin/transactions")
      } else {
        navigate("/admin/bookings")
      }
    } else {
      if (item.bookingId) {
        navigate(`/confirmation/${item.bookingId}`)
      } else {
        navigate("/bookings")
      }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`${label}${unread ? ` (${unread})` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`relative flex size-11 items-center justify-center transition ${tone === "dark" ? "hover:bg-white/10" : "hover:bg-secondary"}`}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-clay text-2xs font-bold leading-none text-white animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(380px,calc(100vw-32px))] border border-border bg-background text-foreground shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{label}</span>
              {unread > 0 && (
                <span className="rounded-full bg-clay/15 px-2 py-0.5 text-2xs font-bold text-clay">
                  {unread} baru
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => onOpen()}
                className="text-2xs text-muted-foreground hover:text-foreground hover:underline transition"
              >
                {locale === "en" ? "Mark all read" : "Tandai semua dibaca"}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border/60">
            {items.length ? (
              items.slice(0, 20).map((item) => {
                const text = describe(item)
                const isUnread = !item.readAt
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className={`group w-full text-left flex gap-3.5 p-4 transition ${
                      isUnread
                        ? "bg-forest-light/15 hover:bg-forest-light/25 dark:bg-forest/10"
                        : "hover:bg-secondary/60 opacity-80 hover:opacity-100"
                    }`}
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full transition-transform group-hover:scale-125 ${
                        isUnread
                          ? "bg-forest-dark dark:bg-forest-muted ring-4 ring-forest-light/50"
                          : "bg-muted-foreground/30"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs ${isUnread ? "font-bold text-foreground" : "font-medium text-foreground/85"}`}>
                          {text.title}
                        </p>
                        {isUnread && (
                          <span className="shrink-0 rounded bg-forest-dark/10 dark:bg-forest-light/20 px-1.5 py-0.5 font-mono text-3xs font-semibold text-forest-dark dark:text-forest-light uppercase">
                            Baru
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2">{text.body}</p>
                      <p className="mt-1.5 text-2xs text-muted-foreground/80">
                        {item.status === "scheduled"
                          ? `${locale === "en" ? "Scheduled" : "Terjadwal"} · ${new Date(item.scheduledFor!).toLocaleString(locale === "en" ? "en-GB" : "id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : new Date(item.createdAt).toLocaleString(locale === "en" ? "en-GB" : "id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{" "}
                        WIB · {item.channel === "email" ? "Email" : item.channel === "whatsapp" ? "WhatsApp" : "In-app"}
                      </p>
                    </div>
                  </button>
                )
              })
            ) : (
              <p className="px-5 py-8 text-center text-xs text-muted-foreground">{emptyText}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
