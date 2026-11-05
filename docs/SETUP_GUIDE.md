# Panduan Setup Lengkap (Full Setup Guide) — Rally Padel Club

Dokumen ini berisi panduan end-to-end untuk mempersiapkan seluruh infrastruktur cloud, database, payment gateway, cache, dan email agar aplikasi **Rally Padel Club** dapat dijalankan dari nol baik di lingkungan lokal (*development*) maupun di server *production*.

---

## Daftar Isi
1. [Prasyarat Sistem](#1-prasyarat-sistem)
2. [Setup Supabase (PostgreSQL & Prisma)](#2-setup-supabase-postgresql--prisma)
3. [Setup Upstash Redis (Atomic Slot Locking)](#3-setup-upstash-redis-atomic-slot-locking)
4. [Setup Midtrans Sandbox (Payment Gateway QRIS v2)](#4-setup-midtrans-sandbox-payment-gateway-qris-v2)
5. [Setup Resend (Transactional Email & OTP)](#5-setup-resend-transactional-email--otp)
6. [Konfigurasi Environment (.env)](#6-konfigurasi-environment-env)
7. [Menjalankan Aplikasi & Pengujian](#7-menjalankan-aplikasi--pengujian)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)

---

## 1. Prasyarat Sistem

Pastikan perangkat Anda telah terpasang:
- **Node.js**: Versi `>= 20.x` (Direkomendasikan Node.js v24 LTS).
- **pnpm**: Versi `>= 9.x` (`npm install -g pnpm`).
- **Git**: Untuk version control.

---

## 2. Setup Supabase (PostgreSQL & Prisma)

Aplikasi ini menggunakan **Prisma ORM** yang terhubung ke basis data **PostgreSQL di Supabase**.

### Langkah 1: Buat Proyek Supabase
1. Buka [Supabase Dashboard](https://supabase.com/dashboard) dan buat organisasi/proyek baru (misal: `padel-arena`).
2. Masukkan nama database dan simpan kata sandi database (`[DB_PASSWORD]`) di tempat yang aman.
3. Pilih region terdekat (misal: `Singapore (ap-southeast-1)`).

### Langkah 2: Ambil Connection String
Buka menu **Project Settings -> Database** di dashboard Supabase:
1. **Transaction Pooler URL (`DATABASE_URL`)**:
   - Di bagian *Connection String*, pilih tab **URI** dan centang **Use connection pooling**.
   - Mode: **Transaction** (Port: `6543`).
   - Format:
     ```env
     DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[DB_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
     ```
2. **Direct Connection URL (`DIRECT_URL`)**:
   - Di bagian *Connection String*, pilih tab **URI** tanpa pooling (atau mode Session port `5432`).
   - Format:
     ```env
     DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[DB_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
     ```

### Langkah 3: Eksekusi Migrasi Skema Prisma
Jalankan perintah berikut di terminal proyek:
```bash
# Sinkronkan skema Prisma langsung ke database Supabase
pnpm dlx prisma db push

# Generate client Prisma terbaru
pnpm dlx prisma generate
```

Skema akan membuat tabel:
- `users`: Akun pengguna, peran (`player`, `staff`, `owner`), dan password hash Argon2/Bcrypt.
- `courts`: Data lapangan padel (Panoramic, Garden, Covered) dengan harga per jam.
- `court_blocks`: Data pemblokiran lapangan untuk jadwal perawatan.
- `bookings`: Catatan transaksi booking, status (`CONFIRMED`, `PENDING_PAYMENT`, `COMPLETED`, dll.).
- `payments`: Data pembayaran Midtrans, snap token, order ID, dan status transaksi.
- `customers`: Data agregat pemain dengan enkripsi AES-256-GCM.

---

## 3. Setup Upstash Redis (Atomic Slot Locking)

Aplikasi ini menggunakan **Upstash Redis Serverless** via REST API untuk menjamin **Zero Double-Booking** melalui penguncian slot atomik 10 menit (`SETNX EX 600`) serta pencegahan brute-force OTP.

### Langkah 1: Buat Database Redis di Upstash
1. Buka [Upstash Console](https://console.upstash.com) dan buat akun gratis.
2. Klik tombol **Create Database**:
   - Name: `padel-slot-lock`
   - Type: `Regional`
   - Region: `ap-southeast-1 (Singapore)`
   - TLS: Enabled
   - Eviction: No Eviction

### Langkah 2: Ambil Kunci REST API
1. Pada detail database yang baru dibuat, gulir ke bagian **REST API**.
2. Salin nilai:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### Cara Kerja di Balik Layar:
- **Slot Locking**: Ketika pemain memilih slot dan lanjut ke pembayaran, Redis mengunci slot dengan kunci `lock:court:{courtId}:{date}:{time}` dengan masa aktif (TTL) 600 detik (10 menit).
- **Auto-Release**: Jika pemain membatalkan atau tidak menyelesaikan pembayaran dalam 10 menit, kunci otomatis hangus dan slot kembali terbuka untuk pemain lain.
- **OTP Brute-Force Protection**: Setiap percobaan OTP yang salah akan dihitung (`otp:attempts:{email}`). Jika mencapai 5 kali, akun dikunci sementara selama 15 menit.

---

## 4. Setup Midtrans Sandbox (Payment Gateway QRIS v2)

Pembayaran menggunakan **Midtrans QRIS v2 Core API (Sandbox)** yang mendukung pemindaian langsung melalui aplikasi e-wallet (BCA, GoPay, ShopeePay, Dana, OVO, LinkAja) atau Mobile Banking.

### Langkah 1: Buat Akun Midtrans Sandbox
1. Daftar di [Midtrans Sandbox Portal](https://dashboard.sandbox.midtrans.com).
2. Pastikan lingkungan di sudut kiri atas berlabel **Sandbox**.

### Langkah 2: Ambil Server Key & Client Key
1. Buka menu **Settings -> Access Keys**.
2. Salin nilai:
   - `Server Key` -> Masukkan ke `MIDTRANS_SERVER_KEY`
   - `Client Key` -> Masukkan ke `MIDTRANS_CLIENT_KEY` dan `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`
   - Set `MIDTRANS_IS_PRODUCTION="false"`

### Langkah 3: Konfigurasi Webhook / Notification URL
1. Buka menu **Settings -> Configuration**.
2. Pada kolom **Payment Notification URL**, isi dengan:
   - Di lingkungan lokal (menggunakan ngrok / cloudflared): `https://subdomain.ngrok-free.app/api/payment/webhook`
   - Di server produksi: `https://domain-anda.com/api/payment/webhook`
3. Centang opsi QRIS dan selesaikan penyimpanan.

### Langkah 4: Pengujian Pembayaran di Sandbox
Terdapat 2 cara melakukan simulasi pembayaran di lingkungan Sandbox:
* **Cara 1 (1-Klik Otomatis - Direkomendasikan)**:
  Di halaman checkout, cukup klik tombol hijau **"Bayar Otomatis (Midtrans Sandbox)"**. Sistem akan secara otomatis berinteraksi dengan API simulasi Midtrans v2 di latar belakang dan mengubah status booking menjadi `settlement` (lunas) seketika.
* **Cara 2 (Manual via Midtrans Simulator v2)**:
  1. Klik tombol **"Salin URL QR"** di halaman checkout.
  2. Buka simulator resmi Midtrans di `https://simulator.sandbox.midtrans.com/v2/qris/index`.
  3. Tempelkan URL gambar QR tersebut ke kolom input dan klik tombol **Pay**.
  4. Halaman checkout akan otomatis mendeteksi status pelunasan.

---

## 5. Setup Resend (Transactional Email & OTP)

Aplikasi mengirimkan kode OTP 6-digit saat registrasi pemain dan reset password, serta konfirmasi tiket resmi (*E-Invoice*) langsung ke email pengguna.

### Langkah 1: Buat Akun & Ambil API Key Resend
1. Buka [Resend Console](https://resend.com) dan buat akun.
2. Buka menu **API Keys** -> **Create API Key**.
3. Beri nama (misal: `padel-app`) dengan izin `Full Access`.
4. Salin API Key yang diawali dengan `re_...` ke `RESEND_API_KEY`.

### Langkah 2: Konfigurasi Pengirim (`EMAIL_FROM`)
* **Lingkungan Development**:
  Anda dapat langsung menggunakan domain sandbox default bawaan Resend tanpa verifikasi domain DNS:
  ```env
  EMAIL_FROM="Rally Padel Club <onboarding@resend.dev>"
  ```
  *(Catatan Resend: Pada akun gratis tanpa verifikasi domain, email hanya dapat dikirimkan ke alamat email yang Anda gunakan saat mendaftar akun Resend).*
* **Lingkungan Production**:
  1. Buka menu **Domains** di Resend dan tambahkan domain Anda (misal: `rallypadel.com`).
  2. Tambahkan DNS records (DKIM, SPF, MX) di penyedia DNS Anda (Cloudflare, Namecheap, dsb.).
  3. Setelah terverifikasi, ubah `EMAIL_FROM` menjadi:
     ```env
     EMAIL_FROM="Rally Padel Club <reservasi@rallypadel.com>"
     ```

---

## 6. Konfigurasi Environment (.env)

Salin file contoh template `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Isi seluruh nilainya sesuai panduan di atas:
```env
# ==============================================================================
# RALLY PADEL CLUB - ENVIRONMENT CONFIGURATION
# ==============================================================================

# 1. DATABASE: SUPABASE POSTGRESQL (VIA PRISMA ORM)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# 2. CACHE & ATOMIC LOCKING: UPSTASH REDIS
UPSTASH_REDIS_REST_URL="https://[YOUR-INSTANCE].upstash.io"
UPSTASH_REDIS_REST_TOKEN="[YOUR-REST-TOKEN]"

# 3. PAYMENT GATEWAY: MIDTRANS SANDBOX
MIDTRANS_SERVER_KEY="SB-Mid-server-..."
MIDTRANS_CLIENT_KEY="Mid-client-..."
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="Mid-client-..."
MIDTRANS_IS_PRODUCTION="false"

# 4. APLIKASI & KEAMANAN ENKRIPSI
NEXTAUTH_SECRET="your-super-secret-random-key-at-least-32-chars-long"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# 5. EMAIL TRANSACTIONAL & OTP: RESEND
RESEND_API_KEY="re_..."
EMAIL_FROM="Rally Padel Club <onboarding@resend.dev>"
```

---

## 7. Menjalankan Aplikasi & Pengujian

### Menjalankan Server Pengembangan:
```bash
pnpm dev
```
Buka browser pada alamat [http://localhost:3000](http://localhost:3000).

### Akun Bawaan Sistem:
* **Admin / Staf**: Buka `/admin` -> Login dengan akun staf (default: `staff@rallypadel.com` / `admin123456`).
* **Pemain**: Buka `/book` -> Registrasi mandiri menggunakan email pemain (akan menerima OTP verifikasi).

### Menjalankan Suite Pengujian Otomatis:
```bash
# 1. Validasi tipe TypeScript (harus 0 error)
pnpm typecheck

# 2. Unit tests (Vitest)
pnpm test

# 3. End-to-End tests (Playwright)
pnpm exec playwright test
```

---

## 8. Troubleshooting & FAQ

#### Q: Mengapa slot di halaman booking `/book` tercoret padahal di kalender admin kosong?
> **Jawab**: Ada booking berstatus `PENDING_PAYMENT` lama yang ditinggalkan saat checkout. Sistem telah dilengkapi *auto-expiry sweeper* yang otomatis mengembalikan statusnya ke `EXPIRED` dan membuka slot kembali setelah 10 menit. Jika ingin membebaskan secara instan, Anda juga bisa menekan tombol ubah tanggal atau memuat ulang halaman.

#### Q: Tombol "Ubah Jadwal" tidak bisa diklik di halaman booking pemain?
> **Jawab**: Aturan standar klub menetapkan perubahan jadwal mandiri dapat dilakukan maksimal **2 jam sebelum jadwal main** (`policy.rescheduleHours = 2`). Jika jadwal main kurang dari 2 jam lagi, tombol terkunci otomatis demi kepastian operasional klub. Durasi toleransi ini dapat disesuaikan pengelola kapan saja di menu **Admin -> Pengaturan & Kebijakan**.

#### Q: Simulasi QRIS Midtrans muncul "Transaction is unsuccessful" di simulator lama?
> **Jawab**: Gunakan Simulator v2 resmi Midtrans di `https://simulator.sandbox.midtrans.com/v2/qris/index` dengan menempelkan URL gambar QR, atau gunakan tombol instan **"Bayar Otomatis (Midtrans Sandbox)"** yang langsung disediakan di aplikasi.
