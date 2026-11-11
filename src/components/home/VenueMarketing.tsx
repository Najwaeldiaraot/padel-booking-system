import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Link } from "react-router"
import { ArrowRight, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, Star } from "lucide-react"
import { button, clock, courtShortName, eyebrow, outlineButton, ratingSummary, useApp } from "@/lib/club"
import { cinematicEase } from "@/components/ui/CinematicMotion"
import { useContent, useLocale } from "@/lib/i18n"
import { Modal } from "@/components/ui"

export function ClubIntroduction() {
  const { club } = useApp()
  const { t } = useLocale()
  const content = useContent()
  return (
    <section id="club" className="mx-auto grid max-w-[1344px] scroll-mt-8 gap-10 px-6 py-16 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-20 md:px-10 md:py-24">
      <div>
        <p className={`${eyebrow} text-sage`}>01 / A place to belong</p>
        <h2 className="mt-5 font-display text-5xl leading-[1.05] md:text-6xl">
          {t("Bukan cuma tempat main.", "Not just a place to play.")}
          <br />
          <span className="italic">{t("Tempat untuk kembali.", "A place to come back to.")}</span>
        </h2>
        <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">{content.club(club, "description")}</p>
      </div>
      <div className="relative pb-12">
        <img src={club.heroPhoto} alt={t(`Sudut lapangan ${club.name}`, `A corner of ${club.name}`)} loading="lazy" className="aspect-square w-full object-cover" />
        <div className="absolute right-0 bottom-0 border-l-2 border-clay bg-background px-5 py-4">
          <span className="font-display text-3xl italic">Good games. Better company.</span>
          <p className={`${eyebrow} mt-2 text-muted-foreground`}>{content.club(club, "area")}</p>
        </div>
      </div>
    </section>
  )
}

export function ClubPromotion() {
  const { club } = useApp()
  const { t } = useLocale()
  const content = useContent()
  const title = content.marketing(club, "promoTitle")
  const text = content.marketing(club, "promoText")
  if (!club.marketing.promoEnabled || !title.trim() || !text.trim()) return null
  return (
    <section id="promotion" className="mx-6 mt-20 flex max-w-[1344px] flex-col justify-between gap-6 border-y border-border bg-clay-soft px-6 py-8 md:mx-10 md:flex-row md:items-center md:px-10 lg:mx-auto">
      <div className="max-w-2xl">
        <p className={`${eyebrow} text-clay`}>Spotlight</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">{title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{text}</p>
      </div>
      <Link to="/book" className={`${button} shrink-0 self-start md:self-center`}>
        {t("Booking sekarang", "Book now")} <ArrowUpRight size={16} />
      </Link>
    </section>
  )
}

function GoogleGIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

interface StoryReview {
  id: string
  name: string
  rating: number
  review: string
  courtName?: string
  date?: string
  source: "google" | "verified"
  reply?: string
}

const curatedGoogleReviews: StoryReview[] = [
  {
    id: "g-rev-1",
    name: "Dimas Pratama",
    rating: 5,
    review: "Datang untuk main satu jam, pulangnya sudah janjian untuk minggu depan. Staf ramah dan ambience-nya luar biasa.",
    courtName: "Court 02",
    date: "Google Reviews",
    source: "google",
  },
  {
    id: "g-rev-2",
    name: "Raka Pradana",
    rating: 5,
    review: "Lapangan indoor-nya nyaman, tetap bisa main walau hujan badai di luar. Sirkulasi udara bagus dan lighting tidak silau.",
    courtName: "Court 03",
    date: "Google Reviews",
    source: "google",
  },
  {
    id: "g-rev-3",
    name: "Michael Tan",
    rating: 5,
    review: "Best padel club in Jakarta! Karpet rumput sintetisnya empuk, pro shop lengkap, dan kamar bilasnya hotel-grade.",
    courtName: "Court 01",
    date: "Google Reviews",
    source: "google",
  },
]

const fallbackVerifiedReviews: StoryReview[] = [
  {
    id: "v-rev-1",
    name: "Nadia Putri",
    rating: 5,
    review: "Lapangannya terawat dan suasananya bikin betah. Booking gampang banget dan staf selalu standby bantu bola.",
    courtName: "Court 01",
    date: "Verified Booking",
    source: "verified",
  },
  {
    id: "v-rev-2",
    name: "Clara Amanda",
    rating: 4,
    review: "Pagi yang menyenangkan. Lapangannya juara dan bersih! Sangat merekomendasikan main sebelum jam sibuk kantor.",
    courtName: "Court 01",
    date: "Verified Booking",
    source: "verified",
  },
  {
    id: "v-rev-3",
    name: "Adrian Wijaya",
    rating: 5,
    review: "Sistem reservasi online tanpa ribet, datang langsung scan tiket. Suasana kompetitif tapi tetap bersahabat.",
    courtName: "Court 03",
    date: "Verified Booking",
    source: "verified",
  },
]

export function PlayerStories() {
  const app = useApp()
  const reviews = app?.reviews || []
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const summary = ratingSummary(reviews)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [activeFilter, setActiveFilter] = useState<"all" | "google" | "verified">("all")

  // Compile reviews pool
  const appReviews: StoryReview[] = reviews
    .filter((item) => item.review)
    .map((item) => ({
      id: item.id,
      name: item.name,
      rating: item.rating,
      review: item.review!,
      courtName: item.courtName,
      date: item.date || "Verified Booking",
      source: "verified" as const,
      reply: item.reply,
    }))

  const verifiedPool = appReviews.length > 0 ? appReviews : fallbackVerifiedReviews
  const allStories: StoryReview[] = [...verifiedPool, ...curatedGoogleReviews]

  const activeStories = allStories.filter((s) => {
    if (activeFilter === "all") return true
    return s.source === activeFilter
  })

  // Auto-slide rotation every 5.5 seconds
  useEffect(() => {
    if (isPaused || activeStories.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeStories.length)
    }, 5500)
    return () => clearInterval(timer)
  }, [isPaused, activeStories.length])

  // Keep index within bounds if filter changes
  useEffect(() => {
    setCurrentIndex(0)
  }, [activeFilter])

  return (
    <section className="mx-auto mt-20 max-w-[1344px] border-t border-border px-6 pt-14 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className={`${eyebrow} text-sage`}>04 / Player notes</p>
          <h2 className="mt-5 font-display text-5xl md:text-6xl">
            {t("Cerita dari", "Stories from")}
            <br />
            <span className="italic">{t("lapangan.", "the court.")}</span>
          </h2>
        </div>
        {summary.count > 0 && (
          <div className="flex items-center gap-3">
            <span className="font-display text-6xl">{summary.average.toFixed(1)}</span>
            <div>
              <span className="flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star key={value} size={12} className={value <= Math.round(summary.average) ? "fill-rating text-rating" : "text-border"} />
                ))}
              </span>
              <p className="mt-2 text-2xs text-muted-foreground">
                {summary.count} {t("penilaian dari booking selesai", "ratings from completed bookings")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Google Business Rating Badge & Filter Tabs */}
      <div className="mt-8 flex flex-col gap-5 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center border border-border bg-card shadow-sm">
            <GoogleGIcon className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Google Rating</span>
              <span className="font-display text-xl font-bold">4.9</span>
              <span className="flex gap-0.5 text-rating" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((val) => (
                  <Star key={val} size={13} className="fill-rating text-rating" />
                ))}
              </span>
            </div>
            <p className="text-2xs text-muted-foreground">
              {t("Google Rating 4.9 ★★★★★ dari 120+ Ulasan Terverifikasi", "Google Rating 4.9 ★★★★★ from 120+ Verified Reviews")}
            </p>
          </div>
        </div>

        {/* Filter Tabs: Semua, Google, Verified */}
        <div className="flex items-center gap-1 self-start border border-border bg-card p-1 sm:self-center" role="tablist" aria-label={t("Filter ulasan", "Filter reviews")}>
          {(["all", "google", "verified"] as const).map((key) => {
            const label =
              key === "all"
                ? t("Semua", "All")
                : key === "google"
                ? "Google"
                : t("Verified", "Verified")
            const isActive = activeFilter === key
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Auto-Slide Carousel with Pause on Hover */}
      <div
        className="relative mt-8"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="overflow-hidden">
          <motion.div
            className="flex"
            animate={{ x: `-${currentIndex * 100}%` }}
            transition={{ duration: reducedMotion ? 0 : 0.5, ease: cinematicEase }}
          >
            {activeStories.map((story) => (
              <div key={story.id} className="min-w-full px-1">
                <article className="flex flex-col border border-border bg-card/40 p-7 md:p-10 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex gap-1" aria-label={`${story.rating} / 5`}>
                      {Array.from({ length: 5 }, (_, pos) => (
                        <Star
                          key={pos}
                          size={14}
                          className={pos < story.rating ? "fill-rating text-rating" : "text-border"}
                        />
                      ))}
                    </span>
                    {story.source === "google" ? (
                      <span className="inline-flex items-center gap-1.5 border border-border bg-secondary/80 px-2.5 py-1 text-2xs font-medium text-foreground">
                        <GoogleGIcon className="size-3" />
                        Google Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 border border-sage/40 bg-sage/10 px-2.5 py-1 text-2xs font-medium text-sage">
                        <CheckCircle2 size={12} />
                        {t("Pemain Terverifikasi", "Verified Player")}
                      </span>
                    )}
                  </div>
                  <p className="mt-6 flex-1 font-display text-2xl md:text-3xl lg:text-4xl leading-snug">
                    “{story.review}”
                  </p>
                  <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-border/70 pt-5">
                    <div>
                      <p className="text-sm font-semibold">{story.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {story.courtName ? courtShortName(story.courtName) : t("Pemain Klub", "Club Player")}
                        {story.date ? ` · ${story.date}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={t("Ulasan sebelumnya", "Previous review")}
                        onClick={() => setCurrentIndex((prev) => (prev - 1 + activeStories.length) % activeStories.length)}
                        className="flex size-9 items-center justify-center border border-border bg-background transition-colors hover:bg-secondary"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="px-1 text-xs text-muted-foreground tabular-nums">
                        {currentIndex + 1} / {activeStories.length}
                      </span>
                      <button
                        type="button"
                        aria-label={t("Ulasan berikutnya", "Next review")}
                        onClick={() => setCurrentIndex((prev) => (prev + 1) % activeStories.length)}
                        className="flex size-9 items-center justify-center border border-border bg-background transition-colors hover:bg-secondary"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Dot pagination */}
        <div className="mt-7 flex items-center justify-center gap-2" role="tablist" aria-label={t("Indikator ulasan", "Review indicators")}>
          {activeStories.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={idx === currentIndex}
              aria-label={t(`Beralih ke ulasan ${idx + 1}`, `Go to review ${idx + 1}`)}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 transition-all rounded-full ${
                idx === currentIndex ? "w-7 bg-primary" : "w-2 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Link to="/book#reviews" className={outlineButton}>
          {t("Lihat semua ulasan", "See all reviews")} <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  )
}

export function ClubLocation() {
  const { club } = useApp()
  const { t } = useLocale()

  // Real-time WIB status check
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const wibDate = new Date(utc + 3600000 * 7)
  const currentHour = wibDate.getHours()
  const isOpen = currentHour >= (club.openHour ?? 7) && currentHour < (club.closeHour ?? 22)

  const mapsQuery = encodeURIComponent(`${club.name} ${club.address}`)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`
  const mapsEmbedUrl = `https://maps.google.com/maps?q=${mapsQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`

  return (
    <section id="visit" className="mx-auto mt-24 max-w-[1344px] scroll-mt-8 border-t border-border px-6 pt-16 md:px-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center lg:gap-16">
        {/* Left Column: Heading, Info & Directions Action */}
        <div>
          <div className="flex items-center gap-2">
            <p className={`${eyebrow} text-sage`}>05 / Find the club</p>
            <span className="inline-block h-1 w-1 rounded-full bg-sage" />
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{club.area}</span>
          </div>

          <h2 className="mt-5 font-display text-5xl leading-[1.05] tracking-tight md:text-6xl">
            {t("Kita ketemu", "See you")}
            <br />
            <span className="italic">{t("di lapangan.", "on court.")}</span>
          </h2>

          <div className="mt-8 space-y-4 border-l-2 border-primary/40 pl-5">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">{club.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{club.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-foreground/80">
              <Clock3 size={16} className="shrink-0 text-primary" aria-hidden="true" />
              <span>
                {t("Setiap hari", "Daily")} · {clock(club.openHour)}–{clock(club.closeHour)} WIB
              </span>
            </div>
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${outlineButton} mt-8 inline-flex items-center gap-2`}
          >
            {t("Buka petunjuk arah", "Get directions")} <ArrowUpRight size={15} />
          </a>
        </div>

        {/* Right Column: Google Maps Interactive Bento Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-black/5">
          {/* Top Floating Badge Bar */}
          <div className="flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {isOpen && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-amber-500"}`} />
              </span>
              <span className="text-xs font-medium text-foreground">
                {isOpen ? t("Buka Sekarang", "Open Now") : t("Tutup", "Closed")}
              </span>
              <span className="text-[11px] text-muted-foreground">
                · {clock(club.openHour)}–{clock(club.closeHour)} WIB
              </span>
            </div>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>{t("Perbesar Peta", "View larger map")}</span>
              <ArrowUpRight size={12} />
            </a>
          </div>

          {/* Interactive Google Map Iframe */}
          <div className="relative aspect-[16/11] w-full bg-muted/40 sm:aspect-[16/10]">
            <iframe
              title={`Peta Lokasi ${club.name}`}
              src={mapsEmbedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full w-full grayscale-[25%] contrast-[1.05] transition-all duration-500 hover:grayscale-0"
            />
          </div>

          {/* Bottom Bar: Landmark & Transit Note */}
          <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
            <span>📍 Patokan: Kawasan Kemang, Jakarta Selatan</span>
            <span>Akses mobil & motor</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export function VenueGallery({ open, close }: { open: boolean; close: () => void }) {
  const { club } = useApp()
  const { t } = useLocale()
  const [index, setIndex] = useState(0)
  const reducedMotion = useReducedMotion()
  const images = [...new Set([club.heroPhoto, club.photo, ...club.courtOptions.filter((item) => item.active).map((item) => item.photo)])]
  useEffect(() => {
    if (open) setIndex(0)
  }, [open])
  return (
    <Modal open={open} close={close} title={club.name} wide closeLabel={t("Tutup galeri", "Close gallery")}>
      <div className="relative aspect-[1.5] overflow-hidden bg-primary">
        {images.map((image, position) => (
          <motion.img
            key={image}
            src={image}
            alt={position === index ? t(`Suasana klub, foto ${index + 1} dari ${images.length}`, `Club atmosphere, photo ${index + 1} of ${images.length}`) : ""}
            aria-hidden={position !== index}
            initial={false}
            animate={{ opacity: position === index ? 1 : 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.9, ease: "easeInOut" }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ))}
        <div className="absolute right-3 bottom-3 flex items-center gap-1 bg-background">
          <button type="button" aria-label={t("Foto sebelumnya", "Previous photo")} onClick={() => setIndex((index + images.length - 1) % images.length)} className="flex size-11 items-center justify-center">
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs tabular-nums">{index + 1} / {images.length}</span>
          <button type="button" aria-label={t("Foto berikutnya", "Next photo")} onClick={() => setIndex((index + 1) % images.length)} className="flex size-11 items-center justify-center">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="hidden text-xs text-muted-foreground sm:block">{t("Bayangkan rally berikutnya di sini.", "Picture your next rally here.")}</p>
        <Link to="/book" onClick={close} className={`${button} max-sm:w-full`}>
          {t("Booking lapangan", "Book a court")} <ArrowRight size={15} />
        </Link>
      </div>
    </Modal>
  )
}
