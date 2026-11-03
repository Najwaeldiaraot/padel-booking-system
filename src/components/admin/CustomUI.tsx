"use client"

import React, { useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { Calendar as CalendarIcon, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { dateLabel, nextDay, today } from "@/lib/club"

export interface SelectOption {
  value: string | number
  label: string
}

export function LuxurySelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  placeholder = "Pilih...",
}: {
  value: string | number
  onChange: (value: any) => void
  options: SelectOption[]
  ariaLabel?: string
  className?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((opt) => String(opt.value) === String(value))

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={`flex min-h-11 items-center justify-between gap-2.5 border border-border bg-card px-3 text-xs text-foreground transition-colors hover:border-primary/50 focus:outline-hidden focus:ring-1 focus:ring-primary ${className}`}
        >
          <span className="truncate font-medium">{current?.label || placeholder}</span>
          <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-64 min-w-[180px] overflow-y-auto border border-border bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value)
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors ${
                  isSelected ? "bg-secondary font-semibold text-primary" : "text-foreground hover:bg-surface"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check size={13} className="shrink-0 text-primary" />}
              </button>
            )
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function LuxuryDatePicker({
  value,
  onChange,
  className = "",
}: {
  value: string
  onChange: (date: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  // Current view in calendar (year & month)
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = (value || today()).split("-").map(Number)
    return new Date(y, m - 1, 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ]
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setViewDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setViewDate(new Date(year, month + 1, 1))
  }

  const handleSelectDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    onChange(dateStr)
    setOpen(false)
  }

  const formattedDisplay = value ? dateLabel(value, true) : "Pilih tanggal"

  return (
    <div className={`flex shrink-0 items-center border border-border bg-card ${className}`}>
      <button
        type="button"
        aria-label="Hari sebelumnya"
        onClick={() => onChange(nextDay(value, -1))}
        className="flex size-11 items-center justify-center hover:bg-secondary transition-colors"
      >
        <ChevronLeft size={16} />
      </button>

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 border-x border-border bg-transparent px-3 text-xs font-medium text-foreground hover:bg-surface transition-colors focus:outline-hidden"
          >
            <CalendarIcon size={14} className="text-primary shrink-0" />
            <span>{formattedDisplay}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="center"
            sideOffset={4}
            className="z-50 w-72 border border-border bg-card p-4 shadow-xl animate-in fade-in-0 zoom-in-95"
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="flex size-7 items-center justify-center hover:bg-secondary transition-colors"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs font-bold text-foreground">
                {monthNames[month]} {year}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="flex size-7 items-center justify-center hover:bg-secondary transition-colors"
                aria-label="Bulan berikutnya"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-2xs font-semibold text-muted-foreground mb-2">
              {dayNames.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const isSelected = dateStr === value
                const isToday = dateStr === today()
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={`flex size-8 items-center justify-center text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-forest-deep text-white font-bold"
                        : isToday
                          ? "border border-primary text-primary hover:bg-secondary"
                          : "text-foreground hover:bg-surface"
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-border mt-3 text-2xs">
              <button
                type="button"
                onClick={() => {
                  onChange(today())
                  setViewDate(new Date())
                  setOpen(false)
                }}
                className="text-primary font-semibold hover:underline"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Tutup
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <button
        type="button"
        aria-label="Hari berikutnya"
        onClick={() => onChange(nextDay(value, 1))}
        className="flex size-11 items-center justify-center hover:bg-secondary transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
