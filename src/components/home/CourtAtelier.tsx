import { useEffect, useState } from "react"
import { Link } from "react-router"
import { ArrowRight, ArrowUpRight, Clock3, ShieldCheck, Sun } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import {
  button,
  courtShortName,
  dateLabel,
  endTime,
  eyebrow,
  getCourtAvailability,
  money,
  today,
  useApp,
} from "@/lib/club"
import { CinematicReveal } from "@/components/ui/CinematicMotion"
import { useContent, useLocale } from "@/lib/i18n"
import { CustomSelect } from "@/components/ui/CustomSelect"
import { CustomDatePicker } from "@/components/ui/CustomDatePicker"

export function BookingDock() {
  const { club, date, setDate, busy } = useApp()
  const { t, locale } = useLocale()
  const content = useContent()
  const courts = club.courtOptions.filter((court) => court.active)
  const [choice, setChoice] = useState(courts[0]?.id || 0)
  const selected = courts.find((court) => court.id === choice) || courts[0]
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  const { slots, canSelect } = getCourtAvailability({ club, court: selected?.id || 0, date, duration: 60, busy, now })
  const nextSlot = slots.find((_, index) => canSelect(index))
  const labelClass = "text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground"
  return (
    <div className="relative z-10 mx-5 -mt-9 border border-border bg-background px-5 py-5 shadow-xl shadow-primary/5 md:mx-12 md:-mt-12 md:px-7 lg:mx-auto lg:max-w-[1180px]">
      <div className="grid gap-5 md:grid-cols-[.8fr_1fr_1fr_auto] md:items-center md:gap-7">
        <div className="hidden border-r border-border pr-5 md:block">
          <p className={`${eyebrow} text-clay`}>Make time for play</p>
          <p className="mt-2 font-display text-2xl">{t("Rally berikutnya?", "Next rally?")}</p>
        </div>
        <div className={labelClass}>
          <span className="block mb-1">{t("Lapangan", "Court")}</span>
          <CustomSelect
            value={selected?.id || 0}
            onChange={(val) => setChoice(Number(val))}
            options={
              courts.length
                ? courts.map((court) => ({ value: court.id, label: content.court(court, "name") }))
                : [{ value: 0, label: t("Belum ada lapangan aktif", "No courts open yet") }]
            }
            triggerClassName="!min-h-11 !border-b !border-x-0 !border-t-0 !bg-transparent !px-0 !text-sm !font-normal"
          />
        </div>
        <div className={labelClass}>
          <span className="block mb-1">{t("Tanggal main · WIB", "Date · WIB")}</span>
          <CustomDatePicker
            value={date}
            minDate={today()}
            onChange={(newDate) => newDate >= today() && setDate(newDate)}
            triggerClassName="!min-h-11 !border-b !border-x-0 !border-t-0 !bg-transparent !px-0 !text-sm !font-normal"
          />
        </div>
        {selected ? (
          <Link to={`/book?court=${selected.id}&date=${date}`} className={`${button} bg-forest-deep`}>
            {t("Cek ketersediaan", "Check availability")} <ArrowUpRight size={16} />
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">{t("Lapangan sedang disiapkan.", "Courts coming soon.")}</span>
        )}
      </div>
      {selected && (
        <p role="status" aria-live="polite" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <Clock3 size={14} aria-hidden="true" className="shrink-0" />
          <span>
            {nextSlot
              ? t(
                  `Slot 60 menit berikutnya ${date === today() ? "hari ini" : dateLabel(date, true, "id")} · ${nextSlot}–${endTime(nextSlot, 60)} WIB`,
                  `Next 60-minute slot ${date === today() ? "today" : dateLabel(date, true, locale)} · ${nextSlot}–${endTime(nextSlot, 60)} WIB`,
                )
              : t("Tidak ada slot 60 menit untuk tanggal ini.", "No 60-minute slots left on this date.")}
          </span>
        </p>
      )}
      <ol aria-label={t("Cara booking", "How booking works")} className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <li><span className="mr-2 text-primary">01</span>{t("Pilih lapangan & tanggal", "Pick a court & date")}</li>
        <li><span className="mr-2 text-primary">02</span>{t("Pilih jam & durasi", "Choose time & duration")}</li>
        <li><span className="mr-2 text-primary">03</span>{t("Bayar & simpan konfirmasi", "Pay & keep your confirmation")}</li>
      </ol>
    </div>
  )
}

export default function CourtAtelier() {
  const { club, date } = useApp()
  const { t } = useLocale()
  const content = useContent()
  const courts = club.courtOptions.filter((court) => court.active)
  const [choice, setChoice] = useState(courts[0]?.id || 0)
  const court = courts.find((item) => item.id === choice) || courts[0]
  const reduced = useReducedMotion()
  return (
    <section id="courts" className="scroll-mt-10 bg-forest-deep px-6 py-16 text-background md:px-12 md:py-24 lg:px-16">
      <div className="mx-auto max-w-[1344px]">
        <CinematicReveal>
          <div className="mb-12 flex flex-wrap items-end justify-between gap-7">
            <div>
              <p className={`${eyebrow} text-sage-light`}>02 / The courts</p>
              <h2 className="mt-5 font-display text-5xl leading-[1.02] md:text-7xl">
                {t("Satu klub.", "One club.")}
                <br />
                <em className="text-sage-light">{t("Setiap lapangan, sebuah rasa.", "Every court, its own mood.")}</em>
              </h2>
            </div>
            <p className="max-w-64 text-sm leading-7 text-white/70">
              {t("Cari ruang yang cocok dengan ritmemu. Semua lapangan ada di satu klub.", "Find the space that suits your rhythm. Every court sits in one club.")}
            </p>
          </div>
        </CinematicReveal>
        {court ? (
          <div className="grid gap-9 lg:grid-cols-[.65fr_1.5fr] lg:gap-16">
            <div className="flex flex-col">
              <div role="group" aria-label={t("Pilih lapangan", "Explore the courts")} className="border-t border-white/20">
                {courts.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setChoice(item.id)}
                    aria-pressed={court.id === item.id}
                    className={`group/court flex min-h-22 w-full items-center gap-5 border-b border-white/20 py-5 text-left transition duration-300 ${court.id === item.id ? "text-background" : "text-white/65 hover:text-white/90"}`}
                  >
                    <span className="text-2xs tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                    <span className="flex-1">
                      <span className="block font-display text-3xl">{courtShortName(content.court(item, "name"))}</span>
                      <span className="mt-1 block text-2xs uppercase tracking-eyebrow">
                        {item.type} · {money(item.price)} / {t("jam", "hr")}
                      </span>
                    </span>
                    <ArrowUpRight
                      size={19}
                      aria-hidden="true"
                      className="-translate-x-2 opacity-0 transition duration-300 group-hover/court:translate-x-0 group-hover/court:opacity-100 group-focus-visible/court:translate-x-0 group-focus-visible/court:opacity-100 motion-reduce:transform-none motion-reduce:transition-none"
                    />
                  </button>
                ))}
              </div>
              <p className="mt-8 flex items-start gap-3 text-xs leading-6 text-white/65">
                <ShieldCheck size={18} strokeWidth={1.4} className="shrink-0 text-sage-light" aria-hidden="true" />
                {t("Harga transparan. Pilih tanggal dan durasi sebelum melihat total booking.", "Transparent pricing. Pick a date and duration to see your total.")}
              </p>
              <Link to={`/book?court=${court.id}&date=${date}`} className="mt-7 flex min-h-12 items-center justify-between border-b border-sage-light py-3 text-sm text-sage-light">
                {t("Booking", "Book")} {courtShortName(content.court(court, "name"))}
                <ArrowRight size={17} />
              </Link>
            </div>
            <div>
              <div className="relative aspect-[1.3] overflow-hidden bg-forest-muted md:aspect-[1.65]">
                {courts.map((item) => (
                  <motion.img
                    key={item.id}
                    src={item.photo}
                    alt={item.id === court.id ? `${item.name} · ${club.name}` : ""}
                    aria-hidden={item.id !== court.id}
                    loading="lazy"
                    initial={false}
                    animate={{ opacity: item.id === court.id ? 1 : 0, scale: !reduced && item.id === court.id ? 1.025 : 1 }}
                    transition={{ opacity: { duration: reduced ? 0 : 0.8 }, scale: { duration: reduced ? 0 : 5, ease: "linear" } }}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ))}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-overlay/70 via-transparent to-transparent" />
                <span className="absolute top-5 right-5 flex items-center gap-2 border border-white/50 bg-primary/20 px-3 py-2 text-2xs uppercase tracking-eyebrow backdrop-blur-md">
                  <Sun size={12} aria-hidden="true" />
                  {court.type}
                </span>
                <div className="absolute right-6 bottom-6 left-6 flex items-end justify-between">
                  <span className="font-display text-4xl md:text-5xl">{courtShortName(content.court(court, "name"))}</span>
                  <span className="text-2xs uppercase tracking-eyebrow">
                    {String(courts.findIndex((item) => item.id === court.id) + 1).padStart(2, "0")} / {String(courts.length).padStart(2, "0")}
                  </span>
                </div>
              </div>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/70">{content.court(court, "description")}</p>
            </div>
          </div>
        ) : (
          <p className="py-10 text-sm text-white/70">{t("Lapangan sedang dipersiapkan. Sampai jumpa di rally berikutnya.", "Courts are being prepared. See you at the next rally.")}</p>
        )}
      </div>
    </section>
  )
}
