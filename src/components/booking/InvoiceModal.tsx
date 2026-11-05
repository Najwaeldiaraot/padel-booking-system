"use client";

import React, { useRef, useState } from "react";
import { CheckCircle2, Printer, X, ShieldCheck, Star } from "lucide-react";
import {
  button,
  dateLabel,
  endTime,
  money,
  outlineButton,
  type Booking,
  type Venue,
} from "@/lib/club";
import { api } from "@/lib/api";

export const QUICK_FEEDBACK_CHIPS = [
  "Lapangan Mulus & Bersih",
  "Pencahayaan Terang",
  "Staf Ramah & Sigap",
  "Area Santai Nyaman",
  "Pertandingan Sangat Seru",
  "Net & Garis Standar",
];

interface InvoiceModalProps {
  booking: Booking | null;
  venue: Venue;
  isOpen: boolean;
  onClose: () => void;
}

export function InvoiceModal({ booking, venue, isOpen, onClose }: InvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !booking) return null;

  const invoiceNumber = `INV/${booking.date.replace(/-/g, "")}/${booking.id.toUpperCase()}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    booking.id
  )}&margin=10`;
  const end = endTime(booking.time, booking.duration);

  const handlePrint = () => {
    const el = document.getElementById("printable-pass-invoice");
    if (!el) {
      window.print();
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Ambil stylesheet aktif untuk mempertahankan styling Tailwind & typography
    const styles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
      .map((s) => s.outerHTML)
      .join("\n");

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${booking.id} - Official Pass & E-Invoice</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            html, body {
              background: #ffffff !important;
              color: #1C2621 !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .ticket-print-wrapper {
              max-width: 620px;
              margin: 0 auto;
              background: #F4F1EA !important;
              border: 2px solid #1C2621 !important;
              padding: 24px !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div class="ticket-print-wrapper">
            ${el.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 250);
  };

  const handleToggleChip = (chip: string) => {
    setComment((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      if (trimmed.includes(chip)) {
        return trimmed
          .replace(chip, "")
          .replace(/\s{2,}/g, " ")
          .trim();
      }
      return `${trimmed} ${chip}`;
    });
  };

  const handleSubmitReview = async () => {
    if (!stars || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.bookings.rate(booking.id, { rating: stars, review: comment });
      setSubmitted(true);
    } catch (err) {
      console.warn("Failed to submit review:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      {/* Modal Backdrop with no-print */}
      <div
        className="fixed inset-0 bg-[#0B241C]/80 backdrop-blur-md no-print"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative max-h-[94vh] w-full max-w-lg overflow-y-auto bg-[#F4F1EA] shadow-2xl border border-[#1C2621]/30">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print flex items-center justify-between border-b border-[#1C2621]/15 bg-[#1C2621] px-5 py-3 text-white">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#F4F1EA]">
            <CheckCircle2 size={16} className="text-[#C9D3B0]" />
            <span>Official Pass & E-Invoice</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="no-print flex size-7 items-center justify-center text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Tutup tiket invoice"
          >
            <X size={16} />
          </button>
        </div>

        {/* Printable Ticket Stub Card */}
        <div id="printable-pass-invoice" ref={printRef} className="relative p-6 sm:p-8 text-[#1C2621]">
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

          {/* Clean Perforation Dashed Line */}
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

        {/* Rating & Quick Feedback Chips Form (Hidden on print) */}
        <div className="no-print border-t border-[#1C2621]/15 bg-white/70 p-5 text-[#1C2621]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1C2621]">
              Beri Ulasan Lapangan
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStars(val)}
                  className="p-0.5 transition hover:scale-110"
                  aria-label={`${val} bintang`}
                >
                  <Star
                    size={18}
                    className={
                      val <= stars
                        ? "fill-[#D97706] text-[#D97706]"
                        : "text-[#1C2621]/25"
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="my-2.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-[#1C2621]/60 block mb-1.5">
              Pilihan Komentar Cepat:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_FEEDBACK_CHIPS.map((chip) => {
                const isSelected = comment.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleToggleChip(chip)}
                    className={`rounded-full px-2.5 py-1 text-2xs transition-all border ${
                      isSelected
                        ? "bg-[#1C2621] text-[#F4F1EA] border-[#1C2621] font-medium"
                        : "bg-white text-[#1C2621]/80 border-[#1C2621]/20 hover:bg-[#1C2621]/5 hover:border-[#1C2621]/40"
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Bagikan pengalaman bermainmu di sini..."
            rows={2}
            className="w-full rounded-none border border-[#1C2621]/20 bg-white p-2 text-xs text-[#1C2621] placeholder:text-[#1C2621]/40 focus:border-[#1C2621] focus:outline-none"
          />

          {submitted ? (
            <p className="mt-2 text-xs font-semibold text-[#0B4A2D] flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Terima kasih! Penilaianmu tersimpan.
            </p>
          ) : (
            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                disabled={!stars || isSubmitting}
                onClick={handleSubmitReview}
                className="text-2xs font-semibold uppercase tracking-wider px-3.5 py-1.5 bg-[#1C2621] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1C2621]/90 shadow-xs"
              >
                {isSubmitting ? "Menyimpan..." : "Kirim Ulasan"}
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons (Hidden when printing) */}
        <div className="no-print flex flex-wrap items-center justify-end gap-3 border-t border-[#1C2621]/15 bg-[#1C2621]/5 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className={`no-print ${outlineButton} !min-h-10 text-xs border-[#1C2621]/30 text-[#1C2621] hover:bg-black/5`}
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className={`no-print ${button} !min-h-10 text-xs bg-[#1C2621] text-white hover:bg-[#1C2621]/90 shadow-sm`}
          >
            <Printer size={15} /> Cetak / Unduh PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvoiceModal;
