/**
 * Local API adapter.
 *
 * Every function mirrors an endpoint in docs/frontend-backend-contract.md and
 * resolves asynchronously, so swapping this file for real `fetch` calls does
 * not require UI changes. State persists in localStorage for the prototype.
 */
import {
  defaultClub,
  defaultPolicy,
  endTime,
  hoursUntil,
  isActiveBooking,
  nextDay,
  normalizeWhatsAppNumber,
  startsAt,
  today,
  type AppNotification,
  type AuditEntry,
  type Booking,
  type BookingEvent,
  type BusySlot,
  type ClubConfig,
  type Payment,
  type PaymentMethod,
  type PublicReview,
  type Role,
  type SlotBlock,
  type User,
} from "./club"

export type ApiErrorCode =
  | "invalid_input"
  | "duplicate"
  | "otp_invalid"
  | "otp_expired"
  | "otp_attempts"
  | "otp_cooldown"
  | "invalid_credentials"
  | "locked"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "slot_unavailable"
  | "policy"
  | "hold_expired"

export class ApiError extends Error {
  code: ApiErrorCode
  meta?: Record<string, number | string>
  constructor(code: ApiErrorCode, message: string, meta?: Record<string, number | string>) {
    super(message)
    this.code = code
    this.meta = meta
  }
}

export type SessionScope = "player" | "staff"

export interface OtpChallenge {
  challengeId: string
  destination: string
  expiresAt: number
  resendAt: number
  /** Local inbox preview; a real backend sends this by email/SMS instead. */
  preview: string
}

interface Credential {
  userId: string
  hash: string
}
interface PendingRegistration {
  id: string
  name: string
  email?: string
  phone?: string
  hash: string
  code: string
  expiresAt: number
  resendAt: number
  attempts: number
}
interface Db {
  version: 2
  club: ClubConfig
  users: User[]
  credentials: Credential[]
  bookings: Booking[]
  payments: Payment[]
  blocks: SlotBlock[]
  notifications: AppNotification[]
  audit: AuditEntry[]
  pending: PendingRegistration[]
  guards: Record<string, { failures: number; lockedUntil?: number }>
}

const DB_KEY = "rally-db-v2"
const SESSION_KEYS: Record<SessionScope, string> = {
  player: "rally-session-player",
  staff: "rally-session-staff",
}
const OTP_TTL = 5 * 60000
const OTP_COOLDOWN = 60000
const OTP_ATTEMPTS = 5
const LOGIN_ATTEMPTS = 5
const LOCK_DURATION = 15 * 60000

export const previewAccounts = [
  { role: "owner" as Role, label: "Pemilik", email: "pemilik@rallypadel.club", password: "RallyOwner1" },
  { role: "staff" as Role, label: "Staf", email: "staf@rallypadel.club", password: "RallyStaff1" },
  { role: "player" as Role, label: "Pemain", email: "pemain@rallypadel.club", password: "RallyPlayer1" },
]

/* ---------- Infrastructure ---------- */

let cache: Db | null = null
const listeners = new Set<() => void>()

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key === DB_KEY || event.key?.startsWith("rally-session")) {
      cache = null
      listeners.forEach((listener) => listener())
    }
  })

const wait = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms))
const iso = () => new Date().toISOString()
const uid = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`
const bookingCode = () =>
  `RLY-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[value % 32],
  ).join("")}`

function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache))
  } catch {}
}
function commit() {
  persist()
  queueMicrotask(() => listeners.forEach((listener) => listener()))
}

async function hashSecret(secret: string, salt: string) {
  const input = new TextEncoder().encode(`${salt.toLowerCase()}::${secret}`)
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", input)
    return [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
  }
  let value = 0
  for (const byte of input) value = (value * 31 + byte) >>> 0
  return value.toString(16)
}

function parseIdentifier(raw: string) {
  const value = raw.trim().toLowerCase()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return { email: value, key: value }
  const digits = normalizeWhatsAppNumber(value)
  if (/^\+?[\d\s()-]+$/.test(value) && /^[1-9]\d{9,14}$/.test(digits))
    return { phone: digits, key: digits }
  throw new ApiError("invalid_input", "Masukkan email atau nomor HP yang valid.", { field: "identifier" })
}

const maskDestination = (email?: string, phone?: string) =>
  email
    ? email.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => `${first}${"•".repeat(Math.min(6, middle.length))}${domain}`)
    : `+${phone?.slice(0, 4)}••••${phone?.slice(-3)}`

const event = (type: BookingEvent["type"], actor: BookingEvent["actor"], note?: string): BookingEvent => ({
  type,
  actor,
  at: iso(),
  ...(note ? { note } : {}),
})

function notification(
  d: Db,
  input: Omit<AppNotification, "id" | "createdAt" | "status" | "meta"> & {
    status?: AppNotification["status"]
    booking?: Booking
  },
) {
  const { booking, ...rest } = input
  const item: AppNotification = {
    id: uid("ntf"),
    createdAt: iso(),
    status: "sent",
    ...rest,
    ...(booking
      ? {
          bookingId: booking.id,
          meta: {
            court: booking.courtName,
            date: booking.date,
            time: `${booking.time}–${endTime(booking.time, booking.duration)}`,
            customer: booking.customerName,
          },
        }
      : {}),
  }
  d.notifications.unshift(item)
  return item
}

function audit(d: Db, actor: User, message: string) {
  d.audit.unshift({ id: uid("log"), actor: actor.name, message, timestamp: iso() })
  d.audit = d.audit.slice(0, 200)
}

/** Background jobs a backend would run on a schedule (expire holds, complete games, send reminders). */
function sweep(d: Db) {
  const now = Date.now()
  let changed = false
  for (const booking of d.bookings) {
    if ((booking.status === "hold" || booking.status === "pending_payment") && (booking.holdExpiresAt || 0) <= now) {
      booking.status = "expired"
      booking.history.push(event("expired", "system", "Waktu checkout habis"))
      d.payments
        .filter((payment) => payment.bookingId === booking.id && payment.status === "pending")
        .forEach((payment) => (payment.status = "expired"))
      changed = true
    } else if ((booking.status === "confirmed" || booking.status === "checked_in") && startsAt(booking.date, endTime(booking.time, booking.duration)) <= now) {
      booking.status = "completed"
      booking.history.push(event("completed", "system", "Jadwal bermain selesai"))
      changed = true
    }
  }
  for (const item of d.notifications) {
    if (item.status === "scheduled" && item.scheduledFor && Date.parse(item.scheduledFor) <= now) {
      const booking = d.bookings.find((entry) => entry.id === item.bookingId)
      item.status = booking && (booking.status === "confirmed" || booking.status === "completed") ? "sent" : "cancelled"
      changed = true
    }
  }
  if (changed) persist()
}

function overlaps(
  a: { court: number; date: string; time: string; duration: number },
  b: { court: number; date: string; time: string; duration: number },
) {
  return a.court === b.court && a.date === b.date && a.time < endTime(b.time, b.duration) && endTime(a.time, a.duration) > b.time
}

function assertSlot(
  d: Db,
  slot: { court: number; date: string; time: string; duration: number },
  ignoreId?: string,
) {
  const court = d.club.courtOptions.find((item) => item.id === slot.court && item.active)
  const opening = `${String(d.club.openHour).padStart(2, "0")}:00`
  const closing = `${String(d.club.closeHour).padStart(2, "0")}:00`
  if (
    !court ||
    !/^\d{4}-\d{2}-\d{2}$/.test(slot.date) ||
    !/^\d{2}:(00|30)$/.test(slot.time) ||
    slot.duration < 30 ||
    slot.duration % 30 !== 0 ||
    slot.time < opening ||
    endTime(slot.time, slot.duration) > closing
  )
    throw new ApiError("invalid_input", "Pilih lapangan aktif dalam jam operasional dengan interval 30 menit.")
  if (startsAt(slot.date, slot.time) <= Date.now())
    throw new ApiError("invalid_input", "Jadwal harus berada di masa mendatang (WIB).")
  const taken =
    d.bookings.some((item) => item.id !== ignoreId && isActiveBooking(item.status) && overlaps(item, slot)) ||
    d.blocks.some((item) => overlaps(item, slot))
  if (taken) throw new ApiError("slot_unavailable", "Slot berbenturan dengan booking atau blokir lain.")
  return court
}

function sessionUser(d: Db, scope: SessionScope) {
  try {
    const id = JSON.parse(localStorage.getItem(SESSION_KEYS[scope]) || "null")
    return d.users.find((user) => user.id === id) || null
  } catch {
    return null
  }
}

function requirePlayer(d: Db) {
  const user = sessionUser(d, "player")
  if (!user) throw new ApiError("unauthorized", "Masuk terlebih dahulu.")
  return user
}

function requireStaff(d: Db, roles: Role[] = ["staff", "owner"]) {
  const user = sessionUser(d, "staff")
  if (!user) throw new ApiError("unauthorized", "Masuk sebagai staf klub.")
  if (!roles.includes(user.role)) throw new ApiError("forbidden", "Akses ini khusus pemilik klub.")
  return user
}

function ownBooking(d: Db, id: string) {
  const user = requirePlayer(d)
  const booking = d.bookings.find((item) => item.id === id && item.userId === user.id)
  if (!booking) throw new ApiError("not_found", "Booking tidak ditemukan.")
  return { user, booking }
}

function scheduleReminder(d: Db, booking: Booking) {
  d.notifications
    .filter((item) => item.bookingId === booking.id && item.type === "booking_reminder" && item.status === "scheduled")
    .forEach((item) => (item.status = "cancelled"))
  if (!booking.userId) return
  const at = Math.max(Date.now(), startsAt(booking.date, booking.time) - 24 * 3600000)
  notification(d, {
    audience: "player",
    userId: booking.userId,
    type: "booking_reminder",
    channel: "email",
    status: at > Date.now() ? "scheduled" : "sent",
    scheduledFor: new Date(at).toISOString(),
    booking,
  })
}

function refundFor(d: Db, booking: Booking, percent: number) {
  const payment = d.payments.find((item) => item.bookingId === booking.id && item.status === "success")
  if (!payment || percent <= 0) return 0
  const amount = Math.round((payment.amount * percent) / 100)
  payment.status = "refunded"
  payment.refundedAmount = amount
  return amount
}

/* ---------- Seed & migration ---------- */

function readLegacyClub(): ClubConfig {
  try {
    const legacy = JSON.parse(localStorage.getItem("rally-club-config-v1") || "null")
    if (legacy && typeof legacy === "object") {
      const { rating: _rating, reviews: _reviews, ...rest } = legacy
      return {
        ...structuredClone(defaultClub),
        ...rest,
        marketing: { ...defaultClub.marketing, ...rest.marketing },
        policy: { ...defaultPolicy, ...rest.policy },
        en: { ...defaultClub.en, ...rest.en },
        courtOptions: (rest.courtOptions || defaultClub.courtOptions).map((court: ClubConfig["courtOptions"][number]) => ({
          ...court,
          en: court.en || defaultClub.courtOptions.find((item) => item.id === court.id)?.en,
        })),
        facilityOptions: (rest.facilityOptions || defaultClub.facilityOptions).map((facility: ClubConfig["facilityOptions"][number]) => ({
          ...facility,
          en: facility.en || defaultClub.facilityOptions.find((item) => item.id === facility.id)?.en,
        })),
      }
    }
  } catch {}
  return structuredClone(defaultClub)
}

async function createDb(): Promise<Db> {
  const club = readLegacyClub()
  const stamp = iso()
  const users: User[] = [
    { id: "usr-owner", name: "Rafki Pratama", email: previewAccounts[0].email, role: "owner", isVerified: true, createdAt: stamp },
    { id: "usr-staff", name: "Dewi Anggraini", email: previewAccounts[1].email, role: "staff", isVerified: true, createdAt: stamp },
    { id: "usr-player", name: "Nadia Putri", email: previewAccounts[2].email, phone: "6281234567890", role: "player", isVerified: true, createdAt: stamp },
  ]
  const credentials = await Promise.all(
    users.map(async (user, index) => ({
      userId: user.id,
      hash: await hashSecret(previewAccounts[index].password, user.email!),
    })),
  )
  const court = (id: number) => club.courtOptions.find((item) => item.id === id) || club.courtOptions[0]
  const day = (offset: number) => nextDay(today(), offset)
  const make = (
    input: Partial<Booking> & { court: number; date: string; time: string; duration: number },
  ): Booking => {
    const chosen = court(input.court)
    return {
      id: bookingCode(),
      venueId: club.id,
      courtName: chosen.name,
      courtType: chosen.type,
      total: (chosen.price * input.duration) / 60,
      status: "confirmed",
      source: "online",
      createdAt: stamp,
      rescheduleCount: 0,
      history: [event("confirmed", "system")],
      ...input,
      court: chosen.id,
    }
  }
  const bookings: Booking[] = [
    make({ userId: "usr-player", customerName: "Nadia Putri", customerContact: users[2].email, court: 2, date: day(3), time: "18:00", duration: 90 }),
    make({ userId: "usr-player", customerName: "Nadia Putri", customerContact: users[2].email, court: 3, date: day(-2), time: "08:00", duration: 60, status: "completed" }),
    make({ userId: "usr-player", customerName: "Nadia Putri", customerContact: users[2].email, court: 1, date: day(-6), time: "19:00", duration: 60, status: "completed", rating: 5, review: "Lapangannya terawat dan suasananya bikin betah. Pasti kembali minggu depan.", reviewedAt: stamp, adminReply: "Terima kasih, Nadia! Sampai jumpa di rally berikutnya." }),
    make({ customerName: "Adrian Wijaya", customerContact: "adrian@contoh.id", court: 1, date: day(0), time: "19:00", duration: 60 }),
    make({ customerName: "Sarah Tan", customerContact: "6281300001111", court: 3, date: day(0), time: "20:00", duration: 60, source: "walk-in" }),
    make({ customerName: "Maya Lestari", customerContact: "maya@contoh.id", court: 3, date: day(2), time: "07:00", duration: 60 }),
    make({ customerName: "Bima Santoso", customerContact: "bima@contoh.id", court: 1, date: day(1), time: "09:00", duration: 60, status: "cancelled", cancelReason: "Dibatalkan pemain" }),
    make({ customerName: "Dimas Pratama", court: 2, date: day(-4), time: "18:00", duration: 60, status: "completed", rating: 5, review: "Datang untuk main satu jam, pulangnya sudah janjian untuk minggu depan.", reviewedAt: stamp }),
    make({ customerName: "Clara Amanda", court: 1, date: day(-9), time: "07:00", duration: 60, status: "completed", rating: 4, review: "Pagi yang menyenangkan. Akan lebih baik kalau pilihan minuman di kafe ditambah.", reviewedAt: stamp }),
    make({ customerName: "Raka Pradana", court: 3, date: day(-1), time: "20:00", duration: 90, status: "completed", rating: 5, review: "Lapangan indoor-nya nyaman, tetap bisa main walau hujan.", reviewedAt: stamp }),
  ]
  const payments: Payment[] = bookings.map((booking) => ({
    id: uid("pay"),
    bookingId: booking.id,
    gateway: booking.source === "walk-in" ? "manual" : "midtrans",
    gatewayRef: booking.source === "walk-in" ? "KASIR" : `MT-${booking.id.slice(4)}`,
    method: booking.source === "walk-in" ? "cash" : booking.court === 2 ? "gopay" : "bca_va",
    amount: booking.total,
    status: booking.status === "cancelled" ? "refunded" : "success",
    refundedAmount: booking.status === "cancelled" ? booking.total : undefined,
    createdAt: stamp,
    paidAt: stamp,
  }))
  payments.push({
    id: uid("pay"),
    bookingId: bookings[5].id,
    gateway: "midtrans",
    gatewayRef: `MT-${bookings[5].id.slice(4)}-1`,
    method: "ovo",
    amount: bookings[5].total,
    status: "failed",
    createdAt: stamp,
  })
  const d: Db = {
    version: 2,
    club,
    users,
    credentials,
    bookings,
    payments,
    blocks: [{ id: uid("blk"), court: 2, date: day(1), time: "12:00", duration: 120, reason: "Perawatan permukaan lapangan" }],
    notifications: [],
    audit: [{ id: uid("log"), actor: "Sistem", message: "Ruang admin siap digunakan.", timestamp: stamp }],
    pending: [],
    guards: {},
  }
  bookings[6].refundAmount = bookings[6].total
  for (const booking of [bookings[0], bookings[3], bookings[5]])
    notification(d, { audience: "admin", type: "venue_new_booking", channel: "in_app", booking })
  notification(d, { audience: "admin", type: "venue_booking_cancelled", channel: "in_app", booking: bookings[6] })
  notification(d, { audience: "player", userId: "usr-player", type: "booking_confirmation", channel: "email", booking: bookings[0] })
  scheduleReminder(d, bookings[0])
  return d
}

async function db(): Promise<Db> {
  if (!cache) {
    try {
      const stored = JSON.parse(localStorage.getItem(DB_KEY) || "null")
      cache = stored?.version === 2 ? stored : null
    } catch {
      cache = null
    }
    if (!cache) {
      cache = await createDb()
      persist()
    }
  }
  sweep(cache)
  return cache
}

/* ---------- Public API ---------- */

const publicClub = (d: Db) => structuredClone(d.club)

export const api = {
  auth: {
    /** POST /auth/register → sends OTP */
    async register(input: { name: string; identifier: string; password: string }): Promise<OtpChallenge> {
      await wait()
      const d = await db()
      const name = input.name.trim()
      if (name.length < 2) throw new ApiError("invalid_input", "Isi nama minimal 2 karakter.", { field: "name" })
      const identity = parseIdentifier(input.identifier)
      if (input.password.length < 8)
        throw new ApiError("invalid_input", "Kata sandi minimal 8 karakter.", { field: "password" })
      if (d.users.some((user) => (identity.email && user.email === identity.email) || (identity.phone && user.phone === identity.phone)))
        throw new ApiError("duplicate", "Sudah terdaftar.")
      d.pending = d.pending.filter((item) => (item.email || item.phone) !== identity.key)
      const pending: PendingRegistration = {
        id: uid("otp"),
        name,
        email: identity.email,
        phone: identity.phone,
        hash: await hashSecret(input.password, identity.key),
        code: String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0"),
        expiresAt: Date.now() + OTP_TTL,
        resendAt: Date.now() + OTP_COOLDOWN,
        attempts: 0,
      }
      d.pending.push(pending)
      commit()
      return { challengeId: pending.id, destination: maskDestination(pending.email, pending.phone), expiresAt: pending.expiresAt, resendAt: pending.resendAt, preview: pending.code }
    },
    /** POST /auth/verify-otp */
    async verifyOtp(input: { challengeId: string; code: string }): Promise<User> {
      await wait()
      const d = await db()
      const pending = d.pending.find((item) => item.id === input.challengeId)
      if (!pending || pending.expiresAt < Date.now()) throw new ApiError("otp_expired", "Kode kedaluwarsa.")
      if (pending.attempts >= OTP_ATTEMPTS) throw new ApiError("otp_attempts", "Terlalu banyak percobaan.")
      if (pending.code !== input.code.trim()) {
        pending.attempts += 1
        commit()
        if (pending.attempts >= OTP_ATTEMPTS) throw new ApiError("otp_attempts", "Terlalu banyak percobaan.")
        throw new ApiError("otp_invalid", "Kode salah.", { remaining: OTP_ATTEMPTS - pending.attempts })
      }
      const user: User = { id: uid("usr"), name: pending.name, email: pending.email, phone: pending.phone, role: "player", isVerified: true, createdAt: iso() }
      d.users.push(user)
      d.credentials.push({ userId: user.id, hash: pending.hash })
      d.pending = d.pending.filter((item) => item.id !== pending.id)
      localStorage.setItem(SESSION_KEYS.player, JSON.stringify(user.id))
      commit()
      return user
    },
    /** POST /auth/resend-otp */
    async resendOtp(challengeId: string): Promise<OtpChallenge> {
      await wait()
      const d = await db()
      const pending = d.pending.find((item) => item.id === challengeId)
      if (!pending) throw new ApiError("otp_expired", "Sesi verifikasi berakhir.")
      if (pending.resendAt > Date.now())
        throw new ApiError("otp_cooldown", "Tunggu sebentar.", { seconds: Math.ceil((pending.resendAt - Date.now()) / 1000) })
      pending.code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0")
      pending.attempts = 0
      pending.expiresAt = Date.now() + OTP_TTL
      pending.resendAt = Date.now() + OTP_COOLDOWN
      commit()
      return { challengeId: pending.id, destination: maskDestination(pending.email, pending.phone), expiresAt: pending.expiresAt, resendAt: pending.resendAt, preview: pending.code }
    },
    /** POST /auth/login (scope "staff" only admits owner/staff roles) */
    async login(input: { identifier: string; password: string; scope: SessionScope }): Promise<User> {
      await wait(260)
      const d = await db()
      const identity = parseIdentifier(input.identifier)
      const guardKey = `${input.scope}:${identity.key}`
      const guard = (d.guards[guardKey] ||= { failures: 0 })
      if (guard.lockedUntil && guard.lockedUntil > Date.now())
        throw new ApiError("locked", "Akun dikunci sementara.", { minutes: Math.ceil((guard.lockedUntil - Date.now()) / 60000) })
      const user = d.users.find((item) => (identity.email && item.email === identity.email) || (identity.phone && item.phone === identity.phone))
      const credential = user && d.credentials.find((item) => item.userId === user.id)
      const valid =
        !!user &&
        !!credential &&
        credential.hash === (await hashSecret(input.password, user.email || user.phone || "")) &&
        (input.scope === "player" || user.role !== "player")
      if (!valid) {
        guard.failures += 1
        if (guard.failures >= LOGIN_ATTEMPTS) {
          guard.failures = 0
          guard.lockedUntil = Date.now() + LOCK_DURATION
          commit()
          throw new ApiError("locked", "Akun dikunci sementara.", { minutes: LOCK_DURATION / 60000 })
        }
        commit()
        throw new ApiError("invalid_credentials", "Data masuk belum tepat.", { remaining: LOGIN_ATTEMPTS - guard.failures })
      }
      delete d.guards[guardKey]
      localStorage.setItem(SESSION_KEYS[input.scope], JSON.stringify(user!.id))
      commit()
      return user!
    },
    /** POST /auth/logout */
    async logout(scope: SessionScope) {
      await wait(80)
      localStorage.removeItem(SESSION_KEYS[scope])
      commit()
    },
    /** GET /auth/me */
    async me(scope: SessionScope): Promise<User | null> {
      const d = await db()
      return sessionUser(d, scope)
    },
  },

  club: {
    /** GET /club */
    async get(): Promise<ClubConfig> {
      try {
        if (typeof window !== "undefined") {
          const res = await fetch("/api/club")
          if (res.ok) {
            const data = await res.json()
            return data
          }
        }
      } catch (e) {
        console.warn("fetch /api/club fallback", e)
      }
      await wait(60)
      return publicClub(await db())
    },
  },

  /** GET /courts/:id/availability — busy intervals for every court. */
  async availability(): Promise<BusySlot[]> {
    const d = await db()
    const localBlocks: BusySlot[] = d.blocks.map((item) => ({
      court: item.court,
      date: item.date,
      time: item.time,
      duration: item.duration,
      kind: "block" as const,
    }))

    try {
      if (typeof window !== "undefined") {
        const res = await fetch("/api/availability")
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            const merged = [...data]
            for (const lb of localBlocks) {
              const exists = merged.some(
                (item) => item.court === lb.court && item.date === lb.date && item.time === lb.time
              )
              if (!exists) {
                merged.push(lb)
              }
            }
            return merged
          }
        }
      }
    } catch (e) {
      console.warn("fetch /api/availability fallback", e)
    }

    return [
      ...d.bookings
        .filter((item) => isActiveBooking(item.status))
        .map((item) => ({ court: item.court, date: item.date, time: item.time, duration: item.duration, kind: item.status === "confirmed" ? ("booking" as const) : ("hold" as const), bookingId: item.id })),
      ...localBlocks,
    ]
  },

  /** GET /reviews */
  async reviews(): Promise<PublicReview[]> {
    try {
      if (typeof window !== "undefined") {
        const res = await fetch("/api/reviews")
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            return data
          }
        }
      }
    } catch (e) {
      console.warn("fetch /api/reviews fallback", e)
    }
    const d = await db()
    return d.bookings
      .filter((item) => item.status === "completed" && item.rating && !item.hiddenReview)
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
      .map((item) => {
        const [first, last] = (item.customerName || "Pemain klub").split(" ")
        return { id: item.id, name: last ? `${first} ${last[0]}.` : first, rating: item.rating!, review: item.review, court: item.court, courtName: item.courtName, date: item.date, reply: item.adminReply }
      })
  },

  bookings: {
    /** POST /bookings — creates a time-limited hold */
    async hold(input: { court: number; date: string; time: string; duration: number }): Promise<Booking> {
      await wait(150)
      const d = await db()
      const user = requirePlayer(d)

      // 1. Try atomic lock via Redis / API route
      if (typeof window !== "undefined") {
        try {
          const lockRes = await fetch("/api/slots/lock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courtId: input.court,
              date: input.date,
              startTime: input.time,
              userId: user.id,
            }),
          })
          if (!lockRes.ok) {
            const err = await lockRes.json().catch(() => ({}))
            throw new ApiError("slot_unavailable", err.message || "Slot waktu ini sedang dipilih/dikunci oleh pengguna lain.")
          }
        } catch (err: any) {
          if (err instanceof ApiError) throw err
        }
      }

      for (const item of d.bookings)
        if (item.userId === user.id && (item.status === "hold" || item.status === "pending_payment")) {
          item.status = "expired"
          item.history.push(event("expired", "system", "Digantikan oleh pilihan baru"))
        }
      const court = assertSlot(d, input)
      const booking: Booking = {
        id: bookingCode(),
        venueId: d.club.id,
        userId: user.id,
        court: court.id,
        courtName: court.name,
        courtType: court.type,
        date: input.date,
        time: input.time,
        duration: input.duration,
        total: (court.price * input.duration) / 60,
        status: "hold",
        source: "online",
        createdAt: iso(),
        holdExpiresAt: Date.now() + d.club.policy.holdMinutes * 60000,
        customerName: user.name,
        customerContact: user.email || user.phone,
        rescheduleCount: 0,
        history: [event("hold", "player")],
      }
      d.bookings.unshift(booking)
      commit()

      // Also persist to Supabase PostgreSQL in background
      if (typeof window !== "undefined") {
        fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courtId: input.court,
            date: input.date,
            startTime: input.time,
            durationHours: input.duration / 60,
            customerName: user.name,
            customerContact: user.email || user.phone,
            userId: user.id,
            totalPrice: booking.total,
            code: booking.id,
          }),
        }).catch(() => {})
      }

      return structuredClone(booking)
    },
    /** DELETE /bookings/:id/hold — releases a hold when the player changes their mind */
    async release(id: string) {
      await wait(80)
      const d = await db()
      const { booking } = ownBooking(d, id)
      if (booking.status === "hold" || booking.status === "pending_payment") {
        booking.status = "expired"
        booking.history.push(event("expired", "player", "Dilepas pemain"))
        d.payments.filter((item) => item.bookingId === id && item.status === "pending").forEach((item) => (item.status = "expired"))
        commit()

        if (typeof window !== "undefined") {
          fetch("/api/slots/lock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courtId: booking.court,
              date: booking.date,
              startTime: booking.time,
              action: "release",
              userId: booking.userId,
            }),
          }).catch(() => {})
        }
      }
    },
    /** GET /bookings/:id (owner only) */
    async get(id: string): Promise<Booking> {
      await wait(90)
      return structuredClone(ownBooking(await db(), id).booking)
    },
    /** GET /bookings */
    async mine(): Promise<Booking[]> {
      const d = await db()
      const user = sessionUser(d, "player")
      if (!user) return []
      return structuredClone(
        d.bookings
          .filter((item) => item.userId === user.id && item.status !== "expired")
          .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
      )
    },
    /** POST /bookings/:id/cancel */
    async cancel(id: string): Promise<Booking> {
      await wait(220)
      const d = await db()
      const { booking } = ownBooking(d, id)
      if (booking.status !== "confirmed" || hoursUntil(booking.date, booking.time) <= d.club.policy.cancellationHours)
        throw new ApiError("policy", "Di luar batas pembatalan.")
      booking.status = "cancelled"
      booking.cancelReason = "Dibatalkan pemain"
      booking.refundAmount = refundFor(d, booking, d.club.policy.refundPercent)
      booking.history.push(event("cancelled", "player"))
      d.notifications.filter((item) => item.bookingId === id && item.status === "scheduled").forEach((item) => (item.status = "cancelled"))
      notification(d, { audience: "player", userId: booking.userId, type: "booking_cancelled", channel: "email", booking })
      notification(d, { audience: "admin", type: "venue_booking_cancelled", channel: "in_app", booking })
      commit()
      return structuredClone(booking)
    },
    /** POST /bookings/:id/reschedule — self-service, no approval */
    async reschedule(id: string, slot: { date: string; time: string }): Promise<Booking> {
      await wait(220)
      const d = await db()
      const { booking } = ownBooking(d, id)
      const policy = d.club.policy
      if (
        booking.status !== "confirmed" ||
        !policy.allowReschedule ||
        booking.rescheduleCount >= policy.maxReschedules ||
        hoursUntil(booking.date, booking.time) <= policy.rescheduleHours
      )
        throw new ApiError("policy", "Di luar batas perubahan jadwal.")
      assertSlot(d, { court: booking.court, date: slot.date, time: slot.time, duration: booking.duration }, booking.id)
      const from = `${booking.date} ${booking.time}`
      booking.date = slot.date
      booking.time = slot.time
      booking.rescheduleCount += 1
      booking.history.push(event("rescheduled", "player", `${from} → ${slot.date} ${slot.time}`))
      scheduleReminder(d, booking)
      notification(d, { audience: "player", userId: booking.userId, type: "booking_rescheduled", channel: "email", booking })
      notification(d, { audience: "admin", type: "venue_booking_rescheduled", channel: "in_app", booking })
      commit()
      return structuredClone(booking)
    },
    /** POST /bookings/:id/review */
    async rate(id: string, input: { rating: number; review: string }): Promise<Booking> {
      await wait(200)
      const d = await db()
      const { booking } = ownBooking(d, id)
      if (booking.status !== "completed" || booking.rating) throw new ApiError("policy", "Booking ini tidak dapat dinilai.")
      if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
        throw new ApiError("invalid_input", "Pilih 1–5 bintang.")
      booking.rating = input.rating
      booking.review = input.review.trim().slice(0, 500)
      booking.reviewedAt = iso()
      booking.history.push(event("reviewed", "player"))
      commit()
      return structuredClone(booking)
    },
  },

  payments: {
    /** POST /bookings/:id/checkout — creates a gateway payment session */
    async checkout(bookingId: string, method: Exclude<PaymentMethod, "cash">): Promise<Payment> {
      await wait(300)
      const d = await db()
      const { booking } = ownBooking(d, bookingId)
      if (booking.status === "expired" || (booking.holdExpiresAt || 0) <= Date.now())
        throw new ApiError("hold_expired", "Waktu checkout habis.")
      if (booking.status !== "hold" && booking.status !== "pending_payment")
        throw new ApiError("policy", "Booking ini tidak menunggu pembayaran.")
      d.payments.filter((item) => item.bookingId === bookingId && item.status === "pending").forEach((item) => (item.status = "expired"))
      const isVa = method.endsWith("_va")
      const payment: Payment = {
        id: uid("pay"),
        bookingId,
        gateway: "midtrans",
        gatewayRef: `MT-${booking.id.slice(4)}-${d.payments.filter((item) => item.bookingId === bookingId).length + 1}`,
        method,
        amount: booking.total,
        status: "pending",
        createdAt: iso(),
        expiresAt: booking.holdExpiresAt,
        instructions: isVa
          ? `${method === "bca_va" ? "3901" : "8908"} ${String(Date.now()).slice(-12).replace(/(\d{4})(?=\d)/g, "$1 ")}`
          : undefined,
      }
      booking.status = "pending_payment"
      booking.history.push(event("pending_payment", "player", method))
      d.payments.unshift(payment)
      commit()

      // Charge token / QRIS creation on backend
      if (typeof window !== "undefined") {
        try {
          const res = await fetch("/api/payment/charge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: booking.id,
              grossAmount: booking.total,
              paymentType: method,
              customerDetails: {
                first_name: booking.customerName,
                email: booking.customerContact?.includes("@") ? booking.customerContact : undefined,
                phone: !booking.customerContact?.includes("@") ? booking.customerContact : undefined,
              },
              itemDetails: [
                {
                  id: `court-${booking.court}`,
                  price: booking.total,
                  quantity: 1,
                  name: `Sewa ${booking.courtName}`,
                },
              ],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.qrString) payment.qrString = data.qrString;
            if (data?.qrImageUrl) payment.qrImageUrl = data.qrImageUrl;
            commit();
          }
        } catch (e) {
          console.warn("Midtrans charge warn:", e);
        }
      }

      return structuredClone(payment)
    },
    /** GET /payments?bookingId= */
    async forBooking(bookingId: string): Promise<Payment[]> {
      const d = await db()
      ownBooking(d, bookingId)
      return structuredClone(d.payments.filter((item) => item.bookingId === bookingId))
    },
    /** Stand-in for POST /payments/webhook/:gateway. Idempotent like the real webhook. */
    async simulateWebhook(paymentId: string, outcome: "success" | "failed"): Promise<{ payment: Payment; booking: Booking }> {
      await wait(500)
      const d = await db()
      const payment = d.payments.find((item) => item.id === paymentId)
      const booking = payment && d.bookings.find((item) => item.id === payment.bookingId)
      if (!payment || !booking) throw new ApiError("not_found", "Pembayaran tidak ditemukan.")
      if (payment.status === "pending") {
        if (outcome === "success" && booking.status === "pending_payment") {
          payment.status = "success"
          payment.paidAt = iso()
          booking.status = "confirmed"
          delete booking.holdExpiresAt
          booking.history.push(event("confirmed", "system", payment.gatewayRef))
          notification(d, { audience: "player", userId: booking.userId, type: "booking_confirmation", channel: "email", booking })
          scheduleReminder(d, booking)
          notification(d, { audience: "admin", type: "venue_new_booking", channel: "in_app", booking })
        } else {
          payment.status = "failed"
          notification(d, { audience: "player", userId: booking.userId, type: "payment_failed", channel: "in_app", booking })
        }
        commit()

        if (typeof window !== "undefined") {
          fetch("/api/payment/webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: booking.id,
              status_code: outcome === "success" ? "200" : "202",
              gross_amount: `${booking.total}.00`,
              signature_key: "simulated",
              transaction_status: outcome === "success" ? "settlement" : "deny",
              payment_type: payment.method || "qris",
            }),
          }).catch((e) => console.warn("Webhook background warn:", e))
        }
      }
      return { payment: structuredClone(payment), booking: structuredClone(booking) }
    },
  },

  notifications: {
    /** GET /notifications */
    async mine(): Promise<AppNotification[]> {
      const d = await db()
      const user = sessionUser(d, "player")
      if (!user) return []
      return structuredClone(d.notifications.filter((item) => item.audience === "player" && item.userId === user.id && item.status !== "cancelled"))
    },
    /** POST /notifications/read */
    async markRead() {
      const d = await db()
      const user = requirePlayer(d)
      d.notifications.filter((item) => item.userId === user.id && !item.readAt && item.status === "sent").forEach((item) => (item.readAt = iso()))
      commit()
    },
    async markItemRead(id: string) {
      const d = await db()
      const n = d.notifications.find((item) => item.id === id)
      if (n) n.readAt = iso()
      commit()
    },
  },

  admin: {
    async bookings(): Promise<Booking[]> {
      const d = await db()
      requireStaff(d)
      return structuredClone(d.bookings.filter((item) => item.status !== "expired" && item.status !== "hold"))
    },
    async blocks(): Promise<SlotBlock[]> {
      const d = await db()
      requireStaff(d)

      try {
        if (typeof window !== "undefined") {
          const res = await fetch("/api/admin/blocks")
          if (res.ok) {
            const serverBlocks = await res.json()
            if (Array.isArray(serverBlocks)) {
              const mapped: SlotBlock[] = serverBlocks.map((b: any) => {
                const [startH, startM] = (b.startTime || "00:00").split(":").map(Number)
                const [endH, endM] = (b.endTime || "00:00").split(":").map(Number)
                const duration = Math.max(30, (endH * 60 + endM) - (startH * 60 + startM))
                return {
                  id: b.id,
                  court: b.courtId,
                  date: b.date,
                  time: b.startTime,
                  duration,
                  reason: b.reason || "Perawatan lapangan",
                }
              })
              d.blocks = mapped
              persist()
              return mapped
            }
          }
        }
      } catch (e) {
        console.warn("fetch /api/admin/blocks fallback", e)
      }

      return structuredClone(d.blocks)
    },
    async payments(): Promise<Payment[]> {
      const d = await db()
      requireStaff(d, ["owner"])
      return structuredClone(d.payments)
    },
    async notifications(): Promise<AppNotification[]> {
      const d = await db()
      requireStaff(d)
      return structuredClone(d.notifications.filter((item) => item.audience === "admin"))
    },
    async markNotificationsRead() {
      const d = await db()
      requireStaff(d)
      d.notifications.filter((item) => item.audience === "admin" && !item.readAt).forEach((item) => (item.readAt = iso()))
      commit()
    },
    async markNotificationRead(id: string) {
      const d = await db()
      requireStaff(d)
      const n = d.notifications.find((item) => item.id === id)
      if (n) n.readAt = iso()
      commit()
    },
    async audit(): Promise<AuditEntry[]> {
      const d = await db()
      requireStaff(d)
      return structuredClone(d.audit)
    },
    async createBooking(input: { name: string; contact: string; court: number; date: string; time: string; duration: number }): Promise<Booking> {
      await wait(220)
      const d = await db()
      const actor = requireStaff(d)
      if (!input.name.trim()) throw new ApiError("invalid_input", "Isi nama pemain.")
      const court = assertSlot(d, input)
      const booking: Booking = {
        id: bookingCode(),
        venueId: d.club.id,
        court: court.id,
        courtName: court.name,
        courtType: court.type,
        date: input.date,
        time: input.time,
        duration: input.duration,
        total: (court.price * input.duration) / 60,
        status: "confirmed",
        source: "walk-in",
        createdAt: iso(),
        customerName: input.name.trim(),
        customerContact: input.contact.trim(),
        rescheduleCount: 0,
        history: [event("confirmed", actor.role === "owner" ? "owner" : "staff", "Booking manual")],
      }
      d.bookings.unshift(booking)
      d.payments.unshift({ id: uid("pay"), bookingId: booking.id, gateway: "manual", gatewayRef: "KASIR", method: "cash", amount: booking.total, status: "success", createdAt: iso(), paidAt: iso() })
      audit(d, actor, `Booking manual ${booking.id} dibuat untuk ${booking.customerName}.`)
      commit()
      return structuredClone(booking)
    },
    async checkin(bookingId: string): Promise<Booking> {
      await wait(150)
      const d = await db()
      const actor = requireStaff(d)
      const booking = d.bookings.find((item) => item.id.toLowerCase() === bookingId.trim().toLowerCase())
      if (!booking) throw new ApiError("not_found", "Booking tidak ditemukan.")
      if (booking.status !== "confirmed") throw new ApiError("invalid_input", "Hanya booking berstatus Terkonfirmasi yang dapat di-checkin.")
      booking.status = "checked_in"
      booking.history.push(event("updated", actor.role === "owner" ? "owner" : "staff", "Pemain check-in di klub"))
      commit()

      if (typeof window !== "undefined") {
        fetch(`/api/bookings/${booking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "checkin" }),
        }).catch(() => {})
      }
      return structuredClone(booking)
    },
    async complete(bookingId: string): Promise<Booking> {
      await wait(150)
      const d = await db()
      const actor = requireStaff(d)
      const booking = d.bookings.find((item) => item.id === bookingId)
      if (!booking) throw new ApiError("not_found", "Booking tidak ditemukan.")
      booking.status = "completed"
      booking.history.push(event("completed", actor.role === "owner" ? "owner" : "staff", "Selesai bermain"))
      commit()

      if (typeof window !== "undefined") {
        fetch(`/api/bookings/${booking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete" }),
        }).catch(() => {})
      }
      return structuredClone(booking)
    },
    async cancelBooking(id: string, reason: string): Promise<Booking> {
      await wait(200)
      const d = await db()
      const actor = requireStaff(d)
      const booking = d.bookings.find((item) => item.id === id)
      if (!booking || booking.status !== "confirmed") throw new ApiError("not_found", "Booking aktif tidak ditemukan.")
      booking.status = "cancelled"
      booking.cancelReason = reason.trim() || "Dibatalkan klub"
      booking.refundAmount = refundFor(d, booking, 100)
      booking.history.push(event("cancelled", actor.role === "owner" ? "owner" : "staff", booking.cancelReason))
      d.notifications.filter((item) => item.bookingId === id && item.status === "scheduled").forEach((item) => (item.status = "cancelled"))
      if (booking.userId) notification(d, { audience: "player", userId: booking.userId, type: "booking_cancelled", channel: "email", booking })
      audit(d, actor, `${booking.id} dibatalkan · ${booking.cancelReason}.`)
      commit()
      return structuredClone(booking)
    },
    async deleteBooking(id: string): Promise<void> {
      await wait(180)
      const d = await db()
      const actor = requireStaff(d)
      const booking = d.bookings.find((item) => item.id.toLowerCase() === id.trim().toLowerCase())
      if (!booking) throw new ApiError("not_found", "Booking tidak ditemukan.")

      d.bookings = d.bookings.filter((item) => item.id !== booking.id)
      d.payments = d.payments.filter((item) => item.bookingId !== booking.id)
      d.notifications = d.notifications.filter((item) => item.bookingId !== booking.id)
      audit(d, actor, `Booking ${booking.id} (${booking.customerName}) telah dihapus.`)
      commit()

      if (typeof window !== "undefined") {
        try {
          await fetch(`/api/bookings/${encodeURIComponent(booking.id)}`, {
            method: "DELETE",
          })
        } catch (err) {
          console.warn("DELETE /api/bookings network error", err)
        }
      }
    },
    async deleteCustomer(identifier: string): Promise<void> {
      await wait(180)
      const d = await db()
      const actor = requireStaff(d)
      const normalized = identifier.trim().toLowerCase()

      d.users = d.users.filter((item) => item.id.toLowerCase() !== normalized && item.name.toLowerCase() !== normalized)
      d.credentials = d.credentials.filter((item) => item.userId.toLowerCase() !== normalized)

      const targetBookings = d.bookings.filter(
        (item) =>
          item.userId?.toLowerCase() === normalized ||
          (item.customerName && item.customerName.toLowerCase() === normalized) ||
          (item.customerContact && item.customerContact.toLowerCase() === normalized)
      )
      const bookingIds = new Set(targetBookings.map((b) => b.id))

      d.bookings = d.bookings.filter((item) => !bookingIds.has(item.id))
      d.payments = d.payments.filter((item) => !bookingIds.has(item.bookingId))
      d.notifications = d.notifications.filter(
        (item) => !bookingIds.has(item.bookingId ?? "") && item.userId?.toLowerCase() !== normalized
      )

      audit(d, actor, `Data pemain ${identifier} dan ${bookingIds.size} booking terkait dihapus.`)
      commit()

      if (typeof window !== "undefined") {
        for (const bid of bookingIds) {
          try {
            await fetch(`/api/bookings/${encodeURIComponent(bid)}`, {
              method: "DELETE",
            })
          } catch {
            // ignore
          }
        }
      }
    },
    async rescheduleBooking(id: string, slot: { court: number; date: string; time: string }): Promise<Booking> {
      await wait(200)
      const d = await db()
      const actor = requireStaff(d)
      const booking = d.bookings.find((item) => item.id === id)
      if (!booking || booking.status !== "confirmed") throw new ApiError("not_found", "Booking aktif tidak ditemukan.")
      const court = assertSlot(d, { ...slot, duration: booking.duration }, booking.id)
      const from = `${booking.courtName} ${booking.date} ${booking.time}`
      Object.assign(booking, { court: court.id, courtName: court.name, courtType: court.type, date: slot.date, time: slot.time })
      booking.history.push(event("rescheduled", actor.role === "owner" ? "owner" : "staff", `${from} → ${court.name} ${slot.date} ${slot.time}`))
      scheduleReminder(d, booking)
      if (booking.userId) notification(d, { audience: "player", userId: booking.userId, type: "booking_rescheduled", channel: "email", booking })
      audit(d, actor, `${booking.id} dipindahkan ke ${court.name}, ${slot.date} ${slot.time}.`)
      commit()
      return structuredClone(booking)
    },
    async updateContact(id: string, input: { name: string; contact: string }): Promise<Booking> {
      await wait(150)
      const d = await db()
      const actor = requireStaff(d)
      const booking = d.bookings.find((item) => item.id === id)
      if (!booking) throw new ApiError("not_found", "Booking tidak ditemukan.")
      if (!input.name.trim()) throw new ApiError("invalid_input", "Isi nama pemain.")
      booking.customerName = input.name.trim()
      booking.customerContact = input.contact.trim()
      booking.history.push(event("updated", actor.role === "owner" ? "owner" : "staff", "Data pemain diperbarui"))
      audit(d, actor, `Data pemain ${booking.id} diperbarui.`)
      commit()
      return structuredClone(booking)
    },
    async addBlock(input: Omit<SlotBlock, "id">): Promise<SlotBlock> {
      await wait(180)
      const d = await db()
      const actor = requireStaff(d)
      if (!input.reason.trim()) throw new ApiError("invalid_input", "Isi alasan pemblokiran slot.")
      const court = assertSlot(d, input)
      let blockId = uid("blk")

      if (typeof window !== "undefined") {
        try {
          const calcEnd = endTime(input.time, input.duration)
          const res = await fetch("/api/admin/blocks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courtId: input.court,
              date: input.date,
              startTime: input.time,
              endTime: calcEnd,
              reason: input.reason.trim(),
            }),
          })
          if (res.ok) {
            const data = await res.json()
            if (data?.id) blockId = data.id
          }
        } catch (e) {
          console.warn("POST /api/admin/blocks network error", e)
        }
      }

      const block = { ...input, reason: input.reason.trim(), id: blockId }
      d.blocks.push(block)
      audit(d, actor, `Slot ${court.name} diblokir · ${input.date} ${input.time}.`)
      commit()
      return block
    },
    async removeBlock(id: string) {
      await wait(120)
      const d = await db()
      const actor = requireStaff(d)
      const block = d.blocks.find((item) => item.id === id)
      d.blocks = d.blocks.filter((item) => item.id !== id)
      if (block) audit(d, actor, `Blokir ${block.date} ${block.time} dilepas.`)
      commit()

      if (typeof window !== "undefined") {
        try {
          await fetch(`/api/admin/blocks?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
          })
        } catch (e) {
          console.warn("DELETE /api/admin/blocks network error", e)
        }
      }
    },
    async replyReview(id: string, reply: string): Promise<Booking> {
      await wait(150)
      const d = await db()
      const actor = requireStaff(d)
      const booking = d.bookings.find((item) => item.id === id && item.rating)
      if (!booking) throw new ApiError("not_found", "Ulasan tidak ditemukan.")
      booking.adminReply = reply.trim()
      audit(d, actor, `Balasan ulasan ${id} disimpan.`)
      commit()
      return structuredClone(booking)
    },
    async setReviewHidden(id: string, hidden: boolean): Promise<Booking> {
      await wait(120)
      const d = await db()
      const actor = requireStaff(d)
      const booking = d.bookings.find((item) => item.id === id && item.rating)
      if (!booking) throw new ApiError("not_found", "Ulasan tidak ditemukan.")
      booking.hiddenReview = hidden
      audit(d, actor, `Ulasan ${id} ${hidden ? "disembunyikan" : "ditampilkan"}.`)
      commit()
      return structuredClone(booking)
    },
    /** PATCH /club (owner) */
    async updateClub(next: ClubConfig, summary: string): Promise<ClubConfig> {
      await wait(220)
      const d = await db()
      const actor = requireStaff(d, ["owner"])
      if (!next.name.trim() || !next.address.trim()) throw new ApiError("invalid_input", "Nama dan alamat klub wajib diisi.")
      if (next.openHour >= next.closeHour) throw new ApiError("invalid_input", "Jam tutup harus setelah jam buka.")
      d.club = structuredClone(next)
      audit(d, actor, summary)
      commit()
      return publicClub(d)
    },
    async staff(): Promise<User[]> {
      const d = await db()
      requireStaff(d, ["owner"])
      return structuredClone(d.users.filter((user) => user.role !== "player"))
    },
    async addStaff(input: { name: string; email: string; role: "staff" | "owner"; password: string }): Promise<User> {
      await wait(220)
      const d = await db()
      const actor = requireStaff(d, ["owner"])
      const identity = parseIdentifier(input.email)
      if (!identity.email) throw new ApiError("invalid_input", "Gunakan email untuk akun staf.")
      if (!input.name.trim()) throw new ApiError("invalid_input", "Isi nama anggota tim.")
      if (input.password.length < 8) throw new ApiError("invalid_input", "Kata sandi sementara minimal 8 karakter.")
      if (d.users.some((user) => user.email === identity.email)) throw new ApiError("duplicate", "Email sudah terdaftar.")
      const user: User = { id: uid("usr"), name: input.name.trim(), email: identity.email, role: input.role, isVerified: true, createdAt: iso() }
      d.users.push(user)
      d.credentials.push({ userId: user.id, hash: await hashSecret(input.password, identity.email) })
      audit(d, actor, `${user.name} ditambahkan sebagai ${user.role === "owner" ? "pemilik" : "staf"}.`)
      commit()
      return user
    },
    async removeStaff(id: string) {
      await wait(160)
      const d = await db()
      const actor = requireStaff(d, ["owner"])
      const user = d.users.find((item) => item.id === id && item.role !== "player")
      if (!user) throw new ApiError("not_found", "Anggota tim tidak ditemukan.")
      if (user.id === actor.id) throw new ApiError("invalid_input", "Kamu tidak bisa menghapus akunmu sendiri.")
      if (user.role === "owner" && d.users.filter((item) => item.role === "owner").length < 2)
        throw new ApiError("invalid_input", "Klub membutuhkan minimal satu pemilik.")
      d.users = d.users.filter((item) => item.id !== id)
      d.credentials = d.credentials.filter((item) => item.userId !== id)
      audit(d, actor, `Akses ${user.name} dicabut.`)
      commit()
    },
  },
}
