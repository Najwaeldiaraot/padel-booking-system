# Peta Jalan & Checklist Migrasi (Migration Roadmap)

Dokumen ini menjadi panduan kerja dan daftar periksa (*checklist*) progres migrasi aplikasi **Booking Padel (Rally Padel Club)** menuju arsitektur modern produksi.

---

## Ringkasan Tahapan

```
[Fase 1: Persiapan Lingkungan & Paket] ✅ SELESAI
    │
    ▼
[Fase 2: Setup Database Supabase & Prisma] ⏳ SIAP DIKERJAKAN
    │
    ▼
[Fase 3: Core API Backend (Redis Lock, SSE, Midtrans)] ⏳ PENDING
    │
    ▼
[Fase 4: Migrasi Halaman UI & Komponen shadcn/ui] ⏳ PENDING
    │
    ▼
[Fase 5: Pengujian Bersama & Deploy ke Vercel] ⏳ PENDING
```

---

## Detail Checklist Per Fase

### Fase 1: Persiapan Lingkungan & Paket Fondasi
- [x] Diskusi dan persetujuan arsitektur bersama User (Next.js, Prisma, Supabase, Redis, Midtrans, SSE, shadcn).
- [x] Instalasi paket dependensi inti via `pnpm` (`next`, `zod`, `@prisma/client`, `@tanstack/react-query`, `@upstash/redis`, `next-auth`, `midtrans-client`, `clsx`, `tailwind-merge`, dll.).
- [x] Pemasangan `prisma` CLI dan approval build scripts di `.npmrc`.
- [x] Dokumentasi keputusan arsitektur (ADR-001) dan perapihan folder `docs/` berdasarkan kategori.

---

### Fase 2: Setup Database Supabase & Prisma
- [ ] User menyiapkan project database di [Supabase](https://supabase.com/) dan menyalin `DATABASE_URL`.
- [ ] Konfigurasi file `.env` lokal (`DATABASE_URL`, `DIRECT_URL`).
- [ ] Finalisasi `prisma/schema.prisma` (model `User`, `Court`, `CourtBlock`, `Booking`, `Payment`, `Review`, `Notification`).
- [ ] Eksekusi migrasi skema ke Supabase via `rtk pnpm exec prisma db push`.
- [ ] Pembuatan skrip seed data awal (`prisma/seed.ts`):
  - 3 Lapangan Padel (Indoor, Panoramic, Outdoor) lengkap dengan harga dan spesifikasi.
  - Akun pemilik/staf klub default untuk pengujian dashboard admin.
  - Kebijakan awal pembatalan dan durasi hold slot.

---

### Fase 3: Core API Backend (Next.js App Router)
- [ ] **Konektor Utilitas**:
  - `src/lib/prisma.ts` (klien Prisma singleton).
  - `src/lib/redis.ts` (klien Upstash Redis dengan fallback memori lokal).
  - `src/lib/midtrans.ts` (klien Snap/Core API Midtrans Sandbox).
- [ ] **Modul Validasi Zod** (`src/lib/validations/`):
  - Skema request booking, hold slot, checkout, dan autentikasi.
- [ ] **Route Handlers API**:
  - `POST /api/bookings/hold`: Atomic slot locking di Redis + insert record `HOLD`.
  - `POST /api/bookings/release`: Pelepasan slot manual jika batal memilih.
  - `GET /api/realtime/slots`: Endpoint SSE streaming status slot live.
  - `POST /api/payments/checkout`: Pembuatan sesi Snap token Midtrans (QRIS / VA).
  - `POST /api/payments/webhook`: Webhook listener konfirmasi bayar otomatis.
  - `GET /api/cron/sweep`: Pembersih otomatis slot kadaluarsa (> 10 menit).

---

### Fase 4: Migrasi Halaman UI & Komponen shadcn/ui
- [ ] Inisialisasi struktur `app/` App Router Next.js (`layout.tsx`, `providers.tsx`).
- [ ] Pemasangan komponen atomik shadcn/ui yang dibutuhkan:
  - `Button`, `Dialog`, `Sheet`, `Badge`, `Tabs`, `Calendar`, `Select`, `Sonner`.
- [ ] Migrasi rute publik:
  - `app/(public)/page.tsx` (Beranda / Landing Page).
  - `app/(public)/book/page.tsx` (Pemesanan Lapangan terhubung SSE Real-time).
  - `app/(public)/checkout/[id]/page.tsx` (Checkout & Layar Pembayaran QRIS Midtrans).
  - `app/(public)/bookings/page.tsx` (Tiket Saya, Reschedule, & Batal).
- [ ] Migrasi portal pengelola:
  - `app/admin/...` (Dashboard Operasional, Jadwal Lapangan, Transaksi, Tim).

---

### Fase 5: Pengujian Bersama & Deploy ke Vercel
- [ ] Uji skenario *concurrency*: Membuka 2 browser berbeda untuk klik slot yang sama secara bersamaan.
- [ ] Uji pembayaran sukses menggunakan simulator Midtrans Sandbox.
- [ ] Typecheck penuh: `rtk pnpm exec tsc --noEmit`.
- [ ] Build lokal: `rtk pnpm build`.
- [ ] Penyiapan environment variables di dashboard Vercel.
- [ ] Deployment live ke Vercel dan verifikasi status produksi.
