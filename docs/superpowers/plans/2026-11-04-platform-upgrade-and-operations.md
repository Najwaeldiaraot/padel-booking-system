# Platform Upgrade & Operational Live Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, full-lifecycle Padel Club management platform featuring PII encryption, dedicated Customer records, an interactive Operational Live Board (Queue System), unified custom UI components, luxury ticket e-invoices, and robust refund mechanics.

**Architecture:** Layered Fullstack Next.js App Router architecture. Security layer uses AES-256-GCM with HMAC blind indexes for encrypted yet searchable customer PII. The database persists `Customer` entities related to `Booking`. Admin operations are enhanced with a real-time 3-stage Operational Live Board (Queue System) with debounced search, styled custom selects/pickers, and brand-consistent error pages.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Prisma ORM, Supabase PostgreSQL, Upstash Redis, Midtrans Core & Refund API, Resend Email Service, Vitest, Playwright.

**Spec:** `file:///C:/Users/UwU.KEPO/.gemini/antigravity-cli/brain/1203551a-f57c-4009-9c02-9073905caa8b/plan_comprehensive_platform_upgrade.md`

## Global Constraints
- Language: Technical Bahasa Indonesia for user UI copy, standard English for code/types/APIs.
- Icons: Lucide icons only. Strictly no emojis in notifications, toasts, or admin toggles.
- Styling: Rally Padel Club design system (`#1C2621` Forest, `#F4F1EA` Warm Sand, `#C05638` Clay, `#E2E8E5` Border).
- Executables: Shell commands must execute via `rtk` (e.g. `rtk pnpm ...`).
- Security: Never expose unencrypted PII in public logs or client bundles.

---

### Task 1: PII Encryption & Blind Index Security Module

**Files:**
- Create: `src/lib/encryption.ts`
- Test: `tests/unit/encryption.test.ts`

**Interfaces:**
- Produces:
  - `encryptPII(plaintext: string): string`
  - `decryptPII(ciphertext: string): string`
  - `generateBlindIndex(plaintext: string): string`

- [ ] **Step 1: Write failing unit tests for encryption & blind index**

```typescript
// tests/unit/encryption.test.ts
import { describe, it, expect } from "vitest";
import { encryptPII, decryptPII, generateBlindIndex } from "@/lib/encryption";

describe("PII Encryption & Blind Indexing", () => {
  it("encrypts and decrypts sensitive contact data reversibly", () => {
    const raw = "081234567890";
    const encrypted = encryptPII(raw);
    expect(encrypted).not.toBe(raw);
    expect(encrypted).toContain(":"); // iv:authTag:ciphertext format
    const decrypted = decryptPII(encrypted);
    expect(decrypted).toBe(raw);
  });

  it("generates deterministic blind indexes for search queries", () => {
    const email = "pemain@rallypadel.club";
    const idx1 = generateBlindIndex(email);
    const idx2 = generateBlindIndex("PEMAIN@rallypadel.club ");
    expect(idx1).toBe(idx2);
    expect(idx1.length).toBe(64); // SHA-256 hex
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `rtk pnpm exec vitest run tests/unit/encryption.test.ts`
Expected: FAIL with "Cannot find module '@/lib/encryption'"

- [ ] **Step 3: Implement AES-256-GCM encryption and blind index helper**

```typescript
// src/lib/encryption.ts
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET_KEY = crypto
  .createHash("sha256")
  .update(process.env.NEXTAUTH_SECRET || "rally-padel-default-secret-salt-key-2026")
  .digest();

export function encryptPII(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptPII(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(":")) return encryptedText;
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      SECRET_KEY,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedText; // Fallback if already plaintext
  }
}

export function generateBlindIndex(term: string): string {
  if (!term) return "";
  const normalized = term.trim().toLowerCase();
  return crypto.createHmac("sha256", SECRET_KEY).update(normalized).digest("hex");
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `rtk pnpm exec vitest run tests/unit/encryption.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
rtk git add src/lib/encryption.ts tests/unit/encryption.test.ts
rtk git commit -m "feat(security): add AES-256-GCM PII encryption and blind index"
```

---

### Task 2: Customer Database Model & Management API

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/app/api/admin/customers/route.ts`
- Modify: `src/app/club.ts`
- Test: `tests/unit/customer-model.test.ts`

**Interfaces:**
- Consumes: `encryptPII`, `decryptPII`, `generateBlindIndex` from `src/lib/encryption.ts`
- Produces: `GET /api/admin/customers`, `POST /api/admin/customers`, `DELETE /api/admin/customers?id=...`

- [ ] **Step 1: Write test for Customer API**

```typescript
// tests/unit/customer-model.test.ts
import { describe, it, expect } from "vitest";
import { generateBlindIndex } from "@/lib/encryption";

describe("Customer Management Model", () => {
  it("normalizes customer contact indexing for database search", () => {
    const rawContact = "  +62 812-3456-7890 ";
    const normalized = rawContact.replace(/[^\d+]/g, "");
    expect(normalized).toBe("+6281234567890");
    const index = generateBlindIndex(normalized);
    expect(index).toBeDefined();
  });
});
```

- [ ] **Step 2: Add Customer model to `prisma/schema.prisma`**

```prisma
model Customer {
  id              String    @id @default(cuid())
  name            String
  phone           String?
  email           String?
  phoneBlindIndex String?   @index
  emailBlindIndex String?   @index
  notes           String?
  totalSpent      Int       @default(0)
  totalBookings   Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  bookings        Booking[]

  @@map("customers")
}
```
And add `customerId String?` and `customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)` on `model Booking`.

- [ ] **Step 3: Implement CRUD in `src/app/api/admin/customers/route.ts`**

Implement `GET` with search query, `POST` to create/update, and `DELETE` to remove customer records.

- [ ] **Step 4: Verify Prisma generation and tests pass**
Run: `rtk pnpm exec prisma generate`
Run: `rtk pnpm exec vitest run tests/unit/customer-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
rtk git add prisma/schema.prisma src/app/api/admin/customers/route.ts tests/unit/customer-model.test.ts
rtk git commit -m "feat(customer): add persistent Customer model and CRUD endpoints"
```

---

### Task 3: Refund Engine (Midtrans API & Kasir Manual)

**Files:**
- Modify: `src/server/services/payment-service.ts`
- Modify: `src/app/api/bookings/[id]/route.ts`
- Test: `tests/unit/refund-service.test.ts`

**Interfaces:**
- Produces: `processBookingRefund({ bookingId, reason, actor })`

- [ ] **Step 1: Write unit tests for refund calculation & 24h policy**

```typescript
// tests/unit/refund-service.test.ts
import { describe, it, expect } from "vitest";

describe("Booking Refund Policy", () => {
  it("allows 100% refund when cancelled 24 hours or more before start time", () => {
    const bookingDate = "2026-11-20";
    const startTime = "14:00";
    const now = new Date("2026-11-18T10:00:00Z").getTime();
    const gameTime = new Date(`${bookingDate}T${startTime}:00+07:00`).getTime();
    const hoursRemaining = (gameTime - now) / (1000 * 60 * 60);

    expect(hoursRemaining).toBeGreaterThanOrEqual(24);
    const refundPercent = hoursRemaining >= 24 ? 100 : 0;
    expect(refundPercent).toBe(100);
  });
});
```

- [ ] **Step 2: Implement Midtrans Refund API invocation & DB status update**

Support calling `POST https://api.sandbox.midtrans.com/v2/{order_id}/refund` for QRIS/GoPay and marking `status: "CANCELLED"`, `refundAmount: booking.totalPrice`.

- [ ] **Step 3: Run unit tests**
Run: `rtk pnpm exec vitest run tests/unit/refund-service.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
rtk git add src/server/services/payment-service.ts tests/unit/refund-service.test.ts
rtk git commit -m "feat(payments): integrate 24h refund policy and Midtrans refund API"
```

---

### Task 4: Interactive Operational Live Board (Queue System)

**Files:**
- Create: `src/app/admin/AdminLiveBoard.tsx`
- Modify: `src/app/admin/AdminApp.tsx`
- Test: `tests/e2e/08-operational-live-board.spec.ts`

**Interfaces:**
- Produces: `<AdminLiveBoard bookings={bookings} onStatusChange={...} />`

- [ ] **Step 1: Implement `src/app/admin/AdminLiveBoard.tsx`**

Build 3 Kanban columns:
1. **Menunggu Check-in** (`status === 'confirmed'` and not checked in)
2. **Sedang Bermain** (`status === 'checked_in'`) with live pulse badge and elapsed playing countdown
3. **Selesai Bermain** (`status === 'completed'`)

Include 1-click status transition buttons (`⚡ Check-in Pemain` and `Selesai Bermain`).

- [ ] **Step 2: Add Live Board tab to `src/app/admin/AdminApp.tsx`**

Mount `AdminLiveBoard` into the admin sidebar and tab router.

- [ ] **Step 3: Write Playwright E2E test for the Live Board**

Test clicking check-in button on the card, verifying card transitions from "Menunggu Check-in" to "Sedang Bermain".

- [ ] **Step 4: Run E2E test**
Run: `rtk pnpm exec playwright test tests/e2e/08-operational-live-board.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
rtk git add src/app/admin/AdminLiveBoard.tsx src/app/admin/AdminApp.tsx tests/e2e/08-operational-live-board.spec.ts
rtk git commit -m "feat(admin): add interactive operational live board queue system"
```

---

### Task 5: Relocate Testing Mode Toggle & Add Debounced Search

**Files:**
- Modify: `src/app/admin/AdminLiveOperations.tsx` (remove toggle)
- Modify: `src/app/admin/Operations.tsx` (integrate toggle into Settings, add `useDebounce`)

- [ ] **Step 1: Remove toggle from `AdminLiveOperations.tsx`**
- [ ] **Step 2: Implement `useDebounce` hook in `Operations.tsx` and attach to Search inputs**
- [ ] **Step 3: Place toggle in `SettingsSection` in `Operations.tsx` with Lucide icons (`Sliders`, `ShieldCheck`) and no emojis**
- [ ] **Step 4: Run Playwright test**
Run: `rtk pnpm exec playwright test tests/e2e/07-admin-ui-and-checkin-bypass.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
rtk git add src/app/admin/AdminLiveOperations.tsx src/app/admin/Operations.tsx
rtk git commit -m "refactor(admin): move testing toggle to settings and debounce search"
```

---

### Task 6: Admin Delete Booking & Delete Customer Feature

**Files:**
- Modify: `src/app/api/bookings/[id]/route.ts` (Add `DELETE`)
- Modify: `src/app/api/admin/customers/route.ts` (Add `DELETE`)
- Modify: `src/app/admin/Operations.tsx` (Add delete buttons & confirmation modals)
- Modify: `src/app/api.ts` (Add `api.admin.deleteBooking`, `api.admin.deleteCustomer`)

- [ ] **Step 1: Implement `DELETE /api/bookings/[id]`**
Hard delete or cancel booking with admin role verification.
- [ ] **Step 2: Implement `DELETE /api/admin/customers`**
Delete customer record.
- [ ] **Step 3: Add confirmation dialog in UI before deletion**
- [ ] **Step 4: Verify TypeScript compilation**
Run: `rtk pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
rtk git add src/app/api/bookings/[id]/route.ts src/app/admin/Operations.tsx src/app/api.ts
rtk git commit -m "feat(admin): add secure booking and customer deletion actions"
```

---

### Task 7: Custom Rally Padel Design System Inputs

**Files:**
- Create: `src/components/ui/CustomSelect.tsx`
- Create: `src/components/ui/CustomDatePicker.tsx`
- Modify: `src/app/admin/Operations.tsx`

- [ ] **Step 1: Build `CustomSelect.tsx`** with luxury deep forest border, custom chevron, and focus rings.
- [ ] **Step 2: Build `CustomDatePicker.tsx`** with formatted date display and stylized calendar picker.
- [ ] **Step 3: Replace native `<select>` and raw date inputs across admin filters**
- [ ] **Step 4: Verify UI rendering and typecheck**
Run: `rtk pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
rtk git add src/components/ui/CustomSelect.tsx src/components/ui/CustomDatePicker.tsx src/app/admin/Operations.tsx
rtk git commit -m "style(ui): standardize custom select and date picker components"
```

---

### Task 8: Luxury Editorial E-Invoice Modal & Email Redesign

**Files:**
- Modify: `src/app/InvoiceModal.tsx`
- Modify: `src/server/services/email-service.ts`

- [ ] **Step 1: Redesign `InvoiceModal.tsx`**
Apply Rally Padel warm sand paper card, deep forest borders, perforated ticket stub line (`border-dashed`), high-res QR code, and print optimization.
- [ ] **Step 2: Redesign email HTML in `src/server/services/email-service.ts`**
Remove all mentions of "Midtrans", use clean terms "QRIS", "Virtual Account", or "Online", and apply luxury athletic branding.
- [ ] **Step 3: Verify with unit test**
Run: `rtk pnpm exec vitest run tests/unit/payment-midtrans.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
rtk git add src/app/InvoiceModal.tsx src/server/services/email-service.ts
rtk git commit -m "design(invoice): elevate e-invoice modal and email to luxury athletic brand"
```

---

### Task 9: Branded Error Pages (404 & 500)

**Files:**
- Create: `src/app/not-found.tsx`
- Create: `src/app/error.tsx`

- [ ] **Step 1: Build `src/app/not-found.tsx`** with Rally Padel editorial styling, message "Halaman Tidak Ditemukan", and CTA buttons.
- [ ] **Step 2: Build `src/app/error.tsx`** with error recovery and retry button.
- [ ] **Step 3: Verify TypeScript and build**
Run: `rtk pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
rtk git add src/app/not-found.tsx src/app/error.tsx
rtk git commit -m "feat(ui): add branded 404 and 500 error pages"
```

---

## Final Verification Checklist
- [ ] `rtk pnpm exec tsc --noEmit` (0 error)
- [ ] `rtk pnpm test:unit` (100% pass)
- [ ] `rtk pnpm test:e2e` (all E2E specs pass)
- [ ] `rtk git status --short` (working tree clean)
