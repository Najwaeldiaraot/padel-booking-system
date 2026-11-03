"use client";

import React, { useState, useRef, useEffect, useId, useMemo } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

export interface CustomDatePickerProps {
  value: string; // Format "YYYY-MM-DD"
  onChange: (date: string) => void;
  minDate?: string; // Format "YYYY-MM-DD"
  maxDate?: string; // Format "YYYY-MM-DD"
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  error?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return dateStr;

    const dayName = DAYS_ID[date.getDay()];
    const monthName = MONTHS_ID[date.getMonth()];
    return `${dayName}, ${day} ${monthName} ${year}`;
  } catch {
    return dateStr;
  }
}

function toIsoString(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CustomDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = "Pilih tanggal...",
  label,
  disabled = false,
  className = "",
  triggerClassName = "",
  error,
  id,
  name,
  required = false,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id || generatedId;

  // View state for navigating months
  const initialDate = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [value]);

  const [viewYear, setViewYear] = useState(initialDate.year);
  const [viewMonth, setViewMonth] = useState(initialDate.month);

  // Sync view when value changes
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((prev) => prev - 1);
      setViewMonth(11);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((prev) => prev + 1);
      setViewMonth(0);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isDisabled: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    const now = new Date();
    const todayStr = toIsoString(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = toIsoString(prevYear, prevMonth + 1, dayNum);

      let isDisabled = false;
      if (minDate && dateStr < minDate) isDisabled = true;
      if (maxDate && dateStr > maxDate) isDisabled = true;

      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isDisabled,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = toIsoString(viewYear, viewMonth + 1, i);
      let isDisabled = false;
      if (minDate && dateStr < minDate) isDisabled = true;
      if (maxDate && dateStr > maxDate) isDisabled = true;

      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isDisabled,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    // Next month padding (total slots should be multiple of 7, up to 42)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = toIsoString(nextYear, nextMonth + 1, i);

      let isDisabled = false;
      if (minDate && dateStr < minDate) isDisabled = true;
      if (maxDate && dateStr > maxDate) isDisabled = true;

      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isDisabled,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    return days;
  }, [viewYear, viewMonth, minDate, maxDate, value]);

  const selectDate = (dateStr: string, isDisabled: boolean) => {
    if (isDisabled || disabled) return;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleQuickToday = () => {
    const now = new Date();
    const todayStr = toIsoString(now.getFullYear(), now.getMonth() + 1, now.getDate());
    if (minDate && todayStr < minDate) return;
    if (maxDate && todayStr > maxDate) return;
    onChange(todayStr);
    setIsOpen(false);
  };

  const handleQuickTomorrow = () => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const tomStr = toIsoString(tom.getFullYear(), tom.getMonth() + 1, tom.getDate());
    if (minDate && tomStr < minDate) return;
    if (maxDate && tomStr > maxDate) return;
    onChange(tomStr);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Optional Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block mb-1.5 text-2xs font-semibold uppercase tracking-wider text-[#1C2621]/80"
        >
          {label}
          {required && <span className="ml-0.5 text-red-600">*</span>}
        </label>
      )}

      {/* Hidden input for HTML form submissions */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value || ""}
          required={required}
        />
      )}

      {/* Trigger Button */}
      <button
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`group flex min-h-11 w-full items-center justify-between border border-border bg-card px-3.5 py-2 text-left text-xs sm:text-sm text-foreground transition duration-150 hover:border-primary/50 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen ? "border-primary ring-1 ring-primary" : ""
        } ${triggerClassName}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 truncate">
          <CalendarIcon
            size={15}
            className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
            aria-hidden="true"
          />
          <span className="truncate">
            {value ? (
              <span className="font-medium text-foreground">{formatDisplayDate(value)}</span>
            ) : (
              <span className="text-muted-foreground/60">{placeholder}</span>
            )}
          </span>
        </div>

        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`ml-2 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-primary ${
            isOpen ? "rotate-180 text-primary" : ""
          }`}
        />
      </button>

      {/* Error text */}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}

      {/* Date Picker Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute z-50 mt-1 w-72 sm:w-80 border border-border bg-card p-4 shadow-xl shadow-primary/5 focus:outline-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {MONTHS_ID[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Bulan sebelumnya"
                className="flex size-7 items-center justify-center border border-border text-foreground transition hover:bg-secondary"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Bulan selanjutnya"
                className="flex size-7 items-center justify-center border border-border text-foreground transition hover:bg-secondary"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="mt-3 grid grid-cols-7 text-center text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {DAYS_ID.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => (
              <button
                key={`${day.dateStr}-${idx}`}
                type="button"
                disabled={day.isDisabled}
                onClick={() => selectDate(day.dateStr, day.isDisabled)}
                className={`relative flex h-8 w-full items-center justify-center text-xs transition duration-150 ${
                  day.isSelected
                    ? "bg-forest-deep font-bold text-white shadow-xs"
                    : day.isDisabled
                    ? "cursor-not-allowed opacity-20 text-muted-foreground line-through"
                    : day.isCurrentMonth
                    ? "text-foreground hover:bg-secondary hover:text-primary"
                    : "text-muted-foreground/40 hover:bg-secondary/60 hover:text-foreground"
                } ${
                  day.isToday && !day.isSelected
                    ? "border border-primary font-semibold text-primary"
                    : ""
                }`}
              >
                {day.dayNumber}
              </button>
            ))}
          </div>

          {/* Quick Actions Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
            <button
              type="button"
              onClick={handleQuickToday}
              className="text-2xs font-semibold uppercase tracking-wider text-primary hover:underline"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={handleQuickTomorrow}
              className="text-2xs font-semibold uppercase tracking-wider text-primary hover:underline"
            >
              Besok
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomDatePicker;
