import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Link } from "react-router"
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Clock3, MapPin, Star } from "lucide-react"
import { button, clock, courtShortName, eyebrow, outlineButton, ratingSummary, useApp } from "@/lib/club"
import { WhatsAppHelp } from "@/components/booking/BookingSupport"
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

export function PlayerStories() {
  const { reviews } = useApp()
  const { t } = useLocale()
  const summary = ratingSummary(reviews)
  const stories = reviews.filter((item) => item.review).slice(0, 3)
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
      {stories.length ? (
        <div className="mt-9 grid gap-8 md:grid-cols-3">
          {stories.map((story) => (
            <article key={story.id} className="flex flex-col border-t border-border py-6">
              <span className="font-display text-5xl leading-none text-sage" aria-hidden="true">“</span>
              <p className="mt-2 flex-1 font-display text-3xl leading-tight">{story.review}</p>
              <div className="mt-7 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">{story.name}</p>
                  <p className="mt-1 text-2xs text-muted-foreground">{story.courtName ? courtShortName(story.courtName) : ""}</p>
                </div>
                <span className="flex gap-1" aria-label={`${story.rating} / 5`}>
                  {Array.from({ length: story.rating }, (_, position) => (
                    <Star size={10} key={position} aria-hidden="true" className="fill-rating text-rating" />
                  ))}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-9 text-sm text-muted-foreground">
          {t("Cerita pemain akan muncul di sini setelah permainan pertama.", "Player stories will appear here after the first games.")}
        </p>
      )}
      {reviews.length > 0 && (
        <Link to="/book#reviews" className={`${outlineButton} mt-4`}>
          {t("Lihat semua ulasan", "See all reviews")} <ArrowRight size={15} />
        </Link>
      )}
    </section>
  )
}

export function ClubLocation() {
  const { club } = useApp()
  const { t } = useLocale()
  return (
    <section id="visit" className="mx-auto mt-20 grid max-w-[1344px] scroll-mt-8 gap-8 border-t border-border px-6 pt-14 md:grid-cols-[1fr_1.1fr] md:items-center md:gap-20 md:px-10">
      <div>
        <p className={`${eyebrow} text-sage`}>05 / Find the club</p>
        <h2 className="mt-5 font-display text-5xl leading-[1.05] md:text-6xl">
          {t("Kita ketemu", "See you")}
          <br />
          <span className="italic">{t("di lapangan.", "on court.")}</span>
        </h2>
      </div>
      <div className="border-l border-border pl-6 md:pl-10">
        <div className="flex max-w-sm gap-3">
          <MapPin size={19} className="mt-1 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-medium">{club.name}</h3>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">{club.address}</p>
          </div>
        </div>
        <p className="mt-5 flex items-center gap-3 text-xs">
          <Clock3 size={17} aria-hidden="true" />
          {t("Setiap hari", "Daily")} · {clock(club.openHour)}–{clock(club.closeHour)} WIB
        </p>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${club.name} ${club.address}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${outlineButton} mt-7`}
        >
          {t("Buka petunjuk arah", "Get directions")} <ArrowUpRight size={15} />
        </a>
        <WhatsAppHelp />
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
