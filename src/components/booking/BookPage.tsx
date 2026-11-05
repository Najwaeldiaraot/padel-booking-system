import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { ArrowDown, ArrowLeft, ArrowRight, Check, MapPin, Star, Sun } from "lucide-react"
import { motion } from "motion/react"
import { api } from "@/lib/api"
import { cinematicEase } from "@/components/ui/CinematicMotion"
import {
  button,
  clock,
  courtShortName,
  endTime,
  eyebrow,
  money,
  outlineButton,
  ratingSummary,
  today,
  useApp,
} from "@/lib/club"
import { BookingPolicyNotice } from "./BookingSupport"
import { SlotPicker } from "./BookingParts"
import { errorMessage, useContent, useLocale } from "@/lib/i18n"
import { Spinner, usePageTitle } from "@/components/ui"

export default function BookPage() {
  const { club, user, openAuth, date, setDate, reviews, refresh } = useApp()
  const { t, locale } = useLocale()
  const content = useContent()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const activeCourts = club.courtOptions.filter((item) => item.active)
  const requested = Number(params.get("court"))
  const court = activeCourts.find((item) => item.id === requested) || activeCourts[0]
  const [duration, setDuration] = useState(60)
  const [time, setTime] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [allReviews, setAllReviews] = useState(false)
  usePageTitle(t("Booking lapangan", "Book a court"), club.name)
  useEffect(() => {
    const requestedDate = params.get("date")
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= today()) setDate(requestedDate)
  }, [params, setDate])

  // Real-time SSE slot updates from Upstash Redis / Backend
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const eventSource = new EventSource("/api/slots/realtime")
      eventSource.addEventListener("slot_update", () => {
        refresh()
      })
      return () => {
        eventSource.close()
      }
    } catch {
      // Fallback if SSE is unsupported
    }
  }, [refresh])

  useEffect(() => {
    setTime("")
    setError("")
  }, [court?.id, date, duration])
  const proceed = async () => {
    if (!court || !time) return
    setLoading(true)
    setError("")
    try {
      const hold = await api.bookings.hold({ court: court.id, date, time, duration })
      navigate(`/checkout/${hold.id}`)
    } catch (problem) {
      setError(errorMessage(problem, t))
      setTime("")
      refresh()
    } finally {
      setLoading(false)
    }
  }
  const proceedRef = useRef(proceed)
  proceedRef.current = proceed
  const start = () => (user ? proceed() : openAuth(() => proceedRef.current()))
  if (!court)
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-5xl">{t("Lapangan sedang dipersiapkan.", "Courts are being prepared.")}</h1>
        <p className="mt-5 text-sm text-muted-foreground">
          {t("Belum ada lapangan yang bisa dibooking. Kembali lagi sebentar lagi.", "No courts are open for booking yet. Check back soon.")}
        </p>
        <Link to="/" className={`${button} mt-6`}>{t("Kembali ke klub", "Back to the club")}</Link>
      </div>
    )
  const total = (court.price * duration) / 60
  const summary = ratingSummary(reviews)
  const facilities = club.facilityOptions.filter((item) => item.active)
  const shown = allReviews ? reviews : reviews.slice(0, 3)
  return (
    <div className="mx-auto max-w-[1350px] px-6 py-7 pb-28 md:px-12 lg:pb-12">
      <Link to="/" className={`${outlineButton} !min-h-11 border-transparent !px-0 text-xs text-muted-foreground hover:bg-transparent`}>
        <ArrowLeft size={14} /> {t(`Kembali ke ${club.name}`, `Back to ${club.name}`)}
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className={`${eyebrow} mb-3 text-sage`}>{court.type} · {club.name}</p>
          <h1 className="font-display text-5xl md:text-7xl">{courtShortName(content.court(court, "name"))}</h1>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin size={14} aria-hidden="true" /> {club.address}
          </p>
        </div>
        {summary.count > 0 && (
          <a href="#reviews" className="inline-flex min-h-11 items-center gap-1.5 text-xs">
            <Star size={13} className="fill-rating text-rating" aria-hidden="true" />
            <strong>{summary.average.toFixed(1)}</strong>
            <span className="text-muted-foreground">({summary.count} {t("penilaian", "ratings")})</span>
          </a>
        )}
      </div>
      <div role="group" aria-label={t("Pilih lapangan", "Choose a court")} className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {activeCourts.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={court.id === item.id}
            onClick={() => setParams({ court: String(item.id), date }, { replace: true, preventScrollReset: true })}
            className={`flex items-center gap-4 border p-3 text-left transition shadow-xs ${
              court.id === item.id
                ? "border-primary bg-white ring-1 ring-primary/25"
                : "border-border bg-white hover:border-primary/50"
            }`}
          >
            <img src={item.photo} alt="" className="h-16 w-20 object-cover" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{courtShortName(content.court(item, "name"))}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{item.type} · {money(item.price)} / {t("jam", "hr")}</span>
            </span>
            {court.id === item.id && <Check size={16} className="ml-auto shrink-0 text-primary" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <a href="#booking-form" className={`${button} mt-5 w-full lg:hidden`}>
        {t("Pilih jadwal", "Choose a time")} · {money(court.price)} / {t("jam", "hr")} <ArrowDown size={15} />
      </a>
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_440px] lg:gap-16">
        <div>
          <div className="relative mb-8 aspect-[1.35] overflow-hidden bg-primary md:aspect-[1.6]">
            {activeCourts.map((item) => (
              <motion.img
                key={item.id}
                src={item.photo}
                alt={item.id === court.id ? `${item.name} · ${club.name}` : ""}
                aria-hidden={item.id !== court.id}
                initial={false}
                animate={{ opacity: item.id === court.id ? 1 : 0 }}
                transition={{ duration: 0.55, ease: cinematicEase }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/75 to-transparent" />
            <div className="absolute right-6 bottom-6 left-6 flex items-end justify-between gap-3 text-background">
              <span className="font-display text-4xl italic">{courtShortName(content.court(court, "name"))}</span>
              <span className="flex items-center gap-2 text-2xs uppercase tracking-eyebrow">
                <Sun size={12} aria-hidden="true" /> {court.type}
              </span>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-7 text-muted-foreground">{content.court(court, "description")}</p>
          {facilities.length > 0 && (
            <ul className="mt-7 flex flex-wrap gap-3" aria-label={t("Fasilitas klub", "Club facilities")}>
              {facilities.map((item) => (
                <li key={item.id} className="flex items-center gap-2 border border-border bg-white px-3 py-2 text-xs shadow-2xs font-medium">
                  <Check size={12} className="text-primary" aria-hidden="true" /> {content.facility(item, "name")}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
            {t("Setiap hari", "Daily")} · {clock(club.openHour)}–{clock(club.closeHour)} WIB
          </p>
          <div className="mt-6">
            <BookingPolicyNotice />
          </div>
        </div>
        <section id="booking-form" aria-label={t("Pilih jadwal booking", "Choose your booking time")} className="scroll-mt-6 border border-border bg-card p-5 lg:sticky lg:top-6 lg:p-7">
          <h2 className="font-display text-3xl">{t("Pilih waktu main.", "Pick your time.")}</h2>
          <p className="mt-4 text-xs font-medium">{t("Durasi permainan", "Duration")}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[60, 90, 120].map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={duration === minutes}
                onClick={() => setDuration(minutes)}
                className={`min-h-11 border text-xs transition ${
                  duration === minutes
                    ? "border-primary bg-primary text-primary-foreground font-semibold"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                }`}
              >
                {minutes} {t("menit", "min")}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <SlotPicker court={court.id} date={date} onDateChange={setDate} duration={duration} value={time} onChange={setTime} />
          </div>
          <div aria-live="polite" className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
            <div>
              <p className="text-2xs text-muted-foreground">{t("Total", "Total")} · {duration} {t("menit", "min")}</p>
              <p className="mt-1 text-xl font-semibold">{money(total)}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {time ? `${time}–${endTime(time, duration)} WIB` : t("Pilih jam mulai", "Pick a start time")}
            </span>
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
          <button type="button" disabled={!time || loading} onClick={start} className={`${button} mt-5 w-full`}>
            {loading ? <Spinner label={t("Menahan slot…", "Holding your slot…")} className="text-primary-foreground" /> : <>{user ? t("Lanjutkan ke pembayaran", "Continue to payment") : t("Masuk & lanjutkan", "Sign in & continue")} <ArrowRight size={16} /></>}
          </button>
          <p className="mt-3 text-center text-2xs text-muted-foreground">
            {t(`Slot ditahan ${club.policy.holdMinutes} menit setelah kamu lanjut.`, `Your slot is held for ${club.policy.holdMinutes} minutes once you continue.`)}
          </p>
        </section>
      </div>
      {time && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-xl lg:hidden">
          <div>
            <p className="text-2xs text-muted-foreground">{time}–{endTime(time, duration)} · {duration} {t("menit", "min")}</p>
            <p className="mt-1 text-lg font-semibold">{money(total)}</p>
          </div>
          <button type="button" disabled={loading} onClick={start} className={`${button} !min-h-11 !px-4`}>
            {t("Lanjutkan", "Continue")} <ArrowRight size={14} />
          </button>
        </div>
      )}
      <section id="reviews" className="mt-14 scroll-mt-6 border-t border-border pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-4xl">{t("Kata pemain kami", "What players say")}</h2>
          {summary.count > 0 && (
            <p className="flex items-center gap-2 text-xs">
              <Star size={13} className="fill-rating text-rating" aria-hidden="true" />
              <strong>{summary.average.toFixed(1)}</strong> · {summary.count} {t("penilaian dari booking selesai", "ratings from completed bookings")}
            </p>
          )}
        </div>
        {reviews.length ? (
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {shown.map((review) => (
              <article key={review.id} className="border-t border-border pt-5">
                <p className="flex gap-1" aria-label={`${review.rating} / 5`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star key={index} size={12} aria-hidden="true" className={index < review.rating ? "fill-rating text-rating" : "text-border"} />
                  ))}
                </p>
                <p className="mt-3 text-sm leading-7">{review.review || t("Memberi rating tanpa komentar.", "Rated without a comment.")}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {review.name} · {review.courtName ? courtShortName(review.courtName) : ""} · {new Date(`${review.date}T12:00:00+07:00`).toLocaleDateString(locale === "en" ? "en-GB" : "id-ID", { month: "short", year: "numeric" })}
                </p>
                {review.reply && (
                  <p className="mt-4 border-l-2 border-clay pl-3 text-xs leading-6">
                    <strong>{t("Balasan klub", "Club reply")}:</strong> {review.reply}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">{t("Belum ada penilaian. Jadilah yang pertama setelah bermain.", "No ratings yet. Be the first after your game.")}</p>
        )}
        {reviews.length > 3 && (
          <button type="button" onClick={() => setAllReviews(!allReviews)} className={`${outlineButton} mt-8`}>
            {allReviews ? t("Tampilkan lebih sedikit", "Show fewer") : t(`Lihat semua ${reviews.length} ulasan`, `See all ${reviews.length} reviews`)}
          </button>
        )}
      </section>
    </div>
  )
}
