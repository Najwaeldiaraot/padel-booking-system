import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { api, subscribe } from "@/lib/api"
import {
  dateLabel,
  getCourtAvailability,
  nextDay,
  type AppNotification,
  type AuditEntry,
  type Booking,
  type BookingStatus,
  type BusySlot,
  type Payment,
  type PaymentStatus,
  type SlotBlock,
  type User,
  type Venue,
} from "@/lib/club"
import { Modal } from "@/components/ui"

export interface AdminData {
  bookings: Booking[]
  blocks: SlotBlock[]
  payments: Payment[]
  notifications: AppNotification[]
  audit: AuditEntry[]
  staff: User[]
}

export interface AdminState extends AdminData {
  me: User
  isOwner: boolean
  loading: boolean
  reload: () => Promise<void>
  notify: (message: string) => void
}

export const AdminContext = createContext<AdminState>(null!)
export const useAdmin = () => useContext(AdminContext)

const empty: AdminData = { bookings: [], blocks: [], payments: [], notifications: [], audit: [], staff: [] }

let cachedAdminData: AdminData | null = null

export function useAdminData(me: User | null) {
  const [data, setData] = useState<AdminData>(cachedAdminData || empty)
  const [loading, setLoading] = useState(!cachedAdminData)

  const reload = useCallback(async (isSilent = false) => {
    if (!me) return
    if (!isSilent && !cachedAdminData) setLoading(true)
    const owner = me.role === "owner"
    try {
      const [bookings, blocks, notifications, audit, payments, staff] = await Promise.all([
        api.admin.bookings(),
        api.admin.blocks(),
        api.admin.notifications(),
        api.admin.audit(),
        owner ? api.admin.payments() : Promise.resolve([]),
        owner ? api.admin.staff() : Promise.resolve([]),
      ])
      const nextData = { bookings, blocks, notifications, audit, payments, staff }
      cachedAdminData = nextData
      setData(nextData)
    } finally {
      setLoading(false)
    }
  }, [me])

  useEffect(() => {
    if (!me) return
    // Silent background load; keeps existing state so tab switching has 0 refresh flash
    reload(true).catch(() => setLoading(false))

    const unsubscribeLocal = subscribe(() => {
      reload(true).catch(() => {})
    })

    // Real-time SSE listener from server: updates without refreshing the page!
    let eventSource: EventSource | null = null
    if (typeof window !== "undefined") {
      try {
        eventSource = new EventSource("/api/slots/realtime")
        eventSource.addEventListener("slot_update", () => {
          reload(true).catch(() => {})
        })
      } catch (err) {
        console.warn("[Admin SSE Fallback]:", err)
      }
    }

    return () => {
      unsubscribeLocal()
      if (eventSource) eventSource.close()
    }
  }, [me, reload])

  return { data, loading, reload }
}

/** Indonesian-only translator so admin can reuse the bilingual helpers. */
export const id = (text: string) => text

export const customerName = (booking: Booking) => booking.customerName || "Pemain klub"
export const initials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

export function availableStarts(club: Venue, busy: BusySlot[], court: number, date: string, duration: number, ignoreBookingId?: string) {
  const { slots, canSelect } = getCourtAvailability({ club, court, date, duration, busy, ignoreBookingId })
  return slots.filter((_, index) => canSelect(index))
}

const statusTone: Record<BookingStatus, string> = {
  hold: "bg-warning-soft text-foreground",
  pending_payment: "bg-warning-soft text-foreground",
  confirmed: "bg-success-soft text-success-foreground",
  checked_in: "bg-forest-light text-forest-dark font-medium",
  completed: "bg-secondary text-primary",
  cancelled: "bg-danger-soft text-destructive",
  expired: "bg-muted text-muted-foreground",
}
const statusLabel: Record<BookingStatus, string> = {
  hold: "Ditahan",
  pending_payment: "Menunggu bayar",
  confirmed: "Dikonfirmasi",
  checked_in: "Sedang Bermain",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
}
export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-2xs font-medium ${statusTone[status]}`}>
      <span className="size-1.5 bg-current" aria-hidden="true" />
      {statusLabel[status]}
    </span>
  )
}

const paymentTone: Record<PaymentStatus, string> = {
  pending: "bg-warning-soft text-foreground",
  success: "bg-success-soft text-success-foreground",
  failed: "bg-danger-soft text-destructive",
  expired: "bg-muted text-muted-foreground",
  refunded: "bg-clay-soft text-clay",
}
const paymentLabel: Record<PaymentStatus, string> = {
  pending: "Menunggu",
  success: "Berhasil",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  refunded: "Dikembalikan",
}
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`inline-flex whitespace-nowrap px-2.5 py-1 text-2xs font-medium ${paymentTone[status]}`}>{paymentLabel[status]}</span>
}

export function Empty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-4 bg-secondary p-3" aria-hidden="true">
        <CalendarDays size={22} strokeWidth={1.3} />
      </span>
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Panel({ title, description, action, children, className = "" }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-border bg-card ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            {title && <h2 className="text-sm font-medium">{title}</h2>}
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

import { LuxuryDatePicker } from "./CustomUI"

export function DatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  return <LuxuryDatePicker value={value} onChange={onChange} />
}

export function AdminDialog({ title, close, children, wide }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <Modal open close={close} title={title} wide={wide} closeLabel="Tutup dialog">
      {children}
    </Modal>
  )
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const escape = (value: string | number) => `"${String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`
  const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export const adminLabel = "text-xs"
export const adminSelect = "min-h-11 border border-border bg-card px-3 text-xs"
