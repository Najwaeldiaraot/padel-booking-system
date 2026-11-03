"use client";

import React, { useState, useRef, useEffect, useId, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: SelectOption[];
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

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih opsi...",
  label,
  disabled = false,
  className = "",
  triggerClassName = "",
  error,
  id,
  name,
  required = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Close dropdown on click outside
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

  // Adjust highlight when opening
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((opt) => String(opt.value) === String(value));
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, options, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listboxRef.current && highlightedIndex >= 0) {
      const activeEl = listboxRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = useCallback(
    (opt: SelectOption) => {
      if (opt.disabled || disabled) return;
      onChange(opt.value);
      setIsOpen(false);
    },
    [disabled, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && options[highlightedIndex]) {
          handleSelect(options[highlightedIndex]);
        } else {
          setIsOpen((prev) => !prev);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => {
            let next = prev + 1;
            while (next < options.length && options[next].disabled) {
              next++;
            }
            return next < options.length ? next : prev;
          });
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => {
            let next = prev - 1;
            while (next >= 0 && options[next].disabled) {
              next--;
            }
            return next >= 0 ? next : prev;
          });
        }
        break;
      case "Escape":
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
        }
        break;
      case "Tab":
        if (isOpen) {
          setIsOpen(false);
        }
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Optional Label */}
      {label && (
        <label
          htmlFor={selectId}
          className="block mb-1.5 text-2xs font-semibold uppercase tracking-wider text-[#1C2621]/80"
        >
          {label}
          {required && <span className="ml-0.5 text-red-600">*</span>}
        </label>
      )}

      {/* Hidden Native Input for standard Form submissions */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value ?? ""}
          required={required}
        />
      )}

      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={label ? selectId : undefined}
        className={`group flex min-h-11 w-full items-center justify-between border border-[#E2E8E5] bg-white px-4 py-2.5 text-left text-sm text-[#1C2621] transition duration-200 hover:border-[#1C2621]/40 focus:border-[#1C2621] focus:outline-none focus:ring-1 focus:ring-[#1C2621] disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen ? "border-[#1C2621] ring-1 ring-[#1C2621]" : ""
        } ${triggerClassName}`}
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="font-medium text-[#1C2621]">
              {selectedOption.label}
              {selectedOption.sublabel && (
                <span className="ml-2 text-xs text-[#1C2621]/60 font-normal">
                  {selectedOption.sublabel}
                </span>
              )}
            </span>
          ) : (
            <span className="text-[#1C2621]/45">{placeholder}</span>
          )}
        </span>

        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`ml-2 shrink-0 text-[#1C2621]/60 transition-transform duration-200 group-hover:text-[#1C2621] ${
            isOpen ? "rotate-180 text-[#1C2621]" : ""
          }`}
        />
      </button>

      {/* Error Message */}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {/* Dropdown Options List */}
      {isOpen && (
        <ul
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={
            highlightedIndex >= 0 ? `${selectId}-opt-${highlightedIndex}` : undefined
          }
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto border border-[#E2E8E5] bg-[#FFFFFF] py-1 shadow-xl shadow-black/8 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {options.length === 0 ? (
            <li className="px-4 py-3 text-xs text-[#1C2621]/50 text-center">
              Tidak ada opsi tersedia
            </li>
          ) : (
            options.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              const isHighlighted = idx === highlightedIndex;

              return (
                <li
                  key={String(opt.value)}
                  id={`${selectId}-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
                  onClick={() => handleSelect(opt)}
                  className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs sm:text-sm transition-colors duration-150 ${
                    opt.disabled
                      ? "cursor-not-allowed opacity-35"
                      : isSelected
                      ? "bg-[#F4F1EA] font-semibold text-[#1C2621]"
                      : isHighlighted
                      ? "bg-[#F4F1EA]/70 text-[#1C2621]"
                      : "text-[#1C2621]/80 hover:bg-[#F4F1EA]/60 hover:text-[#1C2621]"
                  }`}
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-2xs text-[#1C2621]/50 font-normal">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check
                      size={15}
                      className="shrink-0 text-[#1C2621]"
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default CustomSelect;
