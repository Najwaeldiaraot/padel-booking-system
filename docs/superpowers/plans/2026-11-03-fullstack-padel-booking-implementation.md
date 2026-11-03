# Fullstack Padel Booking & Payment Implementation Plan (Frontend-First to E2E)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun aplikasi booking lapangan padel modern komersial mulai dari instalasi package, migrasi ke Next.js 16 App Router, merancang tampilan Frontend responsif (slot grid & sticky checkout bar), menghubungkan logic Backend & Database, hingga pengujian otomatis menyeluruh dengan Playwright E2E (tanpa perlu klik manual).

**Alur Eksekusi (Human-Centric & Visual-First):**
```
Fase 0: Package Setup & Verifikasi pnpm install
  ↓
Fase 1: Migrasi Next.js & Pembuatan Frontend Lengkap (Landing, Booking Slot Grid, Drawer, Admin UI)
  ↓
Fase 2: Backend Logic (Route Handlers, Server Actions, SSE Realtime, Midtrans Handler)
  ↓
Fase 3: Database PostgreSQL (Supabase) + Prisma Seeding + Redis Concurrency Engine
  ↓
Fase 4: Playwright E2E Automated Testing (Multi-user concurrency, booking, payment, admin flow)
```

**Spec:** [PRD Booking Padel](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/01-product/PRD-Booking-Padel.md), [ADR-001 Tech Stack](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/02-architecture/ADR-001-techstack-modern-fullstack.md), [Frontend-Backend Contract](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/03-technical-specs/frontend-backend-contract.md).

---

### Fase 0: Setup Package, Scripts & Verifikasi Instalasi

**Files:**
- Modify: `package.json`
- Modify: `.npmrc`
- Verify: `pnpm-lock.yaml`

- [ ] **Step 0.1: Tambahkan `@playwright/test` dan sesuaikan scripts `package.json`**
  Ubah scripts dari Vite ke Next.js:
  ```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test:e2e": "playwright test",
    "test:unit": "vitest run"
  }
  ```
  Install `@playwright/test` ke devDependencies.

- [ ] **Step 0.2: Eksekusi `rtk pnpm install` dan verifikasi integritas dependensi**
  Pastikan semua package (Next 16, React 19, Tailwind v4, Prisma, Radix UI, TanStack Query, Playwright) terinstal tanpa error atau dependency conflict.

- [ ] **Step 0.3: Setup browser engine Playwright**
  Jalankan `rtk pnpm exec playwright install chromium` untuk engine headless testing.

---

### Fase 1: Migrasi Struktur Next.js 16 & Pembangunan Frontend (Visual-First)

**Files:**
- Create: `next.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css` (Tailwind v4)
- Create: `src/components/layout/Navbar.tsx` & `Footer.tsx`
- Create: `src/app/page.tsx` (Modern Landing Page Padel Arena)
- Create: `src/app/booking/page.tsx` (Interactive Court & Slot Booking)
  - `src/components/booking/CourtSelector.tsx` (Pilihan Court Indoor/Panoramic/Outdoor)
  - `src/components/booking/TimeSlotGrid.tsx` (Grid jam 06:00 - 23:00, visual status Available/Locked/Booked)
  - `src/components/booking/StickyCheckoutBar.tsx` (Mobile bottom drawer: total jam, harga, countdown)
- Create: `src/app/admin/courts/page.tsx` (Admin Schedule & Court Management UI)
- Create: `src/app/auth/login/page.tsx` (Login & Register Modal/Page)

- [ ] **Step 1.1: Konfigurasi `next.config.ts` dan global layout Next.js**
  Hapus shell Vite lama (`index.html`, `vite.config.ts`, `src/main.tsx`) dan aktifkan Next.js App Router root layout dengan font inter dan provider TanStack Query.

- [ ] **Step 1.2: Bangun Landing Page Padel Arena yang estetik (`/`)**
  Hero section dengan visual lapangan modern, fitur keunggulan, daftar lapangan, dan CTA "Booking Sekarang".

- [ ] **Step 1.3: Bangun Halaman Booking Lapangan Utama (`/booking`)**
  - Pemilihan tanggal (kalender interaktif).
  - Tab pilihan lapangan dengan info spesifikasi (indoor/outdoor, tipe rumput, pencahayaan).
  - Grid time-slot interaktif (visual: Hijau = Siap Booking, Kuning = Sedang Dipilih/Kunci, Abu-abu = Penuh).
  - Sticky checkout bar responsif di bagian bawah layar HP dengan ringkasan durasi dan total harga.

- [ ] **Step 1.4: Bangun Halaman Dashboard Admin (`/admin/courts`)**
  Tampilan matriks jadwal semua lapangan, tombol pemblokiran darurat (hujan/turnamen), dan ringkasan pemesanan hari ini.

- [ ] **Step 1.5: Verifikasi Frontend Berjalan Lancar**
  Jalankan `rtk pnpm build` atau verifikasi preview dev untuk memastikan seluruh halaman UI bebas dari error TypeScript dan rendering CSS Tailwind v4 sempurna.

---

### Fase 2: Backend Logic, Realtime Engine & Payment Integration

**Files:**
- Create: `src/app/api/courts/route.ts` (API daftar lapangan & ketersediaan)
- Create: `src/app/api/slots/lock/route.ts` (API penguncian slot sementara 10 menit)
- Create: `src/app/api/slots/realtime/route.ts` (Server-Sent Events / SSE stream status slot)
- Create: `src/app/api/payment/charge/route.ts` (Midtrans Snap Token Generator)
- Create: `src/app/api/payment/webhook/route.ts` (Midtrans Webhook dengan Idempotency & SHA512 Signature)
- Create: `src/auth.ts` & `src/middleware.ts` (Auth.js v5 RBAC)

- [ ] **Step 2.1: Implementasi API Slots & SSE Realtime Stream**
  Endpoint yang memancarkan perubahan status slot waktu seketika ke seluruh pengguna yang sedang membuka halaman booking.

- [ ] **Step 2.2: Implementasi Midtrans Snap & Idempotent Webhook Handler**
  Menghasilkan token pembayaran Snap Sandbox dan memproses callback webhook secara aman dengan verifikasi signature.

- [ ] **Step 2.3: Implementasi Autentikasi & RBAC Middleware**
  Proteksi rute `/admin/*` dan penyediaan sesi pengguna untuk menyimpan riwayat booking.

---

### Fase 3: Integrasi Database PostgreSQL (Supabase) & Redis Locking

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `src/lib/redis.ts` (Atomic distributed lock: `SET slot:... userId NX PX 600000`)
- Setup: `.env` (Supabase connection string & Redis tokens)

- [ ] **Step 3.1: Konfigurasi ENV Database & Redis**
  Memasukkan kredensial koneksi database Supabase dan Upstash Redis.

- [ ] **Step 3.2: Eksekusi `prisma db push` dan Seeding Data**
  Sinkronisasi skema tabel `User`, `Court`, `Booking`, `Payment` ke Supabase dan seed data awal (3 lapangan padel + 1 akun admin default).

- [ ] **Step 3.3: Hubungkan Data Access Layer (DAL) ke Frontend**
  Ganti mock data di Frontend dengan data real dari Prisma dan Upstash Redis.

---

### Fase 4: Playwright E2E Automated Testing (Bebas Klik Manual)

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/01-landing-and-navigation.spec.ts`
- Create: `tests/e2e/02-booking-slot-selection.spec.ts`
- Create: `tests/e2e/03-concurrency-double-booking.spec.ts` (Multi-browser simultaneous click)
- Create: `tests/e2e/04-payment-checkout-simulation.spec.ts`
- Create: `tests/e2e/05-admin-court-override.spec.ts`

- [ ] **Step 4.1: Konfigurasi Playwright Test Runner**
  Headless browser mode, simulasi desktop dan mobile viewport.

- [ ] **Step 4.2: Jalankan Skenario E2E Otomatis**
  Playwright akan secara otomatis:
  1. Membuka halaman landing dan navigasi ke booking.
  2. Memilih tanggal, memilih lapangan, dan memilih slot waktu.
  3. Membuka browser kedua di detik yang sama untuk **menguji pencegahan double-booking**.
  4. Melakukan simulasi klik bayar Midtrans dan verifikasi status booking berubah jadi Lunas.
  5. Login sebagai admin dan memblokir slot lapangan.

- [ ] **Step 4.3: Eksekusi Final Audit**
  Run: `rtk pnpm test:e2e`
  Expected: **Semua skenario hijau (PASS)** tanpa perlu klik manual satu kali pun.
