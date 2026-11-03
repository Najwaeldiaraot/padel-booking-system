import { createContext, useContext } from "react"

export const photos = {
  aerial:
    "https://images.unsplash.com/photo-1689942963385-f5bd03f3b270?auto=format&fit=crop&w=2000&q=85",
  court:
    "https://images.unsplash.com/photo-1709587824751-dd30420f5cf3?auto=format&fit=crop&w=1200&q=85",
  club: "https://images.unsplash.com/photo-1709587824637-2126d83d3216?auto=format&fit=crop&w=1200&q=85",
  night:
    "https://images.unsplash.com/photo-1673266893352-6de89e258064?auto=format&fit=crop&w=1200&q=85",
  player:
    "https://images.unsplash.com/photo-1646649851800-48dba35edc76?auto=format&fit=crop&w=1000&q=85",
}

/* ---------- Domain types (frontend contract, see docs/frontend-backend-contract.md) ---------- */

export type Locale = "id" | "en"
export type CourtType = "Indoor" | "Outdoor"
export type Role = "player" | "staff" | "owner"

export interface Court {
  id: number
  name: string
  type: CourtType
  price: number
  photo: string
  description: string
  active: boolean
  en?: { name?: string; description?: string }
}

export interface Facility {
  id: string
  name: string
  description: string
  active: boolean
  en?: { name?: string; description?: string }
}

export interface BookingPolicy {
  cancellationHours: number
  refundPercent: number
  allowReschedule: boolean
  rescheduleHours: number
  maxReschedules: number
  holdMinutes: number
  arrivalMinutes: number
}

export interface MarketingContent {
  headline: string
  accent: string
  description: string
  promoTitle: string
  promoText: string
  promoEnabled: boolean
}

export type LocalizedMarketing = Partial<Omit<MarketingContent, "promoEnabled">>

export interface ClubConfig {
  id: string
  name: string
  area: string
  address: string
  whatsappNumber: string
  email: string
  tagline: string
  description: string
  photo: string
  heroPhoto: string
  heroVideo?: string
  openHour: number
  closeHour: number
  marketing: MarketingContent
  policy: BookingPolicy
  courtOptions: Court[]
  facilityOptions: Facility[]
  en?: {
    area?: string
    tagline?: string
    description?: string
    marketing?: LocalizedMarketing
  }
}

export interface Venue extends ClubConfig {
  courts: number
  price: number
  type: string
}

export interface User {
  id: string
  name: string
  email?: string
  phone?: string
  role: Role
  isVerified: boolean
  createdAt: string
}

export type BookingStatus =
  | "hold"
  | "pending_payment"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "expired"

export interface BookingEvent {
  type: BookingStatus | "rescheduled" | "reviewed" | "updated"
  at: string
  actor: "player" | "staff" | "owner" | "system"
  note?: string
}

export interface Booking {
  id: string
  venueId: string
  userId?: string
  court: number
  courtName?: string
  courtType?: CourtType
  date: string
  time: string
  duration: number
  total: number
  status: BookingStatus
  source: "online" | "walk-in"
  createdAt: string
  holdExpiresAt?: number
  customerName?: string
  customerContact?: string
  rating?: number
  review?: string
  reviewedAt?: string
  hiddenReview?: boolean
  adminReply?: string
  rescheduleCount: number
  refundAmount?: number
  cancelReason?: string
  history: BookingEvent[]
}

export type PaymentMethod = "qris" | "bca_va" | "mandiri_va" | "gopay" | "ovo" | "cash"
export type PaymentStatus =
  | "pending"
  | "success"
  | "failed"
  | "expired"
  | "refunded"

export interface Payment {
  id: string
  bookingId: string
  gateway: "midtrans" | "manual"
  gatewayRef: string
  method: PaymentMethod
  amount: number
  status: PaymentStatus
  createdAt: string
  expiresAt?: number
  paidAt?: string
  refundedAmount?: number
  instructions?: string
  qrString?: string
  qrImageUrl?: string
}

export type NotificationType =
  | "booking_confirmation"
  | "booking_reminder"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "payment_failed"
  | "venue_new_booking"
  | "venue_booking_cancelled"
  | "venue_booking_rescheduled"

export interface AppNotification {
  id: string
  audience: "player" | "admin"
  userId?: string
  bookingId?: string
  type: NotificationType
  channel: "email" | "whatsapp" | "in_app"
  status: "scheduled" | "sent" | "cancelled"
  createdAt: string
  scheduledFor?: string
  readAt?: string
  meta?: { court?: string; date?: string; time?: string; customer?: string }
}

export interface SlotBlock {
  id: string
  court: number
  date: string
  time: string
  duration: number
  reason: string
}

export interface BusySlot {
  court: number
  date: string
  time: string
  duration: number
  kind: "booking" | "hold" | "block"
  bookingId?: string
}

export interface PublicReview {
  id: string
  name: string
  rating: number
  review?: string
  court: number
  courtName?: string
  date: string
  reply?: string
}

export interface AuditEntry {
  id: string
  message: string
  actor: string
  timestamp: string
}

/* ---------- Defaults ---------- */

export const defaultPolicy: BookingPolicy = {
  cancellationHours: 24,
  refundPercent: 100,
  allowReschedule: true,
  rescheduleHours: 12,
  maxReschedules: 1,
  holdMinutes: 10,
  arrivalMinutes: 15,
}

export const defaultClub: ClubConfig = {
  id: "the-court",
  name: "Rally Padel Club",
  area: "Kemang, Jakarta Selatan",
  address: "Jl. Kemang Raya No. 18, Jakarta Selatan",
  whatsappNumber: "",
  email: "halo@rallypadel.club",
  tagline: "Rumah untuk rally berikutnya.",
  description:
    "Satu klub. Banyak cara menikmati permainan. Lapangan panoramic, sudut kopi, dan ruang untuk bertemu teman—semuanya di rumah padel kami di Kemang.",
  photo: photos.club,
  heroPhoto: photos.aerial,
  heroVideo: "",
  openHour: 7,
  closeHour: 22,
  marketing: {
    headline: "Ada permainan.",
    accent: "Ada tempat untuk pulang.",
    description:
      "Tinggalkan rutinitas di luar lapangan. Temukan permainan yang seru, teman yang baru, dan alasan untuk kembali lagi.",
    promoTitle: "",
    promoText: "",
    promoEnabled: false,
  },
  policy: defaultPolicy,
  courtOptions: [
    {
      id: 1,
      name: "Court 01 · Panoramic",
      type: "Outdoor",
      price: 250000,
      photo: photos.court,
      description:
        "Pandangan luas, udara terbuka. Untuk setiap rally terbaikmu.",
      active: true,
      en: { description: "Wide views, open air. Made for your best rallies." },
    },
    {
      id: 2,
      name: "Court 02 · Garden",
      type: "Outdoor",
      price: 275000,
      photo: photos.club,
      description:
        "Dikelilingi ruang hijau, dekat dengan lounge dan kafe klub.",
      active: true,
      en: {
        description:
          "Wrapped in greenery, a few steps from the lounge and club café.",
      },
    },
    {
      id: 3,
      name: "Court 03 · Covered",
      type: "Indoor",
      price: 300000,
      photo: photos.night,
      description: "Bermain nyaman, siang atau malam, tanpa khawatir cuaca.",
      active: true,
      en: { description: "Play in comfort, day or night, whatever the weather." },
    },
  ],
  facilityOptions: [
    {
      id: "cafe",
      name: "Kafe & lounge",
      description: "Kopi yang baik. Obrolan setelah permainan yang lebih baik.",
      active: true,
      en: {
        name: "Café & lounge",
        description: "Good coffee. Even better conversations after the game.",
      },
    },
    {
      id: "rackets",
      name: "Sewa raket",
      description: "Baru pertama main? Perlengkapan tersedia di klub.",
      active: true,
      en: {
        name: "Racket rental",
        description: "First time playing? Equipment is ready at the club.",
      },
    },
    {
      id: "changing",
      name: "Ruang ganti & shower",
      description: "Segarkan diri, lalu lanjutkan harimu.",
      active: true,
      en: {
        name: "Changing rooms & showers",
        description: "Freshen up, then carry on with your day.",
      },
    },
    {
      id: "parking",
      name: "Area parkir",
      description: "Datang bersama teman, parkir dengan nyaman.",
      active: true,
      en: {
        name: "Parking",
        description: "Arrive with friends and park with ease.",
      },
    },
  ],
  en: {
    area: "Kemang, South Jakarta",
    tagline: "Home for your next rally.",
    description:
      "One club. Many ways to enjoy the game. Panoramic courts, a coffee corner, and room to meet friends—all at our padel home in Kemang.",
    marketing: {
      headline: "There's a game.",
      accent: "There's a place to come home to.",
      description:
        "Leave the routine outside the court. Find great games, new friends, and a reason to come back.",
    },
  },
}

/* ---------- Helpers ---------- */

export const money = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount)

export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

export const dateLabel = (date: string, short = false, locale: Locale = "id") =>
  new Date(`${date}T12:00:00+07:00`).toLocaleDateString(
    locale === "en" ? "en-GB" : "id-ID",
    {
      weekday: short ? "short" : "long",
      day: "numeric",
      month: short ? "short" : "long",
      year: short ? undefined : "numeric",
      timeZone: "Asia/Jakarta",
    },
  )

export const nextDay = (date: string, offset: number) => {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + offset)
  return value.toISOString().slice(0, 10)
}

export const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

export const endTime = (time: string, duration: number) => {
  const total = toMinutes(time) + duration
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/** Hour as a display clock, e.g. 7 → "07:00". */
export const clock = (hour: number) => `${String(hour).padStart(2, "0")}:00`

/** Epoch milliseconds for a WIB date and HH:MM time (supports 24:00). */
export const startsAt = (date: string, time: string) =>
  Date.parse(`${date}T00:00:00+07:00`) + toMinutes(time) * 60000

export const hoursUntil = (date: string, time: string, now = Date.now()) =>
  (startsAt(date, time) - now) / 3600000

export const courtShortName = (name: string) => name.replace(/^Court \d+ · /, "")

export const normalizeWhatsAppNumber = (value: string) =>
  value.replace(/[^\d]/g, "").replace(/^0/, "62")

export const isActiveBooking = (status: BookingStatus) =>
  status === "hold" || status === "pending_payment" || status === "confirmed" || status === "checked_in"

export function getCourtAvailability({
  club,
  court,
  date,
  duration,
  busy,
  now = Date.now(),
  ignoreBookingId,
}: {
  club: ClubConfig
  court: number
  date: string
  duration: number
  busy: BusySlot[]
  now?: number
  ignoreBookingId?: string
}) {
  const slots = Array.from(
    { length: Math.max(0, (club.closeHour - club.openHour) * 2) },
    (_, index) =>
      `${String(club.openHour + Math.floor(index / 2)).padStart(2, "0")}:${
        index % 2 ? "30" : "00"
      }`,
  )
  const isActive = club.courtOptions.some(
    (item) => item.id === court && item.active,
  )
  const available = (slot: string) =>
    startsAt(date, slot) > now &&
    !busy.some(
      (item) =>
        Number(item.court) === Number(court) &&
        item.date === date &&
        (!ignoreBookingId || item.bookingId !== ignoreBookingId) &&
        slot < endTime(item.time, item.duration) &&
        endTime(slot, 30) > item.time,
    )
  const canSelect = (index: number) =>
    isActive &&
    Number.isInteger(index) &&
    index >= 0 &&
    duration >= 30 &&
    duration % 30 === 0 &&
    index + duration / 30 <= slots.length &&
    slots.slice(index, index + duration / 30).every(available)
  return { slots, canSelect }
}

export function ratingSummary(reviews: { rating: number }[]) {
  const count = reviews.length
  const average = count
    ? reviews.reduce((sum, item) => sum + item.rating, 0) / count
    : 0
  return { count, average }
}

export const paymentMethods: { id: Exclude<PaymentMethod, "cash">; label: string; kind: "va" | "ewallet" }[] = [
  { id: "qris", label: "QRIS (BCA, GoPay, ShopeePay, Semua Bank)", kind: "ewallet" },
  { id: "bca_va", label: "BCA Virtual Account", kind: "va" },
  { id: "mandiri_va", label: "Mandiri Virtual Account", kind: "va" },
  { id: "gopay", label: "GoPay", kind: "ewallet" },
  { id: "ovo", label: "OVO", kind: "ewallet" },
]

export const paymentMethodLabel = (method: PaymentMethod) =>
  method === "cash"
    ? "Tunai di klub"
    : paymentMethods.find((item) => item.id === method)?.label || method

export const toVenue = (config: ClubConfig): Venue => {
  const active = config.courtOptions.filter((item) => item.active)
  return {
    ...config,
    courts: active.length,
    price: active.length ? Math.min(...active.map((item) => item.price)) : 0,
    type: [...new Set(active.map((item) => item.type))].join(" & "),
  }
}

/* ---------- App context ---------- */

export interface AppState {
  ready: boolean
  club: Venue
  busy: BusySlot[]
  reviews: PublicReview[]
  user: User | null
  myBookings: Booking[]
  notifications: AppNotification[]
  date: string
  setDate: (date: string) => void
  refresh: () => Promise<void>
  openAuth: (onSuccess?: () => void) => void
  notify: (message: string) => void
}

export const AppContext = createContext<AppState>(null!)
export const useApp = () => useContext(AppContext)

/* ---------- Shared class recipes (built on theme tokens) ---------- */

export const button =
  "inline-flex min-h-12 items-center justify-center gap-3 bg-primary px-6 text-sm font-medium text-primary-foreground transition duration-300 ease-out hover:bg-forest-hover disabled:pointer-events-none disabled:opacity-40"
export const outlineButton =
  "inline-flex min-h-11 items-center justify-center gap-2 border border-border px-5 text-sm font-medium transition duration-300 ease-out hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
export const lightButton =
  "inline-flex min-h-12 items-center justify-center gap-3 bg-background px-7 text-sm font-medium text-primary transition duration-300 ease-out hover:bg-white"
export const ghostLightButton =
  "inline-flex min-h-12 items-center justify-center gap-3 border border-white/40 px-6 text-sm font-medium transition duration-300 ease-out hover:bg-white/10"
export const dangerButton =
  "inline-flex min-h-12 items-center justify-center gap-3 bg-destructive px-6 text-sm font-medium text-white transition duration-300 ease-out hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
export const textLink =
  "inline-flex min-h-11 items-center gap-2 text-xs underline-offset-4 transition hover:underline"
export const field =
  "min-h-12 w-full border border-border bg-card px-4 text-sm focus:border-primary focus:outline-2 focus:outline-ring disabled:opacity-50"
export const eyebrow = "text-2xs font-semibold uppercase tracking-eyebrow"
