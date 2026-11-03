# Rally Padel Club — Kontrak Frontend ↔ Backend

Dokumen ini mendefinisikan kontrak komunikasi antara antarmuka frontend dan server backend.

---

## 1. Struktur Arsitektur Lapisan

| Lapisan | File Implementasi | Deskripsi |
| :--- | :--- | :--- |
| **Tipe Domain & Helper** | [`src/app/club.ts`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/src/app/club.ts) | Definisi tipe TypeScript inti (`Booking`, `Court`, `User`, `Policy`, dll.) |
| **Adapter API** | [`src/app/api.ts`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/src/app/api.ts) | Menghubungkan komponen UI ke backend HTTP (sebelumnya mock localStorage) |
| **Lokalisasi Bahasa** | [`src/app/i18n.tsx`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/src/app/i18n.tsx) | Dukungan dwibahasa ID / EN |
| **Halaman Publik** | `app/(public)/...` | `ClubHome`, `BookPage`, `CheckoutPage`, `MyBookings`, `AuthDialog` |
| **Dashboard Pengelola** | `app/admin/...` | Operasional jadwal, walk-in, transaksi, dan pengaturan klub |

---

## 2. Rincian Endpoint HTTP & Hak Akses

| Fungsi Adapter | Endpoint HTTP | Peran Akses | Keterangan |
| :--- | :--- | :--- | :--- |
| `auth.register` | `POST /auth/register` | Publik | Menerima email/HP, mengirimkan kode OTP |
| `auth.verifyOtp` | `POST /auth/verify-otp` | Publik | Memvalidasi 6 digit OTP (TTL 5 mnt) |
| `auth.resendOtp` | `POST /auth/resend-otp` | Publik | Kirim ulang OTP (cooldown 60 dtk) |
| `auth.login` | `POST /auth/login` | Publik | Login pengguna (scope: player / staff) |
| `auth.logout`, `auth.me` | `POST /auth/logout`, `GET /auth/me` | User | Manajemen sesi aktif |
| `club.get` | `GET /club` | Publik | Informasi umum & jam buka klub |
| `availability` | `GET /courts/:id/availability?date=` | Publik | Interval sibuk (booking, hold, blokir) |
| `reviews` | `GET /reviews` | Publik | Ulasan yang berstatus completed |
| `bookings.hold` | `POST /bookings` | Player | Kunci slot sementara (status `hold`, TTL 10 mnt) |
| `bookings.release` | `DELETE /bookings/:id/hold` | Pemilik | Melepas slot hold sebelum checkout |
| `bookings.get`, `mine` | `GET /bookings/:id`, `GET /bookings` | Pemilik | Rincian tiket booking pemain |
| `bookings.cancel` | `POST /bookings/:id/cancel` | Pemilik | Pembatalan dengan kalkulasi refund |
| `bookings.reschedule` | `POST /bookings/:id/reschedule` | Pemilik | Pindah jam main tanpa ganti lapangan |
| `bookings.rate` | `POST /bookings/:id/review` | Pemilik | Kirim bintang & komentar setelah selesai |
| `payments.checkout` | `POST /bookings/:id/checkout` | Pemilik | Pembuatan sesi gateway (QRIS / VA) |
| `payments.forBooking` | `GET /payments?bookingId=` | Pemilik | Status pembayaran transaksi |
| `payments.webhook` | `POST /payments/webhook/:gateway` | Server | Callback konfirmasi bayar otomatis (idempotent) |
| `notifications.mine` | `GET /notifications` | Player | Notifikasi pengingat & konfirmasi |
| `admin.bookings` | `GET /admin/bookings` | Staf, Owner | Daftar pencarian seluruh booking klub |
| `admin.createBooking` | `POST /admin/bookings` | Staf, Owner | Booking manual walk-in (bayar tunai) |
| `admin.addBlock` | `POST /courts/:id/block` | Staf, Owner | Blokir jam perawatan/turnamen |
| `admin.replyReview` | `PATCH /admin/reviews/:id` | Staf, Owner | Balasan pengelola atas ulasan pemain |
| `admin.payments` | `GET /admin/transactions` | Owner | Laporan transaksi keuangan klub |
| `admin.updateClub` | `PATCH /club` | Owner | Perubahan identitas, tarif, dan jam operasional |

---

## 3. Standar Error API (`ApiError`)

Error dilempar sebagai objek terstruktur `ApiError(code, message, meta)`. Kode error yang wajib didukung:

| Kode Error | Keterangan | Meta |
| :--- | :--- | :--- |
| `invalid_input` | Format data input tidak sesuai skema Zod | Field error |
| `duplicate` | Email / nomor HP sudah terdaftar | - |
| `otp_invalid` | Kode OTP salah | `meta.remaining` (sisa percobaan) |
| `otp_expired` | Kode OTP telah kadaluarsa | - |
| `otp_cooldown` | Terlalu cepat meminta kirim ulang | `meta.seconds` (sisa cooldown) |
| `invalid_credentials`| Password tidak cocok | `meta.remaining` |
| `locked` | Akun terkunci sementara karena brute-force | `meta.minutes` |
| `slot_unavailable` | Slot telah di-hold atau dibooking pemain lain | - |
| `policy` | Melanggar kebijakan batas waktu cancel/reschedule | - |
| `hold_expired` | Waktu 10 menit hold telah habis saat mau bayar | - |

---

## 4. Siklus Hidup Status Booking

```
[HOLD] ──(bayar)──> [PENDING_PAYMENT] ──(webhook sukses)──> [CONFIRMED] ──(selesai main)──> [COMPLETED]
  │                        │                                      │
(10 mnt habis)       (waktu habis)                         (dibatalkan pemain)
  ▼                        ▼                                      ▼
[EXPIRED]              [EXPIRED]                             [CANCELLED]
```
Setiap perpindahan status wajib dicatat ke dalam riwayat `booking.history` untuk *audit trail*.
