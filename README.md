# 🎾 Rally Padel Club — Premium Court Booking & Venue Management System

Aplikasi pemesanan lapangan padel modern dengan arsitektur fullstack, dirancang untuk memberikan pengalaman booking mewah, anti-bentrok (*zero double-booking*), integrasi pembayaran QRIS instan, tiket digital dinamis, dan sistem manajemen operasional klub langsung (*Live Board & Scanner*).

---

## ✨ Fitur Unggulan

- **🛡️ Zero Double-Booking Engine**: Penguncian slot real-time berbasis **Upstash Redis Atomic Locks (`SETNX EX 600`)** yang menjamin tidak ada dua pengguna memilih jadwal yang sama.
- **⚡ Midtrans QRIS v2 & Auto-Simulator**: Integrasi QRIS resmi dengan simulasi pelunasan instan 1-klik di sandbox dan dukungan simulator Midtrans v2.
- **📱 Live Board & Real-Time Barcode Scanner**: Dashboard operasional staf dengan scanner kamera langsung (`getUserMedia` + `BarcodeDetector API`) untuk check-in pemain di venue.
- **🎟️ E-Invoice & Official Pass 1 Lembar**: Bukti reservasi siap cetak dengan tata letak satu halaman terisolasi dan kode QR dinamis.
- **✉️ Transactional OTP via Resend**: Pengiriman kode OTP 6-digit langsung ke email pemain untuk alur pendaftaran mandiri dan reset password.
- **🔒 Keamanan Berstandar Tinggi**: Enkripsi PII kontak pemain berbasis AES-256-GCM dengan blind-indexing untuk privasi data tanpa mengorbankan performa pencarian.
- **🎨 Luxury Minimalist UI**: Desain editorial padel mewah bernuansa forest deep dan sage, tipografi bersih `DM Sans`, kartu kontras tinggi, dan 100% Lucide Icons.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Database**: PostgreSQL (Supabase) via Prisma ORM (v6)
- **Cache & Real-Time Lock**: Upstash Redis (Serverless REST API)
- **Payment Gateway**: Midtrans Core API (QRIS Sandbox v2)
- **Transactional Email**: Resend API
- **Styling**: Tailwind CSS v4 + Motion
- **Testing**: Vitest (Unit Tests) + Playwright (End-to-End Tests)

---

## 🚀 Panduan Setup Cepat

Untuk panduan konfigurasi lengkap (Supabase, Upstash Redis, Midtrans Sandbox, Resend Email, dan database migration), silakan baca:
👉 **[PANDUAN SETUP LENGKAP (docs/SETUP_GUIDE.md)](docs/SETUP_GUIDE.md)**

### Langkah Singkat:
1. **Clone & Install Dependensi**:
   ```bash
   git clone <repo-url>
   cd PADEL
   pnpm install
   ```

2. **Atur Environment Variables**:
   Salin `.env.example` ke `.env` dan lengkapi nilainya:
   ```bash
   cp .env.example .env
   ```

3. **Sinkronkan Database**:
   ```bash
   pnpm dlx prisma db push
   pnpm dlx prisma generate
   ```

4. **Jalankan Server**:
   ```bash
   pnpm dev
   ```
   Aplikasi dapat diakses di `http://localhost:3000`.

---

## 🧪 Pengujian & Verifikasi Kualitas

Aplikasi telah dilengkapi dengan suite pengujian otomatis yang komprehensif:

```bash
# Validasi Type Safety TypeScript
pnpm typecheck

# Jalankan Unit Tests (Vitest)
pnpm test

# Jalankan Seluruh Suite E2E Tests (Playwright)
pnpm exec playwright test
```

---

## 📂 Struktur Dokumentasi Proyek

Dokumentasi arsitektur dan spesifikasi produk dikelompokkan dalam folder `docs/`:
- [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md): Panduan lengkap konfigurasi cloud & environment.
- [`docs/01-product/PRD-Booking-Padel.md`](docs/01-product/PRD-Booking-Padel.md): Product Requirement Document (PRD).
- [`docs/02-architecture/ADR-001-techstack-modern-fullstack.md`](docs/02-architecture/ADR-001-techstack-modern-fullstack.md): Architecture Decision Record (ADR).
- [`docs/03-technical-specs/realtime-slot-locking-spec.md`](docs/03-technical-specs/realtime-slot-locking-spec.md): Spesifikasi Redis Atomic Slot Locking.
- [`docs/03-technical-specs/frontend-backend-contract.md`](docs/03-technical-specs/frontend-backend-contract.md): Kontrak API Frontend-Backend.
