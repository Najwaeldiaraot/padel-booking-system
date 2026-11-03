"use client";

import React, { useRef } from "react";
import { CheckCircle2, Download, Printer, QrCode, X } from "lucide-react";
import {
  button,
  dateLabel,
  endTime,
  eyebrow,
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

  const invoiceNumber = `INV/${booking.date.replace(/-/g, "")}/${booking.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(booking.id)}`;
  const end = endTime(booking.time, booking.duration);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-card shadow-2xl">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 print:hidden">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <CheckCircle2 size={18} className="text-forest-muted" />
            <span>E-Invoice & Bukti Pemesanan</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Tutup invoice"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable Invoice Container */}
        <div ref={printRef} className="p-6 md:p-8 print:p-0">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-primary">
                {venue.name}
                <span className="text-sage">.</span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{venue.address}</p>
              <p className="text-xs text-muted-foreground">halo@rallypadel.club</p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded bg-success-soft px-3 py-1 font-mono text-2xs font-bold uppercase tracking-wider text-success-foreground">
                LUNAS / PAID
              </span>
              <p className="mt-2 font-mono text-xs font-semibold text-primary">{invoiceNumber}</p>
              <p className="text-2xs text-muted-foreground">{booking.createdAt ? new Date(booking.createdAt).toLocaleDateString("id-ID") : booking.date}</p>
            </div>
          </div>

          {/* Customer & Booking Details */}
          <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className={eyebrow}>Penyewa / Customer</p>
              <p className="mt-1 font-semibold text-foreground text-sm">{booking.customerName}</p>
              <p className="text-muted-foreground">{booking.customerContact || "-"}</p>
            </div>
            <div className="text-right">
              <p className={eyebrow}>Kode Reservasi</p>
              <p className="mt-1 font-mono text-base font-bold text-primary">{booking.id}</p>
              <p className="text-muted-foreground">Sumber: {booking.source === "walk-in" ? "Kasir Klub" : "Online"}</p>
            </div>
          </div>

          {/* Schedule Breakdown */}
          <div className="mt-6 rounded-lg border border-border bg-secondary/50 p-4 text-xs">
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Lapangan</span>
              <span className="font-semibold text-foreground">{booking.courtName}</span>
            </div>
            <div className="flex justify-between py-1.5 border-t border-border/50">
              <span className="text-muted-foreground">Tanggal Bermain</span>
              <span className="font-semibold text-foreground">{dateLabel(booking.date, false)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-t border-border/50">
              <span className="text-muted-foreground">Jam Main (WIB)</span>
              <span className="font-semibold text-foreground">{booking.time} – {end} ({booking.duration} menit)</span>
            </div>
            <div className="flex justify-between py-1.5 border-t border-border/50">
              <span className="text-muted-foreground">Status Tiket</span>
              <span className="font-bold text-forest-muted uppercase">
                {booking.status === "checked_in" ? "Sedang Bermain" : booking.status === "confirmed" ? "Terkonfirmasi" : booking.status}
              </span>
            </div>
          </div>

          {/* Pricing Table */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex justify-between text-xs py-1">
              <span className="text-muted-foreground">Sewa Lapangan ({booking.duration} menit)</span>
              <span className="font-medium">{money(booking.total)}</span>
            </div>
            <div className="flex justify-between text-xs py-1">
              <span className="text-muted-foreground">Biaya Layanan & Pajak</span>
              <span className="font-medium text-muted-foreground">Rp 0 (Termasuk)</span>
            </div>
            <div className="mt-3 flex justify-between border-t-2 border-primary pt-3 text-base font-bold">
              <span>Total Pembayaran</span>
              <span className="text-forest-muted">{money(booking.total)}</span>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
            <p className={`${eyebrow} text-primary mb-3`}>QR Code Tiket Masuk</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`QR Tiket ${booking.id}`}
              width={160}
              height={160}
              className="rounded-lg border border-border bg-white p-2 shadow-sm"
            />
            <p className="mt-3 text-2xs text-muted-foreground max-w-xs leading-relaxed">
              Tunjukkan QR Code ini ke petugas saat tiba di klub. Petugas akan memindai untuk check-in otomatis.
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-secondary/30 px-6 py-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className={`${outlineButton} !min-h-10 text-xs`}
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className={`${button} !min-h-10 text-xs`}
          >
            <Printer size={15} /> Cetak / Unduh PDF
          </button>
        </div>
      </div>
    </div>
  );
}
