# Dokumentasi Proyek — Booking Padel (Rally Padel Club)

Selamat datang di pusat dokumentasi resmi aplikasi web **Booking Padel (Rally Padel Club)**. Direktori ini disusun rapi berdasarkan **kategori fungsional** agar seluruh dokumen mudah ditelusuri.

---

## 📂 Struktur Direktori Dokumentasi

```
docs/
├── README.md                                    # Pusat Navigasi & Indeks Utama
│
├── 01-product/                                  # Kebutuhan Produk & Bisnis
│   └── PRD-Booking-Padel.md                     # Product Requirement Document (5 Epic MVP)
│
├── 02-architecture/                             # Keputusan Arsitektur Sistem
│   └── ADR-001-techstack-modern-fullstack.md   # Catatan Keputusan Tech Stack Fullstack
│
├── 03-technical-specs/                          # Spesifikasi Teknis & Kontrak API
│   ├── frontend-backend-contract.md             # Kontrak Endpoint API, Payload, & Error Codes
│   └── realtime-slot-locking-spec.md            # Spesifikasi Atomic Lock Redis & SSE Real-time
│
└── 04-roadmap/                                  # Manajemen Proyek & Eksekusi
    └── migration-roadmap.md                     # Peta Jalan & Checklist Progres Fase 1 - 5
```

---

## 📚 Indeks Dokumen Berdasarkan Kategori

### 1. Kategori: Kebutuhan Produk & Bisnis
- **[`01-product/PRD-Booking-Padel.md`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/01-product/PRD-Booking-Padel.md)**
  - Memuat *Product Requirement Document* (PRD) versi 1.0.
  - Menjelaskan masalah yang diselesaikan, persona (`player`, `venue_owner`, `platform_admin`), batasan MVP 14 minggu, kriteria penerimaan, dan definisi selesai (*Definition of Done*).

### 2. Kategori: Keputusan Arsitektur (*Architecture Decision Records*)
- **[`02-architecture/ADR-001-techstack-modern-fullstack.md`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/02-architecture/ADR-001-techstack-modern-fullstack.md)**
  - Mendokumentasikan keputusan resmi migrasi ke:
    - **Fullstack Next.js 15/16 App Router + React 19**
    - **Prisma ORM (v6) + PostgreSQL (Supabase)**
    - **Upstash Redis (Atomic Slot Locking 10 Menit)**
    - **Server-Sent Events (SSE Real-Time Broadcast)**
    - **FULL shadcn/ui + Tailwind CSS v4**
    - **Auth.js v5 (NextAuth)**
    - **Midtrans Sandbox (Payment Gateway 100% Gratis)**
    - **Vercel Cron Sweeper**

### 3. Kategori: Spesifikasi Teknis & Kontrak Integrasi
- **[`03-technical-specs/frontend-backend-contract.md`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/03-technical-specs/frontend-backend-contract.md)**
  - Rincian kontrak API antara frontend dan backend, struktur payload request/response, penanganan error terstandar (`ApiError`), dan siklus audit trail booking.
- **[`03-technical-specs/realtime-slot-locking-spec.md`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/03-technical-specs/realtime-slot-locking-spec.md)**
  - Penjelasan teknis pencegahan bentrok jadwal (*zero double booking*) menggunakan pola atomik Redis `SETNX EX 600`, format payload SSE stream, dan alur pelepasan kunci saat batal atau bayar sukses.

### 4. Kategori: Peta Jalan & Pelacakan Progres
- **[`04-roadmap/migration-roadmap.md`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/04-roadmap/migration-roadmap.md)**
  - Peta jalan migrasi lengkap dari Fase 1 hingga Fase 5 beserta daftar periksa (*checklist*) interaktif untuk memantau status pengerjaan setiap fitur.

---

## 🧭 Panduan Cepat Menelusuri

1. **Ingin memahami aturan bisnis & alur booking pengguna?** Buka [`01-product/PRD-Booking-Padel.md`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/01-product/PRD-Booking-Padel.md).
2. **Ingin tahu kenapa stack baru dipilih dan apa saja fiturnya?** Buka [`02-architecture/ADR-001-techstack-modern-fullstack.md`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/02-architecture/ADR-001-techstack-modern-fullstack.md).
3. **Ingin tahu detail implementasi kunci slot anti-bentrok?** Buka [`03-technical-specs/realtime-slot-locking-spec.md`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/03-technical-specs/realtime-slot-locking-spec.md).
4. **Ingin memeriksa progres pengerjaan atau langkah berikutnya?** Buka [`04-roadmap/migration-roadmap.md`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/docs/04-roadmap/migration-roadmap.md).
