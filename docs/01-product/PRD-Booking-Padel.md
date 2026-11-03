# PRD — Booking Padel (Web App)
**Product Requirement Document**
Versi: 1.0 — Draft dari Project Canvas
Target: Peluncuran versi beta dalam 14 minggu
Platform: **Web App** (responsive, desktop & mobile browser)

> Dokumen ini ditulis untuk dikonsumsi manusia maupun AI coding agent (Claude Code, Codex, Antigravity, dll). Setiap requirement diberi ID (`FR-xxx`, `US-xxx`, `NFR-xxx`) agar bisa dijadikan referensi commit/task/PR.

---

## 1. Ringkasan Produk

**Nama produk:** Booking Padel
**Deskripsi singkat:** Aplikasi web untuk booking lapangan padel secara online — menggantikan proses manual via telepon/WhatsApp yang lambat dan rawan bentrok jadwal (double booking).

**Masalah yang diselesaikan:**
- Booking manual lambat & human error tinggi
- Tidak ada sistem terpusat → jadwal sering bentrok
- Minim transparansi harga & ketersediaan slot
- Venue kehilangan potensi revenue karena slot kosong tidak terkelola
- Pemain sulit menemukan lapangan tersedia secara real-time

**Target pengguna utama:** masyarakat urban penggemar padel (butuh kepastian jadwal) dan pemilik venue kecil-menengah (UMKM olahraga) yang belum punya sistem booking digital.

---

## 2. Tujuan & Metrik Sukses (Beta)

| Tujuan | Metrik (indikatif) |
| --- | --- |
| Menghilangkan double booking | 0 kasus bentrok jadwal pada slot yang sudah dikonfirmasi |
| Mempercepat proses booking | Waktu booking-to-confirmation < 3 menit |
| Adopsi mitra venue awal | ≥ jumlah venue pilot yang disepakati sebelum minggu 14 onboard & aktif |
| Transaksi berhasil | Success rate pembayaran ≥ 95% (di luar kegagalan sisi user) |
| Stabilitas sistem | Uptime ≥ 99% selama masa beta, termasuk saat peak hour (sore/malam & akhir pekan) |

> **Catatan:** angka-angka di atas adalah target indikatif untuk diskusi tim, bukan angka final dari canvas — konfirmasi ke stakeholder sebelum dipakai sebagai OKR resmi.

---

## 3. Non-Goals (Out of Scope untuk Beta)

Eksplisit **tidak** dikerjakan pada versi ini (sesuai Project Canvas):
- Marketplace penjualan alat/perlengkapan padel
- Live streaming pertandingan
- Penyelenggaraan turnamen skala nasional
- Native mobile app (iOS/Android) — beta ini **web app only**, responsive di browser mobile

Fitur berikut ada di canvas sebagai *Nice to have* / *If possible* — dikategorikan **Phase 2 (pasca-beta)**, tidak masuk MVP 14 minggu kecuali disepakati ulang:
- Rating & ulasan venue/lapangan
- Fitur cari partner main (matchmaking)
- Membership & poin loyalitas
- Riwayat & statistik bermain pengguna
- Integrasi Google Calendar
- Rekomendasi jadwal/lapangan berbasis AI
- Live occupancy via sensor IoT

---

## 4. Persona Pengguna

### 4.1 Pemain Padel (`player`)
Individu/kelompok yang ingin booking lapangan dengan cepat dan pasti. Peduli pada: kecepatan cari slot kosong, transparansi harga, kepastian booking (tidak dobel), kemudahan pembayaran.

### 4.2 Pemilik / Pengelola Venue (`venue_owner`)
Mitra bisnis (umumnya UMKM olahraga) yang mengelola satu atau lebih venue & lapangan. Peduli pada: mengurangi slot kosong, kemudahan kelola jadwal manual/blokir, visibilitas transaksi & pendapatan.

### 4.3 Admin Platform (`platform_admin`)
Mengelola mitra (approval venue baru), memonitor transaksi, dan menangani dukungan pengguna/dispute.

---

## 5. Scope MVP (Beta — Must Have)

Sesuai Project Canvas, 5 area fitur wajib untuk beta:

1. Registrasi & login pengguna (email/HP, verifikasi OTP)
2. Pencarian lapangan padel & cek ketersediaan real-time
3. Booking & pembayaran online (payment gateway)
4. Notifikasi konfirmasi / pengingat jadwal booking
5. Dashboard admin: kelola venue, lapangan, jadwal, transaksi

Setiap area di-breakdown menjadi epic + user story di bagian 6.

---

## 6. User Stories & Acceptance Criteria

Format: `US-<epic>-<no>` — role — story — acceptance criteria.

### Epic A — Autentikasi & Onboarding

**US-A-01** — Sebagai *player*, saya ingin mendaftar dengan email/HP agar bisa membuat akun.
- [ ] Form registrasi menerima email **atau** nomor HP + password
- [ ] Validasi format email/HP dan kekuatan password minimal (≥8 karakter)
- [ ] Setelah submit, sistem mengirim kode OTP ke email/HP terdaftar
- [ ] Duplikasi email/HP yang sudah terdaftar ditolak dengan pesan jelas

**US-A-02** — Sebagai *player*, saya ingin memverifikasi OTP agar akun saya aktif.
- [ ] Input OTP 6 digit, expired dalam 5 menit
- [ ] Maksimal 5 kali percobaan salah sebelum OTP harus di-generate ulang
- [ ] Opsi "kirim ulang OTP" dengan cooldown 60 detik
- [ ] Setelah verifikasi sukses, akun berstatus `active` dan user otomatis login

**US-A-03** — Sebagai *player*, saya ingin login agar bisa mengakses akun saya.
- [ ] Login dengan email/HP + password
- [ ] Rate limiting untuk mencegah brute force (misal 5x gagal → lock 15 menit)
- [ ] Session token (JWT) disimpan aman (httpOnly cookie)

**US-A-04** — Sebagai *venue_owner*, saya ingin mendaftar sebagai mitra agar venue saya bisa masuk platform.
- [ ] Form pendaftaran mitra: data venue dasar (nama, alamat, kontak, dokumen pendukung opsional)
- [ ] Status akun mitra `pending_approval` sampai disetujui `platform_admin`
- [ ] Notifikasi ke mitra saat status berubah (approved/rejected)

---

### Epic B — Pencarian Lapangan & Ketersediaan

**US-B-01** — Sebagai *player*, saya ingin mencari venue berdasarkan lokasi/kota agar menemukan lapangan terdekat.
- [ ] Search & filter berdasarkan kota/area, nama venue
- [ ] Hasil menampilkan nama venue, alamat, rentang harga, rating (jika ada di Phase 2)

**US-B-02** — Sebagai *player*, saya ingin melihat ketersediaan slot lapangan secara real-time agar tidak booking slot yang sudah terisi.
- [ ] Kalender/slot per lapangan menampilkan status: `available`, `booked`, `blocked` (oleh admin venue)
- [ ] Data ketersediaan reflect perubahan booking lain secara near real-time (target refresh < 5 detik atau via polling/websocket)
- [ ] Slot yang sedang dalam proses checkout oleh user lain di-*hold* sementara (lihat NFR-03 & FR-12)

---

### Epic C — Booking & Pembayaran

**US-C-01** — Sebagai *player*, saya ingin memilih slot dan melakukan booking agar lapangan tersebut menjadi milik saya di jam tersebut.
- [ ] Pilih venue → lapangan → tanggal → jam → konfirmasi ringkasan (harga, durasi)
- [ ] Slot yang dipilih di-lock sementara (hold, default 10 menit) selama proses pembayaran berlangsung
- [ ] Jika pembayaran tidak selesai dalam waktu hold, slot otomatis kembali `available`

**US-C-02** — Sebagai *player*, saya ingin membayar booking secara online agar prosesnya cepat & aman.
- [ ] Integrasi payment gateway (mis. Midtrans/Xendit) — mendukung minimal VA bank & e-wallet
- [ ] Status pembayaran: `pending`, `success`, `failed`, `expired`
- [ ] Webhook dari gateway memperbarui status booking secara otomatis & idempotent (tidak dobel proses jika webhook terkirim >1 kali)

**US-C-03** — Sebagai *player*, saya ingin membatalkan booking (sesuai kebijakan) agar slot bisa dipakai orang lain.
- [ ] Pembatalan hanya diizinkan sebelum batas waktu tertentu (kebijakan venue, default X jam sebelum jadwal — **perlu konfirmasi nilai X**)
- [ ] Status booking berubah `cancelled`, slot kembali `available`
- [ ] Kebijakan refund (jika sudah bayar) — **open question**, lihat bagian 12

**US-C-04** — Sebagai *venue_owner*, saya ingin memblokir slot manual (maintenance, dipakai event internal) agar tidak bisa dibooking online.
- [ ] Admin venue bisa set slot/lapangan jadi `blocked` dengan alasan opsional
- [ ] Slot yang sudah `booked` tidak bisa diubah paksa jadi `blocked` tanpa penanganan konflik (butuh pembatalan booking dulu)

---

### Epic D — Notifikasi

**US-D-01** — Sebagai *player*, saya ingin menerima notifikasi konfirmasi booking agar yakin transaksi berhasil.
- [ ] Notifikasi terkirim segera setelah pembayaran `success` (channel: email minimal; SMS/WA — **open question**, lihat bagian 12)
- [ ] Isi notifikasi: nama venue, lapangan, tanggal, jam, total bayar, kode booking

**US-D-02** — Sebagai *player*, saya ingin menerima pengingat sebelum jadwal main agar tidak lupa.
- [ ] Reminder terkirim H-1 dan/atau beberapa jam sebelum jadwal (**konfirmasi timing**)
- [ ] Reminder tidak terkirim untuk booking yang sudah `cancelled`

**US-D-03** — Sebagai *venue_owner*, saya ingin mendapat notifikasi setiap ada booking baru agar bisa memantau tanpa buka dashboard terus-menerus.
- [ ] Notifikasi masuk (in-app dan/atau email) setiap booking baru berstatus `confirmed`

---

### Epic E — Dashboard Admin

**US-E-01** — Sebagai *platform_admin*, saya ingin menyetujui/menolak pendaftaran venue baru agar kualitas mitra terjaga.
- [ ] List mitra dengan status `pending_approval`
- [ ] Aksi approve/reject dengan catatan opsional
- [ ] Venue yang di-approve otomatis muncul di hasil pencarian pemain

**US-E-02** — Sebagai *venue_owner*, saya ingin mengelola data venue & lapangan saya agar informasi selalu akurat.
- [ ] CRUD venue (nama, alamat, deskripsi, foto, jam operasional)
- [ ] CRUD lapangan per venue (nama, tipe indoor/outdoor, harga per jam)

**US-E-03** — Sebagai *venue_owner* / *platform_admin*, saya ingin melihat daftar transaksi agar bisa rekonsiliasi pendapatan.
- [ ] List transaksi dengan filter tanggal, status, venue (untuk admin platform: semua venue; untuk venue_owner: venue miliknya saja)
- [ ] Detail transaksi menampilkan breakdown: harga booking, komisi platform (jika model komisi diterapkan)
- [ ] Export data transaksi (CSV minimal) — **nice to have, tandai sebagai stretch goal beta**

**US-E-04** — Sebagai *platform_admin*, saya ingin melihat ringkasan dashboard (jumlah venue aktif, booking hari ini, revenue) agar bisa memantau kesehatan platform secara sekilas.
- [ ] Widget ringkasan: total venue aktif, total booking (hari/minggu ini), total transaksi sukses vs gagal

---

## 7. Functional Requirements (Detail)

| ID | Requirement | Prioritas |
| --- | --- | --- |
| FR-01 | Sistem mendukung registrasi via email atau nomor HP | Must |
| FR-02 | Sistem mengirim & memvalidasi OTP untuk verifikasi akun | Must |
| FR-03 | Sistem mendukung 3 role: `player`, `venue_owner`, `platform_admin` dengan hak akses berbeda | Must |
| FR-04 | Pencarian venue berdasarkan kota/area & nama | Must |
| FR-05 | Tampilan ketersediaan slot lapangan per tanggal, real-time terhadap booking lain | Must |
| FR-06 | Slot yang sedang di-checkout (belum bayar) di-*hold* agar tidak double booking | Must |
| FR-07 | Booking otomatis expired & slot dilepas jika pembayaran tidak selesai dalam batas waktu hold | Must |
| FR-08 | Integrasi payment gateway dengan minimal 2 metode pembayaran (VA & e-wallet) | Must |
| FR-09 | Webhook payment gateway diproses idempotent (anti double-processing) | Must |
| FR-10 | Notifikasi konfirmasi booking terkirim otomatis setelah pembayaran sukses | Must |
| FR-11 | Notifikasi pengingat jadwal terkirim sebelum waktu main | Must |
| FR-12 | Venue owner dapat memblokir slot/lapangan secara manual | Must |
| FR-13 | Platform admin dapat approve/reject pendaftaran venue baru | Must |
| FR-14 | Dashboard admin menampilkan CRUD venue, lapangan, jadwal, dan daftar transaksi | Must |
| FR-15 | Sistem mencatat log status perubahan booking (audit trail minimal: created, paid, cancelled) | Must |
| FR-16 | *(Phase 2)* Rating & ulasan venue/lapangan | Nice to have |
| FR-17 | *(Phase 2)* Matchmaking partner main | Nice to have |
| FR-18 | *(Phase 2)* Membership & poin loyalitas | Nice to have |
| FR-19 | *(Phase 2)* Riwayat & statistik bermain pengguna | Nice to have |
| FR-20 | *(Phase 2)* Integrasi Google Calendar | If possible |
| FR-21 | *(Phase 2)* Rekomendasi jadwal berbasis AI | If possible |
| FR-22 | *(Phase 2)* Live occupancy via sensor IoT | If possible |

---

## 8. Data Model (Entitas Inti)

> Nama tabel/kolom bersifat saran (draft schema) — sesuaikan dengan konvensi ORM yang dipakai tim (mis. Drizzle/Prisma).

### `users`
| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid (PK) | |
| name | string | |
| email | string, unique, nullable | salah satu email/phone wajib ada |
| phone | string, unique, nullable | |
| password_hash | string | |
| role | enum(`player`,`venue_owner`,`platform_admin`) | |
| is_verified | boolean | hasil OTP |
| created_at / updated_at | timestamp | |

### `venues`
| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid (PK) | |
| owner_id | uuid (FK → users) | |
| name | string | |
| address | string | |
| city | string | untuk filter pencarian |
| description | text, nullable | |
| operating_hours | jsonb | jam buka per hari |
| status | enum(`pending_approval`,`active`,`rejected`,`suspended`) | |
| created_at / updated_at | timestamp | |

### `courts` (lapangan)
| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid (PK) | |
| venue_id | uuid (FK → venues) | |
| name | string | |
| type | enum(`indoor`,`outdoor`) | |
| price_per_hour | numeric | dalam IDR |
| status | enum(`active`,`inactive`) | |

### `slots` / `bookings`
Rekomendasi: gunakan model **booking sebagai sumber kebenaran** untuk slot terisi (bukan tabel slot statis terpisah), agar tidak perlu pre-generate jutaan baris slot kosong.

`bookings`
| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid (PK) | juga jadi kode booking (atau kolom terpisah `booking_code`) |
| user_id | uuid (FK → users) | |
| court_id | uuid (FK → courts) | |
| date | date | |
| start_time / end_time | time | |
| status | enum(`hold`,`pending_payment`,`confirmed`,`cancelled`,`expired`,`completed`) | |
| total_price | numeric | |
| hold_expires_at | timestamp, nullable | untuk mekanisme hold (FR-06/FR-07) |
| created_at / updated_at | timestamp | |

> **Constraint kritikal:** unique/exclusion constraint pada `(court_id, date, start_time, end_time)` untuk status `hold`/`pending_payment`/`confirmed` guna mencegah double booking di level database, bukan hanya di level aplikasi.

### `payments`
| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid (PK) | |
| booking_id | uuid (FK → bookings) | |
| gateway | string | mis. `midtrans`, `xendit` |
| gateway_ref | string | reference id dari gateway |
| amount | numeric | |
| status | enum(`pending`,`success`,`failed`,`expired`,`refunded`) | |
| paid_at | timestamp, nullable | |
| raw_webhook_payload | jsonb, nullable | untuk audit/debug |

### `notifications`
| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid (PK) | |
| user_id | uuid (FK → users) | |
| booking_id | uuid, nullable | |
| type | enum(`booking_confirmation`,`booking_reminder`,`venue_new_booking`,`venue_approval_status`) | |
| channel | enum(`email`,`sms`,`whatsapp`,`in_app`) | |
| status | enum(`queued`,`sent`,`failed`) | |
| sent_at | timestamp, nullable | |

*(Entitas Phase 2 — `reviews`, `matchmaking_requests`, `memberships`, `loyalty_points` — tidak dirinci di sini, dibuat saat fitur tersebut mulai dikerjakan.)*

---

## 9. API Outline (REST, draft)

> Base path contoh: `/api/v1`. Auth: Bearer JWT kecuali disebutkan publik.

### Auth
| Method | Endpoint | Deskripsi | Auth |
| --- | --- | --- | --- |
| POST | `/auth/register` | Registrasi user (player/venue_owner) | Publik |
| POST | `/auth/verify-otp` | Verifikasi kode OTP | Publik |
| POST | `/auth/resend-otp` | Kirim ulang OTP | Publik |
| POST | `/auth/login` | Login, kembalikan session/JWT | Publik |
| POST | `/auth/logout` | Logout | User |
| GET | `/auth/me` | Data user yang sedang login | User |

### Venue & Court Discovery
| Method | Endpoint | Deskripsi | Auth |
| --- | --- | --- | --- |
| GET | `/venues` | List/search venue (`?city=&q=`) | Publik |
| GET | `/venues/:id` | Detail venue + daftar lapangan | Publik |
| GET | `/courts/:id/availability?date=YYYY-MM-DD` | Slot tersedia untuk lapangan pada tanggal tsb | Publik |

### Booking
| Method | Endpoint | Deskripsi | Auth |
| --- | --- | --- | --- |
| POST | `/bookings` | Buat booking baru (status awal `hold`) | Player |
| GET | `/bookings/:id` | Detail booking | Player (miliknya) / Admin |
| GET | `/bookings` | Riwayat booking user (`?status=`) | Player |
| POST | `/bookings/:id/cancel` | Batalkan booking | Player / Venue owner |

### Payment
| Method | Endpoint | Deskripsi | Auth |
| --- | --- | --- | --- |
| POST | `/bookings/:id/checkout` | Buat sesi pembayaran di gateway | Player |
| POST | `/payments/webhook/:gateway` | Callback dari payment gateway | Server-to-server (verifikasi signature) |
| GET | `/payments/:id` | Status pembayaran | Player (miliknya) / Admin |

### Venue Management (venue_owner)
| Method | Endpoint | Deskripsi | Auth |
| --- | --- | --- | --- |
| POST | `/venues` | Ajukan pendaftaran venue baru | Venue owner |
| PATCH | `/venues/:id` | Update data venue | Venue owner (pemilik) |
| POST | `/venues/:id/courts` | Tambah lapangan | Venue owner |
| PATCH | `/courts/:id` | Update lapangan | Venue owner |
| POST | `/courts/:id/block` | Blokir slot/lapangan manual | Venue owner |

### Admin Platform
| Method | Endpoint | Deskripsi | Auth |
| --- | --- | --- | --- |
| GET | `/admin/venues?status=pending_approval` | List venue menunggu approval | Platform admin |
| POST | `/admin/venues/:id/approve` | Approve venue | Platform admin |
| POST | `/admin/venues/:id/reject` | Reject venue | Platform admin |
| GET | `/admin/transactions` | List semua transaksi (filterable) | Platform admin |
| GET | `/admin/dashboard/summary` | Ringkasan statistik platform | Platform admin |

---

## 10. Non-Functional Requirements

| ID | Kategori | Requirement |
| --- | --- | --- |
| NFR-01 | Performa | Response time pencarian & cek ketersediaan < 2 detik pada kondisi normal load |
| NFR-02 | Konkurensi | Tidak boleh terjadi double booking meskipun 2 user checkout slot yang sama bersamaan (gunakan DB constraint + hold mechanism) |
| NFR-03 | Keamanan | Password di-hash (bcrypt/argon2), OTP untuk verifikasi identitas, JWT httpOnly cookie, rate limiting endpoint auth |
| NFR-04 | Keamanan | Tidak menyimpan data kartu pembayaran di server sendiri — delegasikan ke payment gateway (PCI scope minimal) |
| NFR-05 | Keamanan | Enkripsi data sensitif at-rest & in-transit (HTTPS wajib) |
| NFR-06 | Keandalan | Payment retry & rekonsiliasi otomatis untuk transaksi `pending` yang terlalu lama |
| NFR-07 | Keandalan | Webhook handler idempotent — pemrosesan ulang webhook yang sama tidak boleh mengubah state ganda |
| NFR-08 | Skalabilitas | Sistem mampu auto-scale pada jam sibuk (peak hour sore/malam & akhir pekan) |
| NFR-09 | Observability | Logging terstruktur untuk booking & payment flow, minimal error tracking (mis. Sentry) |
| NFR-10 | Ketersediaan | Target uptime ≥ 99% selama masa beta |
| NFR-11 | Kepatuhan | Penanganan data pribadi pengguna sesuai UU PDP (Perlindungan Data Pribadi) — minimal consent saat registrasi & kebijakan retensi data |
| NFR-12 | Lokalisasi | Bahasa Indonesia sebagai bahasa utama UI, mata uang IDR, timezone WIB |
| NFR-13 | Usability | UI responsive — layak dipakai di browser mobile meski web app (bukan native app) |
| NFR-14 | Skalabilitas mitra | Onboarding venue baru tidak butuh keterlibatan teknis dev (self-service form + approval admin) |

---

## 11. Asumsi Teknis (Rekomendasi Stack)

> Bagian ini **bukan bagian dari Project Canvas asli** — ini rekomendasi berdasarkan konteks proyek web app Rafki sebelumnya. **Perlu dikonfirmasi/disesuaikan sebelum development dimulai.**

- **Frontend & Backend:** Next.js (App Router) + TypeScript — satu codebase full-stack
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM atau Prisma
- **Auth:** Auth.js (NextAuth) atau implementasi JWT custom untuk kebutuhan OTP
- **Cache / Session / Hold mechanism:** Redis (dipakai juga untuk lock sementara slot saat checkout)
- **Payment gateway:** Midtrans atau Xendit (disebut eksplisit di canvas sebagai contoh)
- **Notifikasi:** email via provider (mis. Resend/SendGrid); SMS/WhatsApp opsional — lihat Open Question #3
- **Hosting:** cloud provider dengan auto-scaling (mis. Vercel untuk app, managed Postgres + Redis terpisah)
- **Background job** (reminder, expire hold, rekonsiliasi payment): job queue/scheduler (mis. cron + queue seperti BullMQ, atau Inngest)

---

## 12. Open Questions / Perlu Konfirmasi

Hal-hal berikut ada di canvas tapi belum cukup rinci untuk langsung diimplementasikan — perlu keputusan sebelum/​selama sprint pertama:

1. **Kebijakan pembatalan & refund** — berapa jam sebelum jadwal booking boleh dibatalkan? Apakah ada refund penuh/sebagian jika sudah bayar?
2. **Model komisi platform** — berapa persen komisi per transaksi? Apakah biaya langganan mitra flat atau tier-based?
3. **Channel notifikasi** — apakah wajib WhatsApp/SMS (biaya tambahan per pesan) atau email saja cukup untuk beta?
4. **Durasi hold slot saat checkout** — draft di dokumen ini pakai 10 menit, perlu dikonfirmasi.
5. **Venue pilot** — berapa venue yang sudah komit ikut pilot program, dan siapa saja (untuk kebutuhan seeding data & UAT minggu 12–13)?
6. **Payment gateway final** — Midtrans, Xendit, atau keduanya (multi-gateway sesuai mitigasi risiko di canvas)?
7. **Granularitas role admin** — apakah `platform_admin` punya sub-level (mis. admin support vs admin finance), atau satu role saja untuk beta?

---

## 13. Risiko & Mitigasi (dari Project Canvas)

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Gangguan sistem pembayaran online | Tinggi | Multi payment gateway, retry & rekonsiliasi otomatis (NFR-06) |
| Kebocoran data pengguna/mitra | Tinggi | Enkripsi data, kepatuhan keamanan (NFR-04, NFR-05, NFR-11) |
| Server tidak stabil saat peak hour | Menengah-Tinggi | Load testing, auto-scaling (NFR-08) |
| Rendahnya adopsi mitra venue di awal | Menengah | Onboarding mudah & insentif komisi awal (di luar scope teknis, catatan untuk tim non-eng) |
| Persaingan dengan aplikasi sejenis | Menengah | Diferensiasi fitur komunitas & matchmaking (Phase 2) |

---

## 14. Milestone & Timeline (14 Minggu)

| Minggu | Fokus | Milestone |
| --- | --- | --- |
| 1–2 | Analisis kebutuhan & penyusunan proposal | Dokumen kebutuhan disetujui |
| 3–4 | Desain UI/UX & arsitektur sistem | Prototipe disetujui |
| 5–8 | Pengembangan back-end & integrasi payment | Booking engine berfungsi (Epic B & C) |
| 9–11 | Pengembangan front-end & integrasi penuh | Aplikasi versi beta siap (semua Epic A–E) |
| 12–13 | Pengujian (QA & UAT dengan venue pilot) | Bug kritis selesai |
| 14 | Deployment & peluncuran | Aplikasi live, mitra pertama onboard |

---

## 15. Definition of Done (Beta)

- [ ] Semua `FR-01` s.d. `FR-15` (Must have) terimplementasi & lulus test
- [ ] Tidak ada kasus double booking pada uji beban dasar (concurrent checkout test)
- [ ] Integrasi payment gateway berjalan end-to-end (checkout → webhook → status booking terupdate)
- [ ] Notifikasi konfirmasi & reminder terkirim sesuai skenario UAT
- [ ] Dashboard admin bisa dipakai untuk approve venue & pantau transaksi tanpa akses database langsung
- [ ] UAT dengan minimal 1 venue pilot selesai tanpa bug kritis terbuka
- [ ] Deployment ke environment production, domain/hosting siap diakses publik

---

## 16. Glosarium

| Istilah | Arti |
| --- | --- |
| Hold | Status sementara slot terkunci saat user sedang checkout, sebelum pembayaran selesai |
| Mitra / Venue owner | Pemilik/pengelola venue padel yang menjadi partner platform |
| UAT | User Acceptance Testing, pengujian bersama venue pilot sebelum go-live |
| Webhook | Callback dari payment gateway yang memberi tahu status pembayaran terbaru |
