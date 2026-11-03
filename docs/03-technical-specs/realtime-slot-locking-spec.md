# Spesifikasi Teknis: Kunci Slot Atomik Redis & Real-Time Sync (SSE)

Dokumen ini menjelaskan alur teknis pencegahan bentrok jadwal (*zero double booking*) dan pembaruan antarmuka secara instan menggunakan **Upstash Redis** dan **Server-Sent Events (SSE)**.

---

## 1. Masalah yang Diselesaikan (*The Concurrency Problem*)

Pada olahraga padel dengan antusiasme tinggi, beberapa pemain sering kali membuka aplikasi pada waktu bersamaan untuk memperebutkan jam bermain populer (misal: pukul 19.00 - 21.00 di akhir pekan).

Jika dua pemain mengklik slot yang sama di detik yang sama:
- **Pendekatan Biasa (Polling berkala)**: Pemain B tidak tahu Pemain A sedang memilih slot, keduanya lanjut ke pembayaran, dan terjadi *double booking* fatal.
- **Solusi Kita (Atomic Lock + Real-time SSE)**: Pemain A mengunci slot di Redis dalam waktu < 2 milidetik. Layar Pemain B dan seluruh pengguna lain seketika berubah menjadi abu-abu terkunci ("Sedang dipilih pemain lain").

---

## 2. Struktur Key & Pola Kunci Redis

### Format Key
```
slot:{courtId}:{date}:{startTime}
```
*Contoh:* `slot:1:2026-11-03:19:00`

### Perintah Atomik Kunci Slot (Hold)
```typescript
// SET key value NX EX seconds
// NX: Hanya set jika key BELUM ADA (Set if Not Exists)
// EX: Otomatis kadaluarsa dalam hitungan detik (TTL 600 detik = 10 menit)
const locked = await redis.set(`slot:${courtId}:${date}:${startTime}`, JSON.stringify({
  userId,
  bookingId,
  customerName,
  heldAt: Date.now()
}), { nx: true, ex: 600 })
```

### Logika Hasil:
1. **Jika `locked === "OK"`**:
   - Pemain berhasil memegang slot.
   - Sistem membuat entitas `Booking` di database PostgreSQL dengan status `HOLD` dan `holdExpiresAt = NOW() + 10 menit`.
   - Sistem memancarkan event ke SSE stream.
   - Pemain diarahkan ke halaman `/checkout/[bookingId]`.
2. **Jika `locked === null` (Gagal / Sudah ada pemain lain)**:
   - Sistem mengembalikan response HTTP `409 Conflict`:
     ```json
     {
       "error": "slot_unavailable",
       "message": "Slot ini baru saja dipilih oleh pemain lain. Silakan pilih slot lain."
     }
     ```

---

## 3. Alur Komunikasi Real-Time (Server-Sent Events)

### Endpoint SSE: `GET /api/realtime/slots?date=YYYY-MM-DD`
Setiap klien yang membuka halaman booking ([`/book`](file:///C:/Users/UwU.KEPO/Desktop/Project/PADEL/src/app/BookPage.tsx)) secara otomatis membuka koneksi SSE ke server.

### Format Event Payload:
```json
event: slot_update
data: {
  "type": "SLOT_HELD",
  "courtId": 1,
  "date": "2026-11-03",
  "time": "19:00",
  "status": "hold",
  "expiresInSeconds": 600
}
```

Saat pembayaran selesai atau waktu 10 menit habis:
```json
event: slot_update
data: {
  "type": "SLOT_CONFIRMED",
  "courtId": 1,
  "date": "2026-11-03",
  "time": "19:00",
  "status": "confirmed"
}
```
atau jika dilepas:
```json
event: slot_update
data: {
  "type": "SLOT_RELEASED",
  "courtId": 1,
  "date": "2026-11-03",
  "time": "19:00",
  "status": "available"
}
```

---

## 4. Siklus Pelepasan Kunci (Release & Sweep)

1. **Pemain Membatalkan Sendiri**:
   - Pemain mengklik tombol "Batal" atau meninggalkan sesi checkout.
   - Server memanggil `redis.del(key)` dan mengubah status di PostgreSQL menjadi `CANCELLED`.
   - Event `SLOT_RELEASED` dipancarkan.
2. **Kadaluarsa Alami (10 Menit Habis)**:
   - Key di Redis otomatis hilang karena waktu TTL 600 detik berakhir.
   - Background sweeper (`/api/cron/sweep`) memeriksa tabel `bookings` yang berstatus `HOLD` dengan `holdExpiresAt < NOW()` dan mengubahnya menjadi `EXPIRED`.
   - Event `SLOT_RELEASED` dipancarkan.
3. **Pembayaran Sukses**:
   - Webhook Midtrans menerima notifikasi `settlement`.
   - Kunci sementara di Redis dihapus (`redis.del`).
   - Status di database PostgreSQL permanen menjadi `CONFIRMED`.
   - Event `SLOT_CONFIRMED` dipancarkan.
