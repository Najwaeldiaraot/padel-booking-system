"use client";

import React, { useRef } from "react";
import { CheckCircle2, Printer, X, ShieldCheck } from "lucide-react";
import {
  button,
  dateLabel,
  endTime,
  money,
  outlineButton,
  type Booking,
  type Venue,
} from "./club";

interface InvoiceModalProps {
  booking: Booking | null;
  venue: Venue;
  isOpen: boolean;
  onClose: () => void;
}

export function InvoiceModal({ booking, venue, isOpen, onClose }: InvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !booking) return null;

  const invoiceNumber = `INV/${booking.date.replace(/-/g, "")}/${booking.id.toUpperCase()}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    booking.id
  )}&margin=10`;
  const end = endTime(booking.time, booking.duration);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B241C]/80 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 print:static print:inset-auto print:bg-white print:p-0 print:block"
    >
      <div className="relative max-h-[94vh] w-full max-w-lg overflow-y-auto bg-[#F4F1EA] shadow-2xl border border-[#1C2621]/30 print:max-h-none print:w-full print:max-w-none print:overflow-visible print:border-none print:shadow-none print:bg-white">
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex items-center justify-between border-b border-[#1C2621]/15 bg-[#1C2621] px-5 py-3 text-white print:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#F4F1EA]">
            <CheckCircle2 size={16} className="text-[#C9D3B0]" />
            <span>Official Pass & E-Invoice</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Tutup tiket invoice"
          >
            <X size={16} />
          </button>
        </div>

        {/* Printable Ticket Stub Card */}
        <div ref={printRef} className="relative p-6 sm:p-8 print:p-4 text-[#1C2621]">
          {/* Ticket Header & Brand */}
          <div className="border-b-2 border-[#1C2621] pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-2xs uppercase tracking-widest text-[#1C2621]/70 block mb-1 font-semibold">
                  Rally Padel Club · Jakarta
                </span>
                <h2
                  id="ticket-modal-title"
                  className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1C2621] leading-none"
                >
                  {venue.name}
                  <span className="text-[#9B7058]">.</span>
                </h2>
                <p className="mt-1.5 text-xs text-[#1C2621]/75">{venue.address}</p>
              </div>

              {/* Luxury PAID Badge */}
              <div className="flex flex-col items-end">
                <div className="inline-flex items-center gap-1.5 border border-[#1C2621] bg-[#1C2621] px-3 py-1 text-white">
                  <ShieldCheck size={13} className="text-[#C9D3B0]" />
                  <span className="text-2xs font-semibold uppercase tracking-wider">
                    Lunas
                  </span>
                </div>
                <span className="mt-1.5 text-2xs font-medium text-[#1C2621]/70">
                  {invoiceNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Ticket Body: Match & Booking Info */}
          <div className="mt-5 space-y-4 text-xs">
            {/* Court Highlight */}
            <div className="border border-[#1C2621]/20 bg-white/70 p-3.5">
              <span className="text-2xs font-semibold uppercase tracking-widest text-[#1C2621]/60 block mb-1">
                Lapangan Terpilih
              </span>
              <div className="flex items-center justify-between">
                <span className="font-display text-xl sm:text-2xl font-bold text-[#1C2621]">
                  {booking.courtName}
                </span>
                <span className="text-xs font-semibold uppercase px-2 py-0.5 bg-[#1C2621]/10 text-[#1C2621]">
                  {booking.duration} Menit
                </span>
              </div>
            </div>

            {/* Schedule Details Grid */}
            <div className="grid grid-cols-2 gap-3 border border-[#1C2621]/20 bg-white/50 p-3.5">
              <div>
                <span className="text-2xs font-semibold uppercase tracking-widest text-[#1C2621]/60 block mb-0.5">
                  Tanggal Main
                </span>
                <span className="font-semibold text-sm text-[#1C2621]">
                  {dateLabel(booking.date, false)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xs font-semibold uppercase tracking-widest text-[#1C2621]/60 block mb-0.5">
                  Waktu (WIB)
                </span>
                <span className="font-semibold text-sm text-[#1C2621]">
                  {booking.time} – {end}
                </span>
              </div>
              <div className="pt-2 border-t border-[#1C2621]/10">
                <span className="text-2xs font-semibold uppercase tracking-widest text-[#1C2621]/60 block mb-0.5">
                  Nama Pemesan
                </span>
                <span className="font-medium text-xs text-[#1C2621] truncate block">
                  {booking.customerName}
                </span>
              </div>
              <div className="pt-2 border-t border-[#1C2621]/10 text-right">
                <span className="text-2xs font-semibold uppercase tracking-widest text-[#1C2621]/60 block mb-0.5">
                  Kontak
                </span>
                <span className="text-xs text-[#1C2621]/80 truncate block">
                  {booking.customerContact || "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Clean Perforation Dashed Line (No weird side square boxes) */}
          <div className="my-6 border-t-2 border-dashed border-[#1C2621]/25" />

          {/* Dedicated Clean QR Code Section */}
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <span className="text-2xs font-semibold uppercase tracking-widest text-[#1C2621]/60 mb-3 block">
              Passcode Akses Lapangan
            </span>

            {/* Clean QR Code Container */}
            <div className="p-3 bg-white border border-[#1C2621]/20 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt={`QR Code Tiket ${booking.id}`}
                width={180}
                height={180}
                className="size-44 sm:size-48 object-contain"
              />
            </div>

            {/* Booking Code & Instruction Below QR */}
            <div className="mt-3.5">
              <span className="text-xl sm:text-2xl font-bold tracking-widest text-[#1C2621] block">
                {booking.id.toUpperCase()}
              </span>
              <p className="mt-1.5 text-xs text-[#1C2621]/70 max-w-xs leading-relaxed mx-auto">
                Tunjukkan QR Code ini kepada petugas concierge klub saat tiba untuk verifikasi check-in instan.
              </p>
            </div>
          </div>

          {/* Pricing & Settlement Breakdown */}
          <div className="mt-6 border-t border-[#1C2621]/20 pt-4 text-xs">
            <div className="flex justify-between py-1 text-[#1C2621]/75">
              <span>Sewa Lapangan ({booking.duration} menit)</span>
              <span className="font-semibold">{money(booking.total)}</span>
            </div>
            <div className="flex justify-between py-1 text-[#1C2621]/75">
              <span>Biaya Layanan & Pajak</span>
              <span className="font-semibold">Rp 0 (Termasuk)</span>
            </div>
            <div className="mt-2.5 flex justify-between border-t-2 border-[#1C2621] pt-3 text-base font-bold text-[#1C2621]">
              <span className="font-display text-lg">Total Pembayaran</span>
              <span className="text-lg font-bold">{money(booking.total)}</span>
            </div>
          </div>

          {/* Ticket Footer Microprint */}
          <div className="mt-6 border-t border-[#1C2621]/15 pt-3 text-center">
            <p className="text-2xs uppercase tracking-wider text-[#1C2621]/50">
              Rally Padel Club · Kebijakan pembatalan berlaku 24 jam sebelum jadwal · Concierge: halo@rallypadel.club
            </p>
          </div>
        </div>

        {/* Action Buttons (Hidden when printing) */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#1C2621]/15 bg-[#1C2621]/5 px-6 py-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className={`${outlineButton} !min-h-10 text-xs border-[#1C2621]/30 text-[#1C2621] hover:bg-black/5`}
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className={`${button} !min-h-10 text-xs bg-[#1C2621] text-white hover:bg-[#1C2621]/90 shadow-sm`}
          >
            <Printer size={15} /> Cetak / Unduh PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvoiceModal;
