"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  QrCode,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  button,
  dateLabel,
  endTime,
  eyebrow,
  outlineButton,
  today,
  type Booking,
} from "@/lib/club";

interface AdminLiveOperationsProps {
  bookings: Booking[];
  reload: () => Promise<void>;
  notify: (msg: string) => void;
}

export function AdminLiveOperations({ bookings, reload, notify }: AdminLiveOperationsProps) {
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Status Mode Testing (Bypass Jadwal) dibaca dari Pengaturan Klub
  const [bypassMode, setBypassMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("padel_bypass_checkin_mode") === "true";
    }
    return false;
  });

  useEffect(() => {
    const handleStorage = () => {
      if (typeof window !== "undefined") {
        setBypassMode(localStorage.getItem("padel_bypass_checkin_mode") === "true");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, "0");
  const currentMinutes = String(now.getMinutes()).padStart(2, "0");
  const currentTimeStr = `${currentHours}:${currentMinutes}`;
  const todayStr = today();

  // Active bookings for today
  const todayActiveBookings = bookings.filter(
    (b) => b.date === todayStr && (b.status === "checked_in" || b.status === "confirmed")
  );

  // Expired alerts: bookings where status is checked_in and current time >= booking end time
  const expiredBookings = todayActiveBookings.filter((b) => {
    if (b.status !== "checked_in") return false;
    const end = endTime(b.time, b.duration);
    return currentTimeStr >= end;
  });

  const handleCheckin = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // Validate booking presence
    const target = bookings.find(
      (b) => b.id.toLowerCase() === code.toLowerCase()
    );

    if (target && !bypassMode) {
      // 1. Validate date
      if (target.date !== todayStr) {
        notify(
          `Check-in ditolak: Jadwal booking adalah tanggal ${dateLabel(target.date, true)}. Aktifkan Mode Testing di menu Pengaturan Klub jika ingin bypass jadwal.`
        );
        return;
      }

      // 2. Validate time window (allow checkin 30 mins before startTime until endTime)
      const [startH, startM] = target.time.split(":").map(Number);
      const earlyBufferMins = 30;
      let earlyH = startH;
      let earlyM = startM - earlyBufferMins;
      if (earlyM < 0) {
        earlyH -= 1;
        earlyM += 60;
      }
      const earlyTimeStr = `${String(earlyH).padStart(2, "0")}:${String(earlyM).padStart(2, "0")}`;

      if (currentTimeStr < earlyTimeStr) {
        notify(
          `Belum masuk jadwal: Jadwal bermain pukul ${target.time} WIB (check-in dibuka mulai ${earlyTimeStr} WIB). Aktifkan Mode Testing di menu Pengaturan Klub jika ingin bypass.`
        );
        return;
      }
    }

    setIsProcessing(true);
    try {
      await api.admin.checkin(code);
      notify(`Pemain ${code} berhasil check-in! Status kini: Sedang Bermain.`);
      setScanCode("");
      setScanOpen(false);
      await reload();
    } catch (err: any) {
      notify(`Gagal checkin: ${err?.message || "Booking tidak ditemukan atau belum konfirmasi."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = async (bookingId: string) => {
    setIsProcessing(true);
    try {
      await api.admin.complete(bookingId);
      notify(`Booking ${bookingId} telah ditandai Selesai. Lapangan siap dibersihkan/rotasi.`);
      await reload();
    } catch (err: any) {
      notify(`Gagal menyelesaikan: ${err?.message || "Terjadi kesalahan."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mb-6 space-y-4">
      {/* 1. ALERT BANNER: WAKTU BERMAIN TELAH HABIS */}
      {expiredBookings.length > 0 && (
        <div className="space-y-2.5">
          {expiredBookings.map((b) => {
            const end = endTime(b.time, b.duration);
            return (
              <div
                key={b.id}
                role="alert"
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-amber-500 bg-amber-500/15 p-4 text-amber-950 shadow-sm dark:bg-amber-950/40 dark:text-amber-200 animate-in fade-in duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <AlertTriangle size={22} className="animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-2xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        WAKTU BERMAIN HABIS
                      </span>
                      <span className="font-semibold text-sm">
                        {b.courtName} ({b.time} – {end} WIB)
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-300/80">
                      Pemain: <strong>{b.customerName}</strong> ({b.id}). Harap ingatkan pemain di lapangan bahwa durasi sewa telah selesai untuk rotasi pemain berikutnya.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleComplete(b.id)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-xs font-bold text-white transition hover:bg-amber-700 active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} /> Tandai Selesai (Rotasi)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. OPERATIONAL QUICK ACTION: STATUS, SCAN TIKET, DAN TOGGLE TESTING BYPASS */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        {/* Kolom Kiri: Status Jam & Lapangan Aktif */}
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              Operasional Lapangan Hari Ini · {currentTimeStr} WIB
            </p>
            <p className="text-2xs text-muted-foreground">
              {todayActiveBookings.filter((b) => b.status === "checked_in").length} lapangan sedang bermain ·{" "}
              {todayActiveBookings.filter((b) => b.status === "confirmed").length} menunggu check-in
            </p>
          </div>
        </div>

        {/* Kolom Kanan: Tombol Scan Tiket */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className={`${button} !min-h-10 text-xs gap-2`}
          >
            <QrCode size={15} /> Scan / Input Tiket QR
          </button>
        </div>
      </div>

      {/* MODAL SCAN / INPUT TIKET QR */}
      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <QrCode size={18} className="text-primary" />
                <span>Validasi Tiket & Check-in</span>
              </div>
              <button
                type="button"
                onClick={() => setScanOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Masukkan Kode Reservasi dari QR Code pemain (contoh: <code>RLY-BRHVPQ</code>):
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCheckin(scanCode);
              }}
              className="mt-4 space-y-4"
            >
              <input
                type="text"
                required
                autoFocus
                placeholder="RLY-XXXXXX"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 font-mono text-sm tracking-wider uppercase focus:border-primary focus:outline-none"
              />

              {/* Daftar booking menunggu checkin */}
              {bookings.filter((b) => b.status === "confirmed" && (bypassMode || b.date === todayStr)).length > 0 && (
                <div>
                  <p className={`${eyebrow} mb-2 text-muted-foreground`}>
                    {bypassMode ? "Semua booking terkonfirmasi (Bypass Aktif):" : "Booking menunggu check-in hari ini:"}
                  </p>
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {bookings
                      .filter((b) => b.status === "confirmed" && (bypassMode || b.date === todayStr))
                      .slice(0, 10)
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleCheckin(b.id)}
                          className="flex w-full items-center justify-between rounded border border-border/60 bg-muted/30 px-3 py-2 text-left text-xs transition hover:bg-muted"
                        >
                          <div>
                            <p className="font-semibold text-foreground">{b.customerName}</p>
                            <p className="font-mono text-2xs text-muted-foreground">{b.id} · {b.courtName}</p>
                            <p className="text-3xs text-muted-foreground">{dateLabel(b.date, true)}</p>
                          </div>
                          <span className="rounded bg-primary/10 px-2 py-1 font-mono text-2xs font-bold text-primary">
                            {b.time}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setScanOpen(false)}
                  className={`${outlineButton} !min-h-10 text-xs`}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!scanCode.trim() || isProcessing}
                  className={`${button} !min-h-10 text-xs`}
                >
                  {isProcessing ? "Memproses…" : "Validasi & Check-in"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
