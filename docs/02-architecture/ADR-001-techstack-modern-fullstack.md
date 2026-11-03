# ADR-001: Migrasi Arsitektur ke Fullstack Next.js, Prisma, Supabase, Redis, & Midtrans

- **Status**: Diterima (Accepted)
- **Tanggal**: 2026-11-03
- **Pemilik Keputusan**: User & Antigravity AI
- **Cakupan**: Seluruh arsitektur aplikasi web Booking Padel (Rally Padel Club)

---

## 1. Konteks & Latar Belakang

Aplikasi sebelumnya dibangun sebagai Single Page Application (SPA) berbasis Vite 8 + React 19 dengan adapter data lokal (`localStorage`) pada `src/app/api.ts`. 

Untuk menuju tahap produksi siap rilis, sistem memerlukan:
1. Backend persisten dengan database relasional ACID untuk pencatatan transaksi dan booking.
2. Mekanisme pencegahan *double booking* berkecepatan tinggi saat banyak pemain memilih slot lapangan yang sama secara bersamaan (*race condition*).
3. Pembaruan ketersediaan slot secara langsung (*real-time*) di layar pengguna tanpa *delay* polling.
4. Gateway pembayaran lokal Indonesia yang memiliki lingkungan uji coba 100% gratis (*sandbox*).
5. Infrastruktur terpusat yang tidak berserakan (*single-dashboard-first*) dan siap di-*deploy* ke Vercel.

---

## 2. Keputusan yang Disepakati

Kami memutuskan untuk mengadopsi tumpukan teknologi (*tech stack*) modern berikut:

### 2.1 Core Framework & Bahasa
- **Next.js 15/16 (App Router)** + **React 19** + **TypeScript 5.7**:
  - Menggantikan bundler Vite dan router client-side `react-router v7`.
  - Menggunakan struktur folder `app/(public)/...` untuk portal pemain dan `app/admin/...` untuk manajemen klub.
  - Server Actions dan Route Handlers (`app/api/...`) untuk operasi backend.

### 2.2 Database & ORM
- **PostgreSQL (via Supabase)**:
  - Database relasional utama untuk menyimpan entitas bisnis (`users`, `courts`, `court_blocks`, `bookings`, `booking_histories`, `payments`, `reviews`, `notifications`).
  - Menjamin integritas data transaksi perbankan dan riwayat booking dengan ACID.
- **Prisma ORM (v6)**:
  - *Type-safe database client* dengan skema deklaratif (`prisma/schema.prisma`).
  - Dilengkapi migrasi otomatis (`prisma db push` / `prisma migrate`) dan Prisma Studio untuk inspeksi data visual.

### 2.3 Cache, Kunci Slot Atomik, & Real-Time Sync
- **Upstash Redis (`@upstash/redis`)**:
  - Berperan sebagai lapisan *distributed lock* in-memory super cepat (< 2 milidetik).
  - Menggunakan pola atomik `SET slot:{courtId}:{date}:{time} {userId} NX EX 600` (kunci slot 10 menit).
  - Terintegrasi 1-klik di Vercel Marketplace (lingkungan serverless berbasis REST HTTP, bebas kehabisan koneksi pool TCP).
- **Server-Sent Events (SSE)** via Next.js Route Handler:
  - Endpoint `/api/realtime/slots` yang menyiarkan perubahan status slot secara *real-time* ke browser seluruh pengguna saat ada pemain yang mengunci/melepas slot.

### 2.4 Antarmuka Pengguna & Komponen
- **FULL shadcn/ui** + **Tailwind CSS v4** + **Lucide React** + **Motion (Framer Motion)**:
  - Mengadopsi komponen UI aksesibel berbasis Radix UI (`Dialog`, `Sheet`, `Select`, `Calendar`, `Badge`, `Tabs`, `DropdownMenu`).
  - Toast notifikasi modern menggunakan `sonner`.
  - Mempertahankan tema desain kurasi (*terracotta, sage, warm stone, charcoal*) dan animasi transisi halus.

### 2.5 Validasi Data & Autentikasi
- **Zod Validation**:
  - Validasi skema input ketat untuk semua payload API, form booking, dan variabel lingkungan (`.env`).
- **Auth.js v5 (NextAuth)**:
  - Autentikasi multi-peran (`PLAYER`, `STAFF`, `OWNER`) dengan sesi berbasis JWT HTTP-Only yang aman.
  - Alur registrasi/login berbasis OTP dan nomor HP/email.

### 2.6 Gateway Pembayaran
- **Midtrans Sandbox**:
  - **100% Gratis** tanpa biaya registrasi atau transaksi selama tahap pengembangan.
  - Mendukung metode pembayaran lokal Indonesia (QRIS, BCA VA, Mandiri VA, BNI VA, BRI VA, GoPay, ShopeePay).
  - Integrasi webhook otomatis pada `/api/payments/webhook` dengan verifikasi signature SHA-512 dan sifat *idempotent*.

### 2.7 Pembersih Otomatis (Cron Sweeper)
- **Next.js Cron Route / Vercel Cron**:
  - Endpoint `/api/cron/sweep` yang dipicu secara berkala untuk melepaskan slot berstatus `HOLD` yang melewati batas waktu 10 menit tanpa pembayaran.

---

## 3. Konsekuensi & Dampak

### Positif (+):
- **Zero Double Booking**: Kunci slot Redis `SETNX` menjamin hanya satu pemain yang berhasil memesan slot tertentu pada milidetik yang sama.
- **Pengalaman Pengguna Instan**: Layar pemain lain langsung ter-update abu-abu (terkunci) saat ada pemain yang memilih slot tanpa perlu me-refresh halaman.
- **Ekosistem Satu Arah di Vercel**: Deployment satu atap di Vercel yang otomatis terhubung ke Upstash Redis dan Supabase.
- **Biaya Nol untuk Pengujian**: Supabase Free Tier + Upstash Free Tier + Midtrans Sandbox = Rp0 selama masa pengembangan.

### Penyesuaian yang Diperlukan (-):
- Perlu migrasi bertahap dari komponen rute `react-router` ke konvensi App Router Next.js (`page.tsx`, `layout.tsx`).
- Menambahkan penanda directive `'use client'` pada komponen interaktif yang menggunakan state browser atau animasi.
