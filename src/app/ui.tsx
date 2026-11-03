import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronsRight, LoaderCircle, X } from "lucide-react"

export function Modal({
  open,
  close,
  title,
  children,
  wide = false,
  closeLabel = "Tutup",
}: {
  open: boolean
  close: () => void
  title: string
  children: ReactNode
  wide?: boolean
  closeLabel?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal()
    if (!open && ref.current?.open) ref.current.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === ref.current) close()
      }}
      aria-label={title}
      className={`fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-24px)] overflow-y-auto bg-background p-6 text-foreground shadow-2xl md:p-8 ${
        wide ? "max-w-2xl" : "max-w-lg"
      }`}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 className="font-display text-4xl leading-tight">{title}</h2>
        <button
          type="button"
          onClick={close}
          aria-label={closeLabel}
          className="-m-1 flex size-11 shrink-0 items-center justify-center transition hover:bg-secondary"
        >
          <X size={20} />
        </button>
      </div>
      {open && children}
    </dialog>
  )
}

/** Horizontal scroller with an edge fade and hint, since scrollbars are hidden globally. */
export function ScrollArea({
  children,
  hint = "Geser untuk melihat lainnya",
  className = "",
}: {
  children: ReactNode
  hint?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState({ start: true, end: true })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () =>
      setState({
        start: element.scrollLeft <= 2,
        end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
      })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    element.addEventListener("scroll", update, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener("scroll", update)
    }
  }, [])
  return (
    <div className={`relative ${className}`}>
      <div ref={ref} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring">
        {children}
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card to-transparent transition-opacity ${state.start ? "opacity-0" : "opacity-100"}`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-card to-transparent transition-opacity ${state.end ? "opacity-0" : "opacity-100"}`}
      />
      {!state.end && (
        <p className="pointer-events-none absolute right-3 bottom-2 flex items-center gap-1 bg-card/90 px-2 py-1 text-2xs text-muted-foreground">
          {hint}
          <ChevronsRight size={12} aria-hidden="true" />
        </p>
      )}
    </div>
  )
}

export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </span>
  )
}

export function PageLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6 py-20">
      <Spinner label={label} />
    </div>
  )
}

export function ErrorState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div role="alert" className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="font-display text-5xl">{title}</h1>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">{description}</p>
      {action && <div className="mt-7 flex justify-center">{action}</div>}
    </div>
  )
}

export function usePageTitle(title: string, suffix: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${suffix}` : suffix
  }, [title, suffix])
}

/** Countdown in seconds to an epoch timestamp. */
export function useCountdown(target?: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!target) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [target])
  return target ? Math.max(0, Math.ceil((target - now) / 1000)) : 0
}

export const formatCountdown = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
