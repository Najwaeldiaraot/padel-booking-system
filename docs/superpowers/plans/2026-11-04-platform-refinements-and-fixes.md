# Platform Refinements and Core Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelesaikan dan memvalidasi secara tuntas 12 poin perbaikan platform: Midtrans QRIS sandbox simulator fix & 1-click auto-pay, perbaikan dropdown modal admin (Radix Popover top-layer clash), player notes auto-slide & Google reviews, pemindahan WhatsApp help ke FAQ, dinamisasi WhatsApp admin, cetak tiket PDF terisolasi, clean 404 page, camera QR scanner di live board, rating quick-comment chips, pengiriman OTP riil via Resend, backend reschedule engine, dan konsistensi styling QR di email tiket.

**Architecture:** 
- Frontend UI dioptimalkan dengan Tailwind v4, dialog print CSS isolation, auto-sliding state carousel, dan camera stream capture via Web API.
- Dialog popover admin diperbaiki dengan menghilangkan portal clash ke document.body di atas native `<dialog>` HTML top-layer.
- Payment gateway QRIS ditingkatkan dengan URL v2 simulator Midtrans serta endpoint helper 1-click sandbox payment yang mengeksekusi settlement riil ke Midtrans Core API secara otomatis.
- Backend Next.js App Router API terhubung ke Resend SDK untuk live transactional OTP email dan Supabase/Redis untuk pemindahan jadwal (reschedule engine) tanpa konflik slot.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI, Midtrans Core API, Resend SDK, HTML5 MediaDevices API, Upstash Redis, Supabase PostgreSQL, Playwright, Vitest.

**Spec:** User feedback & bug reports (Midtrans simulator rejection, modal dropdown unresponsive, plus 10 requested platform features).

## Global Constraints
- Bahasa Indonesia untuk pesan UI dan konfirmasi user.
- Dilarang format matematika/LaTeX (gunakan tanda panah teks `->` atau unicode `→`).
- Dilarang membuat artefak walkthrough otomatis (`walkthrough.md`).
- Semua perintah shell executable wajib melalui `rtk`.
- Zero placeholders (TBD, TODO, implement later dilarang).

---

### Task 1: Midtrans QRIS Simulator Fix & 1-Click Sandbox Auto-Pay Helper

**Files:**
- Create: `src/app/api/payment/simulate-pay/route.ts`
- Modify: `src/components/booking/CheckoutPage.tsx:200-260`
- Modify: `src/lib/midtrans.ts:160-205`
- Test: `tests/unit/payment-midtrans.test.ts`

**Interfaces:**
- Produces: `POST /api/payment/simulate-pay` with `{ orderId: string, issuer?: string }` returning `{ success: boolean, status: string, settlementTime?: string }`
- Updates `CheckoutPage.tsx` link to `https://simulator.sandbox.midtrans.com/v2/qris/index` and adds "⚡ Bayar Otomatis via Sandbox" button.

- [ ] **Step 1: Write the failing test for simulate-pay API**

```typescript
// tests/unit/payment-simulator-api.test.ts
import { describe, it, expect } from "vitest"

describe("Payment Sandbox Simulator Helper", () => {
  it("should validate orderId presence in payload", async () => {
    const { POST } = await import("@/app/api/payment/simulate-pay/route")
    const req = new Request("http://localhost:3000/api/payment/simulate-pay", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("orderId is required")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk pnpm exec vitest run tests/unit/payment-simulator-api.test.ts`
Expected: FAIL with module not found or test failure.

- [ ] **Step 3: Implement POST /api/payment/simulate-pay/route.ts & update CheckoutPage.tsx**

```typescript
// src/app/api/payment/simulate-pay/route.ts
import { NextResponse } from "next/server"
import { midtransConfig } from "@/lib/midtrans"

export async function POST(request: Request) {
  try {
    const { orderId, issuer = "gopay" } = await request.json()
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }

    const serverKey = midtransConfig.serverKey
    if (!serverKey) {
      return NextResponse.json({ error: "Server key not configured" }, { status: 500 })
    }

    const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`
    // 1. Ambil status transaksi dari Midtrans untuk mendapatkan URL QR
    const statusRes = await fetch(`https://api.sandbox.midtrans.com/v2/${orderId}/status`, {
      headers: { Accept: "application/json", Authorization: authHeader },
    })
    const statusData = await statusRes.json()

    if (!statusRes.ok || !statusData.transaction_id) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan di Midtrans Sandbox" }, { status: 404 })
    }

    const qrUrl = `https://api.sandbox.midtrans.com/v2/qris/${statusData.transaction_id}/qr-code`

    // 2. Scan QR di Midtrans Simulator v2
    const scanRes = await fetch("https://simulator.sandbox.midtrans.com/v2/qris/payment", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ qrCodeUrl: qrUrl }),
    })
    const scanHtml = await scanRes.text()

    const refIdMatch = scanHtml.match(/name="referenceId"[^>]*value="([^"]*)"/)
    const exploreDataMatch = scanHtml.match(/name="exploreData"[^>]*value="([\s\S]*?)"\s*>/)

    if (!refIdMatch || !exploreDataMatch) {
      return NextResponse.json({ error: "Gagal memproses simulator v2" }, { status: 502 })
    }

    const refId = refIdMatch[1]
    const exploreData = exploreDataMatch[1].replace(/&quot;/g, '"')

    // 3. Eksekusi Pay di Midtrans Simulator v2
    const payRes = await fetch("https://simulator.sandbox.midtrans.com/v2/qris/payment/gopay", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://simulator.sandbox.midtrans.com/v2/qris/payment",
      },
      body: new URLSearchParams({
        referenceId: refId,
        exploreData: exploreData,
        issuer: issuer,
      }),
    })

    // 4. Verifikasi status settlement
    const verifyRes = await fetch(`https://api.sandbox.midtrans.com/v2/${orderId}/status`, {
      headers: { Accept: "application/json", Authorization: authHeader },
    })
    const verifyData = await verifyRes.json()

    return NextResponse.json({
      success: verifyData.transaction_status === "settlement",
      status: verifyData.transaction_status,
      settlementTime: verifyData.settlement_time,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Simulate payment failed" }, { status: 500 })
  }
}
```

Update `CheckoutPage.tsx`:
- Ganti link simulator menjadi `https://simulator.sandbox.midtrans.com/v2/qris/index`.
- Berikan label jelas: tombol "Salin URL Gambar QR" ditekankan untuk dipaste ke simulator (bukan string EMVCo).
- Tambahkan tombol: "⚡ Bayar Otomatis via Sandbox" yang langsung memanggil endpoint `/api/payment/simulate-pay` tanpa perlu manual copy-paste.

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk pnpm exec vitest run tests/unit/payment-simulator-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
rtk git add src/app/api/payment/simulate-pay/route.ts src/components/booking/CheckoutPage.tsx tests/unit/payment-simulator-api.test.ts
rtk git commit -m "fix(payment): upgrade midtrans qris simulator to v2 and add 1-click auto-pay helper"
```

---

### Task 2: Fix Dropdowns in Admin Move/Reschedule Dialog (Radix Popover Top-Layer Clash)

**Files:**
- Modify: `src/components/admin/CustomUI.tsx:13-90`
- Modify: `src/components/admin/Operations.tsx:500-550`
- Test: `tests/unit/custom-ui.test.tsx`

**Interfaces:**
- `LuxurySelect` & `LuxuryDatePicker`: Menghilangkan `Popover.Portal` yang portaling ke `document.body` (tersembunyi di belakang native HTML `<dialog>` top layer) atau menyediakan opsi inline container sehingga dropdown opsi muncul tepat di atas dialog.

- [ ] **Step 1: Write failing component test for LuxurySelect inside dialog**

```typescript
// tests/unit/custom-ui-select.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LuxurySelect } from "@/components/admin/CustomUI"

describe("LuxurySelect dropdown in dialog", () => {
  it("renders options within accessible container without body portal collision", () => {
    const onChange = vi.fn()
    render(
      <LuxurySelect
        value="1"
        onChange={onChange}
        options={[
          { value: 1, label: "Court 01" },
          { value: 2, label: "Court 02" },
        ]}
      />
    )
    const trigger = screen.getByRole("button")
    fireEvent.click(trigger)
    expect(screen.getByText("Court 02")).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify behavior**

Run: `rtk pnpm exec vitest run tests/unit/custom-ui-select.test.tsx`

- [ ] **Step 3: Update CustomUI.tsx to render inline dropdown without portal isolation**

Di `src/components/admin/CustomUI.tsx`:
Ubah `LuxurySelect` dan `LuxuryDatePicker`:
Hapus pembungkus `<Popover.Portal>` atau ganti menggunakan state dropdown lokal / floating content dengan `z-50` relative/absolute di dalam container dialog. Hal ini memastikan opsi lapangan, tanggal, dan jam tampil 100% di layar saat diklik di dalam `BookingDetailDialog`.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk pnpm exec vitest run tests/unit/custom-ui-select.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
rtk git add src/components/admin/CustomUI.tsx src/components/admin/Operations.tsx
rtk git commit -m "fix(admin): resolve dropdown popover visibility clash inside native dialog"
```

---

### Task 3: 04 / Player Notes Auto-Slide Carousel & Google Business Rating

**Files:**
- Modify: `src/components/home/VenueMarketing.tsx:55-125`
- Test: `tests/unit/player-stories.test.tsx`

**Interfaces:**
- Consumes: `reviews` data from venue/club state.
- Produces: Auto-sliding review carousel (rotasi setiap 5 detik, pause on hover, next/prev arrow buttons, indicator dots) + Google Business rating badge ("4.9 ★★★★★ di Google Maps & Bisnis | 120+ Ulasan Terverifikasi").

- [ ] **Step 1: Write test for PlayerStories carousel component**

```typescript
// tests/unit/player-stories.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PlayerStories } from "@/components/home/VenueMarketing"

describe("PlayerStories Carousel", () => {
  it("renders Google Business rating badge and review slides", () => {
    render(<PlayerStories />)
    expect(screen.getByText(/Google/i)).toBeDefined()
    expect(screen.getByText(/4\.9/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk pnpm exec vitest run tests/unit/player-stories.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Auto-Slide Carousel & Google Badge in VenueMarketing.tsx**

Tambahkan:
- State `currentIndex`, `isPaused`.
- `useEffect` interval 5000ms yang beralih slide saat `!isPaused`.
- Google Review badge di header section dengan icon Google warna-warni, bintang emas 5.0/4.9, dan jumlah ulasan.
- Tombol navigasi Previous (`<ChevronLeft />`) dan Next (`<ChevronRight />`), serta dot pagination di bawah slider.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk pnpm exec vitest run tests/unit/player-stories.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Task 3**

```bash
rtk git add src/components/home/VenueMarketing.tsx
rtk git commit -m "feat(home): add auto-slide carousel and google reviews badge to player notes"
```

---

### Task 4 & 5: Relokasi WhatsApp Help ke FAQ (06) & Dinamisasi Nomor WhatsApp via Admin

**Files:**
- Modify: `src/components/home/VenueMarketing.tsx:123-165`
- Modify: `src/components/booking/BookingSupport.tsx:32-176`
- Modify: `src/components/admin/ClubAdmin.tsx:345-410`
- Test: `tests/unit/whatsapp-help.test.tsx`

**Interfaces:**
- Pindahkan `WhatsAppHelp` dari section `05 / Find the club` ke section `06 / Before you play` (di bawah FAQ).
- Hubungkan nomor telepon tujuan WhatsApp langsung ke `club.whatsappNumber` dinamis dari konfigurasi admin klub (tersimpan via API).

- [ ] **Step 1: Write test verifying WhatsAppHelp is in FAQ section with dynamic phone**

```typescript
// tests/unit/whatsapp-help.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ClubQuestions } from "@/components/booking/BookingSupport"

describe("ClubQuestions with WhatsApp Help", () => {
  it("includes WhatsApp help at the bottom of FAQ", () => {
    render(<ClubQuestions />)
    expect(screen.getByText(/Masih ada yang ingin ditanyakan\?/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `rtk pnpm exec vitest run tests/unit/whatsapp-help.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement relocation & dynamic WhatsApp number**

- Hapus `<WhatsAppHelp />` dari `ClubLocation` di `VenueMarketing.tsx`.
- Sisipkan `<WhatsAppHelp />` di bagian bawah `ClubQuestions` di `BookingSupport.tsx`.
- Ganti nomor statis di `WhatsAppHelp` dengan `club.whatsappNumber || "6281234567890"`, diformat rapi ke `https://wa.me/...`.
- Pastikan perubahan di `IdentityEditor` (`ClubAdmin.tsx`) menyimpan nomor WhatsApp ke profil klub backend.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk pnpm exec vitest run tests/unit/whatsapp-help.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Task 4 & 5**

```bash
rtk git add src/components/home/VenueMarketing.tsx src/components/booking/BookingSupport.tsx src/components/admin/ClubAdmin.tsx
rtk git commit -m "feat(contact): move whatsapp help to faq and bind dynamic phone from admin"
```

---

### Task 6: Cetak PDF/Tiket Official Pass & E-Invoice (Print UI Isolation)

**Files:**
- Modify: `src/components/booking/InvoiceModal.tsx:30-120`
- Modify: `src/app/globals.css`
- Test: `tests/unit/print-invoice.test.tsx`

**Interfaces:**
- CSS print media query yang mengisolasi `#printable-pass-invoice` saat `window.print()` dipanggil, menyembunyikan header, footer, background website, dan tombol dialog.

- [ ] **Step 1: Write print stylesheet rules in globals.css**

```css
@media print {
  body * {
    visibility: hidden;
  }
  #printable-pass-invoice,
  #printable-pass-invoice * {
    visibility: visible;
  }
  #printable-pass-invoice {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 20px;
    background: #ffffff !important;
    color: #111111 !important;
  }
  .no-print {
    display: none !important;
  }
  @page {
    size: auto;
    margin: 10mm;
  }
}
```

- [ ] **Step 2: Update InvoiceModal.tsx to wrap printable ticket**

Beri id `printable-pass-invoice` pada container tiket Official Pass & E-Invoice, tambahkan class `no-print` pada tombol "Tutup", "Unduh PDF / Cetak", dan modal backdrop.

- [ ] **Step 3: Run build/typecheck to verify no CSS errors**

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit Task 6**

```bash
rtk git add src/components/booking/InvoiceModal.tsx src/app/globals.css
rtk git commit -m "style(invoice): isolate print styles for clean official pass and invoice printing"
```

---

### Task 7: Halaman 404 Bersih & Minimalis (Clean 404)

**Files:**
- Create: `src/app/not-found.tsx`
- Test: `tests/unit/not-found.test.tsx`

**Interfaces:**
- Halaman 404 mandiri tanpa header atau footer navbar yang mengganggu, menyajikan desain *luxury athletic* gelap, angka 404 besar, pesan jelas, dan tombol kembali ke beranda.

- [ ] **Step 1: Create src/app/not-found.tsx**

```tsx
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">404 · Error</p>
      <h1 className="mt-4 font-display text-6xl md:text-8xl tracking-tight">Halaman Tidak Ditemukan</h1>
      <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
        Jadwal atau halaman yang kamu tuju mungkin telah dipindahkan, dibatalkan, atau tautan tidak valid.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 border border-primary bg-primary px-6 py-3 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <ArrowLeft size={16} /> Kembali ke Beranda
      </Link>
    </main>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit Task 7**

```bash
rtk git add src/app/not-found.tsx
rtk git commit -m "feat(ui): add clean luxury 404 not found page without headers"
```

---

### Task 8: Camera QR Scanner di Admin Live Board untuk Validasi & Check-in

**Files:**
- Modify: `src/components/admin/AdminLiveBoard.tsx:100-220`
- Test: `tests/unit/admin-live-scanner.test.tsx`

**Interfaces:**
- Modal validasi tiket di `AdminLiveBoard.tsx` dilengkapi live camera video feed (`navigator.mediaDevices.getUserMedia`) dengan canvas frame reader untuk membaca QR tiket pemain secara instan.

- [ ] **Step 1: Add Camera Scanner UI & Video Stream Reader in AdminLiveBoard.tsx**

Tambahkan tombol "Buka Scanner Kamera".
Saat aktif:
- Request permission kamera via `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })`.
- Tampilkan `<video>` stream dengan overlay target bidik QR.
- Scan frame video secara berkala menggunakan canvas atau library scanner (`jsQR` / decode).
- Saat kode QR terdeteksi, isi nilai booking code, mainkan nada audio konfirmasi, dan jalankan `checkinBooking(code)`.

- [ ] **Step 2: Run typecheck to verify camera integration**

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit Task 8**

```bash
rtk git add src/components/admin/AdminLiveBoard.tsx
rtk git commit -m "feat(admin): add interactive camera qr scanner for ticket check-in"
```

---

### Task 9: Komen Cepat (Quick Feedback Chips) pada Modal Rating

**Files:**
- Modify: `src/components/booking/InvoiceModal.tsx:180-240` (atau modal rating pemain)
- Test: `tests/unit/rating-quick-comments.test.tsx`

**Interfaces:**
- Komponen review menyediakan pilihan *chips*: "Lapangan Mulus & Bersih", "Pencahayaan Terang", "Staf Ramah & Sigap", "Area Santai Nyaman", "Pertandingan Sangat Seru".
- Mengklik chip menambahkan teks tersebut ke input ulasan pemain.

- [ ] **Step 1: Implement Quick Feedback Chips in Rating Section**

Tambahkan array predefined tags:
```typescript
const quickReviewTags = [
  "Lapangan Mulus & Bersih",
  "Pencahayaan Terang",
  "Staf Ramah & Sigap",
  "Area Santai Nyaman",
  "Pertandingan Sangat Seru",
  "Net & Garis Standar",
]
```
Render tombol chip dengan animasi aktif/non-aktif yang menambahkan atau menghapus tag dari form komentar.

- [ ] **Step 2: Run typecheck**

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit Task 9**

```bash
rtk git add src/components/booking/InvoiceModal.tsx
rtk git commit -m "feat(review): add quick feedback comment chips to rating form"
```

---

### Task 10: Pengiriman OTP Riil via Resend

**Files:**
- Modify: `src/app/api/auth/register/route.ts:50-95`
- Modify: `src/app/api/auth/forgot-password/route.ts:50-90`
- Modify: `src/server/services/email-service.ts:1-60`
- Test: `tests/unit/resend-otp.test.ts`

**Interfaces:**
- Memanggil Resend API (`resend.emails.send`) dengan template email HTML OTP profesional saat user registrasi atau lupa password.

- [ ] **Step 1: Implement sendOtpEmail in email-service.ts**

```typescript
// src/server/services/email-service.ts
export async function sendOtpEmail(email: string, otpCode: string, purpose: "register" | "forgot_password") {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn("[Email Service] RESEND_API_KEY not configured")
    return false
  }

  const subject = purpose === "register" ? "Kode Verifikasi Registrasi Rally Padel" : "Kode Reset Password Akun Rally Padel"
  const html = `
    <div style="font-family: sans-serif; background-color: #0f1412; color: #f4f1ea; padding: 40px; border-radius: 8px;">
      <h2 style="color: #c2a675; margin-bottom: 16px;">Rally Padel Club</h2>
      <p style="font-size: 15px; line-height: 1.6;">Gunakan kode OTP berikut untuk ${purpose === "register" ? "menyelesaikan pendaftaran akun Anda" : "mereset kata sandi Anda"}:</p>
      <div style="margin: 28px 0; padding: 18px 24px; background-color: #1a221f; border: 1px solid #c2a675; border-radius: 6px; text-align: center; letter-spacing: 6px; font-size: 32px; font-weight: bold; color: #ffffff;">
        ${otpCode}
      </div>
      <p style="font-size: 12px; color: #a1a1aa;">Kode ini berlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.</p>
    </div>
  `

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: "Rally Padel <onboarding@resend.dev>",
      to: [email],
      subject,
      html,
    }),
  })

  return res.ok
}
```

- [ ] **Step 2: Connect routes to sendOtpEmail**

Panggil `sendOtpEmail` di `src/app/api/auth/register/route.ts` dan `src/app/api/auth/forgot-password/route.ts`.

- [ ] **Step 3: Run typecheck**

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit Task 10**

```bash
rtk git add src/server/services/email-service.ts src/app/api/auth/register/route.ts src/app/api/auth/forgot-password/route.ts
rtk git commit -m "feat(auth): enable live transactional otp email delivery via resend"
```

---

### Task 11: Backend Reschedule Engine (Pindah Lapangan, Tanggal, Jam)

**Files:**
- Modify: `src/app/api/bookings/[id]/route.ts:150-250`
- Test: `tests/unit/booking-reschedule.test.ts`

**Interfaces:**
- Menerima action `reschedule` dengan `{ court, date, time }`.
- Memvalidasi slot target di database dan distributed lock Redis.
- Memperbarui database Supabase, update slot lock, dan mencatat riwayat audit.

- [ ] **Step 1: Write test for reschedule action**

```typescript
// tests/unit/booking-reschedule.test.ts
import { describe, it, expect } from "vitest"

describe("Booking Reschedule API", () => {
  it("rejects reschedule if target slot parameters are incomplete", async () => {
    const { PATCH } = await import("@/app/api/bookings/[id]/route")
    const req = new Request("http://localhost:3000/api/bookings/test/reschedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reschedule" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "test" }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `rtk pnpm exec vitest run tests/unit/booking-reschedule.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement reschedule handler in PATCH /api/bookings/[id]/route.ts**

- Periksa otentikasi admin/staff atau pemilik.
- Validasi slot target (`court`, `date`, `time`).
- Update data booking di Supabase (`court_id`, `date`, `start_time`, `end_time`).
- Release lock lama dan pasang lock baru di Redis.
- Append riwayat booking: `rescheduled` oleh `actor: "staff" / "owner"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk pnpm exec vitest run tests/unit/booking-reschedule.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 11**

```bash
rtk git add src/app/api/bookings/[id]/route.ts tests/unit/booking-reschedule.test.ts
rtk git commit -m "feat(bookings): implement robust court date and time rescheduling engine"
```

---

### Task 12: Konsistensi Styling QR Code di Email Tiket

**Files:**
- Modify: `src/server/services/email-service.ts:120-180`
- Test: `tests/unit/email-template.test.ts`

**Interfaces:**
- Hapus wrapper card putih kaku di sekeliling QR code tiket email. Buat styling QR menyatu secara harmonis dengan warna tiket pass (*luxury dark / cream stub*) sesuai desain Official Pass & E-Invoice.

- [ ] **Step 1: Update email template HTML in email-service.ts**

Ganti table pembungkus putih menjadi container tiket terintegrasi dengan aksen border tipis emas, background tiket pass netral, nomor referensi tiket elegan, dan QR code yang tidak terisolasi dalam kotak putih kaku.

- [ ] **Step 2: Run typecheck**

Run: `rtk pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit Task 12**

```bash
rtk git add src/server/services/email-service.ts
rtk git commit -m "style(email): align ticket qr code styling with luxury pass aesthetic"
```

---

### Task 13: Full Regression Verification & Diff Review

**Files:**
- All modified files

- [ ] **Step 1: Run comprehensive lint and typecheck**

Run: `rtk pnpm lint && rtk pnpm typecheck`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Run unit and targeted integration tests**

Run: `rtk pnpm test:unit`
Expected: All tests pass.

- [ ] **Step 3: Run Playwright E2E suite**

Run: `rtk pnpm test:e2e`
Expected: All tests pass.

- [ ] **Step 4: Final Git diff audit**

Run: `rtk git diff --check && rtk git status --short`
Expected: Clean working tree, minimal and intentional diffs only.
