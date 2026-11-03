import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type {
  AppNotification,
  BookingPolicy,
  BookingStatus,
  ClubConfig,
  Court,
  Facility,
  Locale,
  MarketingContent,
  PaymentStatus,
} from "./club"
import { ApiError } from "./api"

const STORAGE_KEY = "rally-locale"

const LocaleContext = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
}>({ locale: "id", setLocale: () => {} })

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "id"
    } catch {
      return "id"
    }
  })
  useEffect(() => {
    document.documentElement.lang = locale
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {}
  }, [locale])
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

/** `t("Indonesian", "English")` keeps both languages next to each other. */
export function useLocale() {
  const { locale, setLocale } = useContext(LocaleContext)
  const t = (id: string, en: string) => (locale === "en" ? en : id)
  return { locale, setLocale, t }
}

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  return (
    <div
      role="group"
      aria-label="Bahasa / Language"
      className={`flex items-center text-2xs font-semibold tracking-eyebrow ${className}`}
    >
      {(["id", "en"] as const).map((item, index) => (
        <span key={item} className="flex items-center">
          {index > 0 && <span className="opacity-40" aria-hidden="true">/</span>}
          <button
            type="button"
            lang={item}
            aria-pressed={locale === item}
            onClick={() => setLocale(item)}
            className={`min-h-11 min-w-9 px-1.5 uppercase transition ${
              locale === item ? "opacity-100" : "opacity-50 hover:opacity-80"
            }`}
          >
            {item}
          </button>
        </span>
      ))}
    </div>
  )
}

/** Picks English club content when available, otherwise falls back to Indonesian. */
export function useContent() {
  const { locale } = useLocale()
  const en = locale === "en"
  return {
    club: <Key extends "area" | "tagline" | "description">(
      club: ClubConfig,
      key: Key,
    ) => (en && club.en?.[key]?.trim() ? club.en[key]! : club[key]),
    marketing: <Key extends Exclude<keyof MarketingContent, "promoEnabled">>(
      club: ClubConfig,
      key: Key,
    ) =>
      en && club.en?.marketing?.[key]?.trim()
        ? club.en.marketing[key]!
        : club.marketing[key],
    court: (court: Court, key: "name" | "description") =>
      en && court.en?.[key]?.trim() ? court.en[key]! : court[key],
    facility: (facility: Facility, key: "name" | "description") =>
      en && facility.en?.[key]?.trim() ? facility.en[key]! : facility[key],
  }
}

export function bookingStatusLabel(status: BookingStatus, t: (id: string, en: string) => string) {
  return {
    hold: t("Menunggu checkout", "Awaiting checkout"),
    pending_payment: t("Menunggu pembayaran", "Awaiting payment"),
    confirmed: t("Terkonfirmasi", "Confirmed"),
    checked_in: t("Sedang Bermain", "Playing"),
    completed: t("Selesai", "Completed"),
    cancelled: t("Dibatalkan", "Cancelled"),
    expired: t("Kedaluwarsa", "Expired"),
  }[status]
}

export function paymentStatusLabel(status: PaymentStatus, t: (id: string, en: string) => string) {
  return {
    pending: t("Menunggu", "Pending"),
    success: t("Berhasil", "Paid"),
    failed: t("Gagal", "Failed"),
    expired: t("Kedaluwarsa", "Expired"),
    refunded: t("Dikembalikan", "Refunded"),
  }[status]
}

export function policyLines(policy: BookingPolicy, t: (id: string, en: string) => string) {
  return [
    {
      title: t("Pembatalan", "Cancellation"),
      text:
        t(
          `Batalkan sendiri hingga ${policy.cancellationHours} jam sebelum jadwal. `,
          `Cancel yourself up to ${policy.cancellationHours} hours before your slot. `,
        ) +
        (policy.refundPercent > 0
          ? t(
              `Pembayaran dikembalikan ${policy.refundPercent}%.`,
              `${policy.refundPercent}% of the payment is refunded.`,
            )
          : t("Tanpa pengembalian dana.", "No refund is issued.")),
    },
    {
      title: t("Ubah jadwal", "Rescheduling"),
      text: policy.allowReschedule
        ? t(
            `Pindahkan jadwal sendiri hingga ${policy.rescheduleHours} jam sebelum main, maksimal ${policy.maxReschedules}× per booking, tanpa menunggu persetujuan. Lapangan dan durasi tetap sama.`,
            `Move your slot yourself up to ${policy.rescheduleHours} hours before play, up to ${policy.maxReschedules}× per booking, with no approval needed. Court and duration stay the same.`,
          )
        : t(
            "Perubahan jadwal dilakukan melalui klub.",
            "Schedule changes are handled by the club.",
          ),
    },
    {
      title: t("Harga & perlengkapan", "Price & equipment"),
      text: t(
        "Total checkout mencakup sewa lapangan. Sewa raket dan fasilitas berbayar dikonfirmasi langsung dengan klub.",
        "The checkout total covers the court. Racket rental and paid facilities are arranged directly with the club.",
      ),
    },
    {
      title: t("Pembayaran", "Payment"),
      text: t(
        `Slot ditahan ${policy.holdMinutes} menit selama checkout. Pembayaran pada pratinjau ini masih simulasi—tidak ada dana yang ditagih.`,
        `Your slot is held for ${policy.holdMinutes} minutes during checkout. Payments in this preview are simulated—no money is charged.`,
      ),
    },
  ]
}

export function notificationText(
  item: AppNotification,
  t: (id: string, en: string) => string,
) {
  const where = [item.meta?.court, item.meta?.date, item.meta?.time]
    .filter(Boolean)
    .join(" · ")
  const who = item.meta?.customer || t("Pemain", "A player")
  const copy: Record<AppNotification["type"], [string, string]> = {
    booking_confirmation: [
      t("Booking terkonfirmasi", "Booking confirmed"),
      t(`Konfirmasi dikirim ke email · ${where}`, `Confirmation sent by email · ${where}`),
    ],
    booking_reminder: [
      t("Pengingat jadwal main", "Game reminder"),
      item.status === "scheduled"
        ? t(`Dikirim H-1 · ${where}`, `Sends one day before · ${where}`)
        : t(`Besok kamu main · ${where}`, `You're playing tomorrow · ${where}`),
    ],
    booking_cancelled: [
      t("Booking dibatalkan", "Booking cancelled"),
      where,
    ],
    booking_rescheduled: [
      t("Jadwal dipindahkan", "Booking rescheduled"),
      where,
    ],
    payment_failed: [
      t("Pembayaran belum berhasil", "Payment unsuccessful"),
      t(`Coba lagi sebelum waktu checkout habis · ${where}`, `Try again before checkout expires · ${where}`),
    ],
    venue_new_booking: ["Booking baru", `${who} · ${where}`],
    venue_booking_cancelled: ["Booking dibatalkan", `${who} · ${where}`],
    venue_booking_rescheduled: ["Jadwal dipindahkan pemain", `${who} · ${where}`],
  }
  return { title: copy[item.type][0], body: copy[item.type][1] }
}

export function errorMessage(error: unknown, t: (id: string, en: string) => string) {
  if (!(error instanceof ApiError))
    return t("Terjadi kendala. Coba lagi.", "Something went wrong. Please try again.")
  const meta = error.meta || {}
  switch (error.code) {
    case "duplicate":
      return t("Email atau nomor ini sudah terdaftar. Silakan masuk.", "This email or number is already registered. Please sign in.")
    case "otp_invalid":
      return t(`Kode belum tepat. Sisa ${meta.remaining} percobaan.`, `Incorrect code. ${meta.remaining} attempts left.`)
    case "otp_expired":
      return t("Kode sudah kedaluwarsa. Kirim ulang kode baru.", "This code has expired. Send a new one.")
    case "otp_attempts":
      return t("Terlalu banyak percobaan. Kirim ulang kode baru.", "Too many attempts. Send a new code.")
    case "otp_cooldown":
      return t(`Tunggu ${meta.seconds} detik sebelum mengirim ulang.`, `Wait ${meta.seconds} seconds before resending.`)
    case "invalid_credentials":
      return t(`Email/nomor atau kata sandi belum tepat. Sisa ${meta.remaining} percobaan.`, `Incorrect email/number or password. ${meta.remaining} attempts left.`)
    case "locked":
      return t(`Terlalu banyak percobaan. Coba lagi dalam ${meta.minutes} menit.`, `Too many attempts. Try again in ${meta.minutes} minutes.`)
    case "slot_unavailable":
      return t("Slot ini baru saja tidak tersedia. Pilih waktu lain.", "This slot was just taken. Choose another time.")
    case "hold_expired":
      return t("Waktu checkout sudah habis. Pilih jadwal lagi.", "Checkout time has run out. Choose a slot again.")
    case "policy":
      return t("Tindakan ini sudah melewati batas waktu kebijakan klub.", "This action is outside the club's policy window.")
    case "unauthorized":
      return t("Masuk terlebih dahulu untuk melanjutkan.", "Sign in to continue.")
    case "not_found":
      return t("Data tidak ditemukan.", "We couldn't find that.")
    default:
      return error.message
  }
}
