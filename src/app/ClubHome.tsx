import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { ArrowDown, ArrowUpRight, ChevronLeft, ChevronRight, Clock3, MapPin, Pause, Play, Star, Sun } from "lucide-react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"
import { CinematicReveal, cinematicEase } from "./CinematicMotion"
import { clock, eyebrow, lightButton, ratingSummary, useApp } from "./club"
import CourtAtelier, { BookingDock } from "./CourtAtelier"
import ClubQuestions from "./BookingSupport"
import { ClubIntroduction, ClubLocation, ClubPromotion, PlayerStories, VenueGallery } from "./VenueMarketing"
import { useContent, useLocale } from "./i18n"
import { usePageTitle } from "./ui"

export default function ClubHome() {
  const { club, reviews } = useApp()
  const { t } = useLocale()
  const content = useContent()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [slide, setSlide] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [hovered, setHovered] = useState(false)
  const reducedMotion = useReducedMotion()
  const heroRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  usePageTitle("", `${club.name} — ${content.club(club, "tagline")}`)
  const hasVideo = !!club.heroVideo && !videoFailed && !reducedMotion
  useEffect(() => setVideoFailed(false), [club.heroVideo])
  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasVideo) return
    let visible = true
    const update = () => {
      if (playing && visible && !galleryOpen && !document.hidden) video.play().catch(() => setVideoFailed(true))
      else video.pause()
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      update()
    })
    if (heroRef.current) observer.observe(heroRef.current)
    update()
    document.addEventListener("visibilitychange", update)
    return () => {
      video.pause()
      observer.disconnect()
      document.removeEventListener("visibilitychange", update)
    }
  }, [playing, hasVideo, galleryOpen])
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const heroParallax = useTransform(scrollYProgress, [0, 1], [0, 60])
  const activeCourts = club.courtOptions.filter((item) => item.active)
  const rawGallery = [
    club.heroPhoto,
    club.photo,
    ...activeCourts.map((item) => item.photo),
  ].filter((url): url is string => typeof url === "string" && url.trim().length > 0)
  const gallery = (rawGallery.length > 0 ? Array.from(new Set(rawGallery)) : [club.photo || club.heroPhoto || "https://images.unsplash.com/photo-1689942963385-f5bd03f3b270?auto=format&fit=crop&w=2000&q=85"]).slice(0, 3)
  useEffect(() => {
    if (!playing || hasVideo || hovered || galleryOpen || reducedMotion || gallery.length < 2) return
    const timer = setInterval(() => {
      const bounds = heroRef.current?.getBoundingClientRect()
      if (!document.hidden && bounds && bounds.bottom > 0 && bounds.top < window.innerHeight)
        setSlide((previous) => (previous + 1) % gallery.length)
    }, 8500)
    return () => clearInterval(timer)
  }, [playing, hovered, galleryOpen, reducedMotion, gallery.length, hasVideo])
  useEffect(() => setSlide(0), [club.heroPhoto, club.photo, club.courtOptions])
  const summary = ratingSummary(reviews)
  const facilities = club.facilityOptions.filter((item) => item.active)
  const iconButton = "flex size-11 items-center justify-center border border-white/40 transition duration-300 hover:bg-white/15 disabled:opacity-40"
  return (
    <>
      <section
        ref={heroRef}
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false)
        }}
      >
        <div className="relative overflow-hidden bg-primary">
          <motion.div className="absolute inset-x-0 -inset-y-16" style={{ y: reducedMotion ? 0 : heroParallax }}>
            {gallery.map((image, index) => (
              <motion.img
                key={`${image}-${index}`}
                initial={{ opacity: index === slide ? 1 : 0, scale: reducedMotion ? 1 : 1.055 }}
                animate={{ opacity: index === slide ? 1 : 0, scale: reducedMotion ? 1 : index === slide ? 1.005 : 1.055 }}
                transition={{ opacity: { duration: reducedMotion ? 0 : 1.65, ease: "easeInOut" }, scale: { duration: reducedMotion ? 0 : 11, ease: "linear" } }}
                src={image}
                alt={index === slide ? t(`Suasana ${club.name}, klub padel di ${club.area}`, `${club.name}, a padel club in ${content.club(club, "area")}`) : ""}
                aria-hidden={index !== slide}
                className="absolute inset-0 h-full w-full object-cover"
                fetchPriority={index === 0 ? "high" : "low"}
              />
            ))}
          </motion.div>
          {hasVideo && (
            <video
              ref={videoRef}
              src={club.heroVideo}
              poster={club.heroPhoto}
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => setVideoFailed(true)}
              aria-label={t(`Film suasana ${club.name}`, `${club.name} film`)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-overlay/85 via-overlay/45 to-overlay/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-overlay/60 via-transparent to-overlay/10" />
          <div className="relative flex min-h-[740px] flex-col justify-between gap-16 px-6 pt-32 pb-24 text-background md:min-h-[820px] md:px-12 md:pt-36 md:pb-28 lg:min-h-[94svh] lg:px-16">
            <div className="flex justify-between gap-4">
              <span className={`${eyebrow} flex items-center gap-2`}>
                <span className="size-1.5 bg-clay" aria-hidden="true" />A good day starts on court
              </span>
              <span className={`${eyebrow} hidden font-normal sm:block`}>{content.club(club, "area")}</span>
            </div>
            <motion.div
              initial={reducedMotion ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: reducedMotion ? 0 : 1.25, delay: reducedMotion ? 0 : 0.15, ease: cinematicEase }}
              className="mt-8"
            >
              <h1 className="max-w-[1100px] font-display text-[clamp(48px,14vw,66px)] leading-[.94] tracking-[-0.01em] sm:text-[94px] lg:text-[clamp(100px,8.8vw,144px)]">
                <span className="block overflow-hidden pb-1">
                  <motion.span className="block" initial={reducedMotion ? false : { y: "105%" }} animate={{ y: 0 }} transition={{ duration: reducedMotion ? 0 : 1.2, delay: reducedMotion ? 0 : 0.15, ease: cinematicEase }}>
                    {content.marketing(club, "headline")}
                  </motion.span>
                </span>
                <span className="block overflow-hidden pb-3">
                  <motion.span className="block italic text-background/90" initial={reducedMotion ? false : { y: "105%" }} animate={{ y: 0 }} transition={{ duration: reducedMotion ? 0 : 1.35, delay: reducedMotion ? 0 : 0.3, ease: cinematicEase }}>
                    {content.marketing(club, "accent")}
                  </motion.span>
                </span>
              </h1>
              <div className="mt-7 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div>
                  <p className="max-w-sm text-sm leading-6 text-white/85">{content.marketing(club, "description")}</p>
                  <div className="mt-7 flex flex-wrap items-center gap-4">
                    <Link to="/book" className={`${lightButton} group`}>
                      {t("Booking sekarang", "Book now")}
                      <ArrowUpRight size={17} className="transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                    <button type="button" onClick={() => setGalleryOpen(true)} className="inline-flex min-h-12 items-center gap-2 text-xs underline underline-offset-4">
                      <Play size={14} aria-hidden="true" /> {t("Lihat suasana", "See the club")}
                    </button>
                  </div>
                  <a href="#club" className="mt-5 inline-flex min-h-11 items-center gap-2 text-xs text-white/75">
                    {t("Kenali klub kami", "Meet the club")} <ArrowDown size={13} aria-hidden="true" />
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xs tracking-eyebrow tabular-nums">
                    {hasVideo ? "CLUB FILM" : <>{String(slide + 1).padStart(2, "0")}<span className="mx-2 opacity-40">/</span>{String(gallery.length).padStart(2, "0")}</>}
                  </span>
                  {!hasVideo && (
                    <>
                      <button type="button" onClick={() => { setPlaying(false); setSlide((previous) => (previous + gallery.length - 1) % gallery.length) }} aria-label={t("Foto klub sebelumnya", "Previous club photo")} className={iconButton}>
                        <ChevronLeft size={16} />
                      </button>
                      <button type="button" onClick={() => { setPlaying(false); setSlide((previous) => (previous + 1) % gallery.length) }} aria-label={t("Foto klub berikutnya", "Next club photo")} className={iconButton}>
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setPlaying(!playing)}
                    disabled={!!reducedMotion}
                    aria-label={reducedMotion ? t("Slideshow otomatis dinonaktifkan", "Autoplay disabled") : playing ? t("Jeda", "Pause") : t("Putar", "Play")}
                    aria-pressed={playing && !reducedMotion}
                    className={iconButton}
                  >
                    {playing && !reducedMotion ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      <BookingDock />
      <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-center gap-x-10 gap-y-4 border-b border-border px-6 py-7 text-xs text-muted-foreground md:justify-between md:px-10">
        <span className="flex items-center gap-2"><MapPin size={15} aria-hidden="true" />{content.club(club, "area")}</span>
        <span className="flex items-center gap-2"><Sun size={15} aria-hidden="true" />{t(`${activeCourts.length} lapangan di satu klub`, `${activeCourts.length} courts, one club`)}</span>
        <span className="flex items-center gap-2"><Clock3 size={15} aria-hidden="true" />{clock(club.openHour)}–{clock(club.closeHour)} WIB</span>
        {summary.count > 0 && (
          <span className="flex items-center gap-2">
            <Star size={13} className="fill-rating text-rating" aria-hidden="true" />
            {summary.average.toFixed(1)} · {summary.count} {t("penilaian pemain", "player ratings")}
          </span>
        )}
      </div>
      <CinematicReveal>
        <ClubIntroduction />
      </CinematicReveal>
      <CourtAtelier />
      <CinematicReveal>
        <section id="facilities" className="mx-auto mt-20 grid max-w-[1344px] scroll-mt-8 gap-10 border-t border-border px-6 pt-14 md:mt-24 md:grid-cols-2 md:gap-20 md:px-10">
          <div className="relative min-h-96 overflow-hidden md:min-h-[520px]">
            <img src={club.photo} alt={t(`Suasana dan fasilitas ${club.name}`, `Facilities at ${club.name}`)} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/50 to-transparent" />
          </div>
          <div className="py-3">
            <p className={`${eyebrow} text-sage`}>03 / Life at the club</p>
            <h2 className="mt-5 font-display text-5xl leading-[1.08] md:text-6xl">
              {t("Sebelum rally.", "Before the rally.")}
              <br />
              <span className="italic">{t("Setelah rally.", "After the rally.")}</span>
            </h2>
            <div className="mt-8">
              {facilities.map((item, index) => (
                <div key={item.id} className="flex gap-5 border-t border-border py-5">
                  <span className="pt-1 font-display text-2xl text-sage italic">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-sm font-semibold">{content.facility(item, "name")}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{content.facility(item, "description")}</p>
                  </div>
                </div>
              ))}
            </div>
            {!facilities.length && <p className="mt-8 text-sm text-muted-foreground">{t("Informasi fasilitas akan segera hadir.", "Facility details are coming soon.")}</p>}
          </div>
        </section>
      </CinematicReveal>
      <CinematicReveal>
        <PlayerStories />
      </CinematicReveal>
      <CinematicReveal>
        <ClubPromotion />
      </CinematicReveal>
      <CinematicReveal>
        <ClubLocation />
      </CinematicReveal>
      <CinematicReveal>
        <ClubQuestions />
      </CinematicReveal>
      <section className="mx-3 mt-16 flex flex-col items-center gap-6 bg-primary px-6 py-14 text-center text-background md:mx-6 md:py-20 lg:mx-8">
        <span className={`${eyebrow} text-sage-light`}>{club.name}</span>
        <h2 className="font-display text-5xl leading-[1.04] md:text-7xl">
          {t("Lapangan kami.", "Our courts.")}
          <br />
          <span className="italic">{t("Cerita berikutnya, milikmu.", "Your next story.")}</span>
        </h2>
        <Link to="/book" className={`${lightButton} mt-2`}>
          {t("Booking sekarang", "Book now")} <ArrowUpRight size={17} />
        </Link>
      </section>
      <VenueGallery open={galleryOpen} close={() => setGalleryOpen(false)} />
    </>
  )
}
