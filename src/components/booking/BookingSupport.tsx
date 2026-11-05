import { useId, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowUpRight, ChevronDown, MessageCircle, ShieldCheck } from "lucide-react"
import { cinematicEase } from "@/components/ui/CinematicMotion"
import { eyebrow, normalizeWhatsAppNumber, outlineButton, useApp } from "@/lib/club"
import { policyLines, useContent, useLocale } from "@/lib/i18n"

export function BookingPolicyNotice() {
  const { club } = useApp()
  const { t } = useLocale()
  return (
    <aside aria-label={t("Ketentuan booking", "Booking terms")} className="border border-border bg-white p-5 shadow-xs">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck size={17} aria-hidden="true" />
        {t("Ketentuan booking", "Booking terms")}
      </h3>
      <dl className="mt-4 space-y-4 text-xs leading-6">
        {policyLines(club.policy, t).map((item) => (
          <div key={item.title}>
            <dt className="font-medium">{item.title}</dt>
            <dd className="mt-1 text-muted-foreground">{item.text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        {t(`Datang ${club.policy.arrivalMinutes} menit sebelum jadwal · Waktu dalam WIB.`, `Arrive ${club.policy.arrivalMinutes} minutes early · Times in WIB.`)}
      </p>
    </aside>
  )
}

export function WhatsAppHelp() {
  const { club } = useApp()
  const { t } = useLocale()
  const fallbackNumber = "6281234567890"
  const rawNumber = club?.whatsappNumber?.trim() || fallbackNumber
  const number = normalizeWhatsAppNumber(rawNumber)
  const configured = /^[1-9]\d{7,14}$/.test(number)
  const message = t(
    `Halo ${club?.name || "Rally Padel Club"}, saya ingin bertanya tentang jadwal bermain, perlengkapan, atau ketentuan booking.`,
    `Hi ${club?.name || "Rally Padel Club"}, I have a question about playing times, equipment, or booking terms.`,
  )
  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="text-xs font-medium">{t("Masih ada yang ingin ditanyakan?", "Still have a question?")}</p>
      {configured ? (
        <a href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={`${outlineButton} mt-3`}>
          <MessageCircle size={16} aria-hidden="true" />
          {t("Tanya via WhatsApp", "Ask on WhatsApp")}
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      ) : (
        <details className="mt-3">
          <summary className={`${outlineButton} cursor-pointer list-none`}>
            <MessageCircle size={16} aria-hidden="true" />
            {t("Tanya via WhatsApp", "Ask on WhatsApp")}
            <span className="border border-border px-2 py-1 text-2xs">{t("Pratinjau", "Preview")}</span>
          </summary>
          <div className="mt-3 border border-border bg-background p-4 text-xs leading-6">
            <p className="font-medium">{t("Pratinjau pesan · belum dikirim", "Message preview · not sent")}</p>
            <blockquote className="mt-2 border-l-2 border-primary pl-3 text-muted-foreground">{message}</blockquote>
            <p className="mt-3 text-muted-foreground">
              {t("Nomor WhatsApp klub akan aktif setelah diatur oleh pengelola. Sementara itu, kirim email ke", "The club's WhatsApp number goes live once the team sets it up. Meanwhile, email")}{" "}
              <a href={`mailto:${club?.email}`} className="underline underline-offset-4">{club?.email}</a>.
            </p>
          </div>
        </details>
      )}
    </div>
  )
}

export default function ClubQuestions() {
  const { club } = useApp()
  const { t } = useLocale()
  const content = useContent()
  const [openQuestion, setOpenQuestion] = useState<number | null>(null)
  const faqId = useId()
  const reducedMotion = useReducedMotion()
  const rackets = club.facilityOptions.find((item) => item.id === "rackets" && item.active)
  const policy = club.policy
  const hasOutdoor = club.courtOptions.some((item) => item.active && item.type === "Outdoor")
  const questions = [
    {
      question: t("Perlu membawa raket sendiri?", "Do I need my own racket?"),
      answer: rackets
        ? t(
            `${content.facility(rackets, "name")} tersedia di klub. Konfirmasikan harga dan stok sebelum datang; sewa perlengkapan tidak termasuk total booking lapangan.`,
            `${content.facility(rackets, "name")} is available at the club. Check price and stock before you come; equipment isn't included in the court total.`,
          )
        : t("Tanyakan ketersediaan perlengkapan ke klub sebelum datang.", "Ask the club about equipment before you arrive."),
    },
    {
      question: t("Satu booking untuk berapa pemain?", "How many players per booking?"),
      answer: t(
        `Booking berlaku untuk satu lapangan, bukan per pemain. Padel ganda umumnya dimainkan empat orang. Datang ${policy.arrivalMinutes} menit sebelum jadwal.`,
        `A booking covers one court, not per player. Doubles padel is usually played by four. Arrive ${policy.arrivalMinutes} minutes early.`,
      ),
    },
    {
      question: t("Bisa mengubah atau membatalkan jadwal?", "Can I reschedule or cancel?"),
      answer: policyLines(policy, t)
        .slice(0, 2)
        .map((item) => item.text)
        .join(" ") + " " + t("Semuanya bisa dilakukan sendiri dari Booking saya.", "You can do both yourself from My bookings."),
    },
    {
      question: hasOutdoor ? t("Bagaimana kalau hujan saat main outdoor?", "What if it rains on an outdoor court?") : t("Kapan klub buka?", "When is the club open?"),
      answer: hasOutdoor
        ? t(
            "Hubungi klub untuk penanganan jadwal saat hujan. Ingin bebas cuaca? Pilih lapangan indoor saat booking.",
            "Contact the club about rain arrangements. Want to avoid the weather? Choose an indoor court when booking.",
          )
        : t("Setiap hari sesuai jam operasional yang tertera di bagian lokasi.", "Daily, during the opening hours listed under Visit."),
    },
  ]
  return (
    <section id="faq" aria-labelledby="faq-heading" className="mx-auto mt-20 grid max-w-7xl scroll-mt-8 gap-8 border-t border-border px-6 pt-14 md:grid-cols-2 md:gap-16 md:px-10">
      <div>
        <p className={`${eyebrow} text-sage`}>06 / Before you play</p>
        <h2 id="faq-heading" className="mt-5 font-display text-5xl leading-tight md:text-6xl">
          {t("Pertanyaan singkat.", "Quick questions.")}
          <br />
          <em>{t("Siap untuk main.", "Ready to play.")}</em>
        </h2>
        <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
          {t("Raket, teman main, hingga perubahan jadwal. Hal praktis yang perlu kamu tahu sebelum datang.", "Rackets, playing partners, and schedule changes. The practical bits to know before you come.")}
        </p>
      </div>
      <div className="border-t border-border [overflow-anchor:none]">
        {questions.map((item, index) => {
          const isOpen = openQuestion === index
          const questionId = `${faqId}-question-${index}`
          const answerId = `${faqId}-answer-${index}`
          return (
            <div key={index} className="border-b border-border">
              <h3>
                <button
                  type="button"
                  id={questionId}
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => setOpenQuestion((current) => (current === index ? null : index))}
                  className="flex min-h-16 w-full items-center justify-between gap-5 py-5 text-left text-sm font-medium transition-colors hover:text-muted-foreground"
                >
                  {item.question}
                  <motion.span aria-hidden="true" initial={false} animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.4, ease: cinematicEase }} className="shrink-0">
                    <ChevronDown size={17} />
                  </motion.span>
                </button>
              </h3>
              <motion.div
                id={answerId}
                role="region"
                aria-labelledby={questionId}
                aria-hidden={!isOpen}
                inert={!isOpen}
                initial={false}
                animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ height: { duration: reducedMotion ? 0 : 0.48, ease: cinematicEase }, opacity: { duration: reducedMotion ? 0 : 0.24 } }}
                className="overflow-hidden"
              >
                <motion.p
                  initial={false}
                  animate={{ y: reducedMotion || isOpen ? 0 : -6 }}
                  transition={{ duration: reducedMotion ? 0 : 0.4, ease: cinematicEase }}
                  className="pb-5 text-sm leading-7 text-muted-foreground"
                >
                  {item.answer}
                </motion.p>
              </motion.div>
            </div>
          )
        })}
        <WhatsAppHelp />
      </div>
    </section>
  )
}
