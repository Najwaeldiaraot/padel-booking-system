---
trigger: always_on
---

# AGENTS.md

Aturan universal AI coding agent (Claude Code, Cursor, Codex, Antigravity, dll.) — berlaku di semua project. Bagian **"11. Project Overview"** disesuaikan per repo; bagian lain berlaku generik.

## 1. Prioritas Instruksi

```
Platform/System/Developer/Runtime
→ Instruksi eksplisit user
→ AGENTS.md (file ini)
→ Workflow aktif (.agents/workflows/)
→ SKILL.md relevan
→ Convention codebase
→ Context7 / dokumentasi resmi
```

Level bawah tidak boleh menimpa level atas. Ada konflik atau ambiguitas → jangan menebak, wajib tanya user.

## 2. Bahasa & Komunikasi

Bahasa Indonesia kecuali diminta lain. Jawaban jelas, langsung, teknis, to-the-point; hindari pengulangan dan asumsi tanpa bukti.
- **Permintaan jelas & pasti** → langsung kerjakan.
- **Ada ambiguitas/ketidakpastian (apapun levelnya)** → **WAJIB TANYA/KONFIRMASI KE USER**.
- Perbaikan kode via chat: berikan kode lengkap untuk function/component/config/file yang diganti (kecuali user minta diff). Dilarang mengklaim menjalankan tool/test/command yang tidak dijalankan.
- **Larangan Simbol LaTeX**: Dilarang menggunakan format simbol matematika/LaTeX seperti `$\rightarrow$` (tidak muncul/rusak di UI Antigravity); gunakan tanda panah teks biasa seperti `->` atau simbol unicode `→`.
- **Larangan Walkthrough Otomatis**: Dilarang membuat file/artefak walkthrough (`walkthrough.md`) setelah menyelesaikan tugas, KECUALI jika diminta secara eksplisit oleh user.

## 3. Inisialisasi Wajib

1. Baca file ini.
2. Pahami konteks dan jenis task (UI, bugfix, backend, arsitektur, dll.).
3. Baca **hanya skill yang benar-benar relevan** dari `.agents/skills/` atau skill global.
4. Cek `.agents/workflows/` jika ada slash command aktif.
5. `codebase-memory-mcp` sebagai discovery pertama (code/schema/dependency/architecture).
6. Context7 jika API/config/behavior version-sensitive.
7. Identifikasi seluruh ambiguitas → tanyakan ke user sebelum implementasi.

## 4. Shell via RTK (Wajib)

Semua executable shell **wajib** lewat `rtk` (github.com/rtk-ai/rtk).

```bash
rtk pnpm lint && rtk pnpm typecheck
rtk pnpm test / rtk pnpm check
rtk pnpm exec playwright test
```

Builtin shell (`cd`, env var, redirection, `&&`) boleh langsung; executable tetap lewat RTK. Tanpa filter khusus: `rtk pnpm <command>`. Dilarang raw CLI jika bisa lewat RTK. RTK gagal → perbaiki → retry; tetap gagal → stop dan laporkan. Dilarang fallback ke raw command tanpa izin user.

## 5. Caveman — Efisiensi Token

Gunakan Caveman (github.com/JuliusBrussee/caveman) untuk efisiensi context/output tanpa membuang fakta penting/kode/command/error/hasil verifikasi. Tidak menggantikan MCP, RTK, Context7, atau testing. Jika unavailable → laporkan, jangan mengarang.

## 6. Codebase Memory MCP (Wajib Mutlak & Penuh)

**ATURAN MUTLAK**: AI Coding Assistant **WAJIB PENUH** menggunakan `codebase-memory-mcp` sebagai senjata utama dan langkah discovery pertama untuk segala penelusuran kode, simbol, skema database, arsitektur, rantai pemanggilan (*caller/callee*), dan relasi dependensi.

### Standar Eksekusi Wajib MCP (Dilarang Merayapi / Buka File Manual):
1. **Pencarian Simbol / Fungsi / Tipe / Skema DB**: Wajib gunakan `search_graph` (bukan manual mencari file atau grep sembarangan).
2. **Pelacakan Relasi & Dampak Perubahan (*Blast Radius*)**: Wajib gunakan `trace_path` untuk mengetahui siapa pemanggil (*caller*), komponen yang dipanggil (*callee*), atau importir modul terkait.
3. **Membaca Implementasi Kode**: Wajib gunakan `get_code_snippet` untuk mengambil potongan kode fungsi/komponen/tipe secara presisi tanpa memuat seluruh file besar ke context window.
4. **Pola Multi-Hop & Arsitektur**: Gunakan `query_graph` dan `get_architecture` untuk eksplorasi struktural level tinggi.
5. **Pencarian Pola Kode Terindeks**: Gunakan `search_code`.
6. **Dokumentasi Keputusan Arsitektural**: Gunakan `manage_adr`.

**DILARANG KERAS**:
- Membuka file utuh ratusan baris secara manual (`view_file`) atau merayapi folder (`list_dir`) jika pencarian simbol, dependensi, dan snippet kode dapat dilakukan via `codebase-memory-mcp`.
- Melakukan shell grep sebagai jalan pintas untuk melewati MCP.

**JIKA MCP ERROR / GAGAL / UNAVAILABLE**:
- **WAJIB STOP PEKERJAAN** seketika.
- **WAJIB LAPORKAN & KONFIRMASI KE USER** detail kendala.
- **DILARANG MELANJUTKAN CODING ATAU FALLBACK** tanpa izin eksplisit user.

## 7. Context7

Wajib untuk API library/framework/behavior/version-sensitive/deprecated/config-migration (React, Next.js, Prisma, Drizzle, Zod, Tailwind, shadcn/ui, Radix, Vitest, Playwright, dll.). Alur: `resolve-library-id` → pilih yang paling relevan → `query-docs`. Jangan mengandalkan ingatan model untuk API version-sensitive.

## 8. Skills Discovery & Seleksi

Sebelum mulai bekerja, telusuri folder `.agents/skills/` (serta skill global/runtime yang tersedia) untuk mengetahui inventaris skill yang ada. Pahami jenis task yang sedang dihadapi, lalu baca **hanya file `SKILL.md` yang benar-benar relevan** dengan task tersebut (hindari memuat skill yang tidak berhubungan). Gunakan `find-skills` bila belum ada yang cocok. Dilarang menginstal, menambah, atau mengubah skill baru tanpa konfirmasi eksplisit user.

## 9. Ponytail

**Mode**: `full` untuk task kompleks (eksplorasi, debug sulit, audit, implementasi besar); `ultra` untuk risiko tinggi/cakupan luas. Task sederhana tidak perlu.
**Principles**: YAGNI · Reuse (cari helper/component/type/schema/service/hook existing dulu) · Native First · Minimal Diff · No Premature Abstraction · No Unrelated Refactor · Existing Convention First.

## 10. Anti-Asumsi & Ambiguitas (Wajib Konfirmasi)

```
Tidak tahu                       → Cari di codebase / MCP.
Ada convention pasti             → Ikuti convention.
ADA AMBIGUITAS (APAPUN LEVELNYA) → WAJIB TANYA USER (DILARANG MENEBAK/ASUMSI).
```

**WAJIB KONFIRMASI KE USER**:
- Semua requirement ambigu atau multi-tafsir (tanpa kecuali).
- Keputusan bisnis, alur kerja, atau UX yang tidak 100% pasti dari codebase.
- Perubahan behavior signifikan, arsitektur, API contract, atau skema database.
- Tindakan destruktif / delete / overwrite / migration.
- Penambahan atau upgrade dependency baru.
- Perubahan di luar scope yang diminta.

## 11. Project Overview _(QueueBPS)_

```
Stack: Next.js App Router, React 19, TypeScript
UI: Tailwind CSS, shadcn/ui, Radix UI, Lucide Icons
Data & State: PostgreSQL, Drizzle ORM, Redis (ioredis), Zod
Testing: Vitest, Playwright
Architecture: App Router + Feature-Driven (src/app, src/features, src/server, src/lib)
```

Source of truth: `package.json/lockfile → config aktual → schema/db → source code → tests → runtime config`.

## 12. Standar Implementasi

Clean code, readability, modularity, type safety, input validation, error handling, security by design, performa proporsional, konsistensi pola project. Hindari duplikasi, dead code, hardcoded value tanpa alasan, workaround rapuh, silent failure, overengineering, premature optimization, dan perubahan behavior yang tidak berkaitan.

## 13. Scope Implementasi

Alur: pahami requirement → baca skill relevan → discovery via MCP → identifikasi file terdampak → cek reuse → Context7 bila perlu → **jika ada ambigu, wajib tanya user** → implementasi.
Tanpa izin, dilarang: ubah file tak berkaitan, reformat seluruh codebase, tambah fitur opsional/dependency baru, refactor besar di luar scope, atau auto-fix masalah unrelated (laporkan sebagai saran terpisah).

## 14. Dependency Policy

Dependency baru = pilihan terakhir. Urutan: cek native capability → cek existing dependency → nilai compatibility/maintenance → dokumentasi → **konfirmasi user sebelum install**.

## 15. Security & Tindakan Berisiko

Auth/session/cookies/token/PII/upload/database/API/secrets: validasi input ketat, authorization di server-side, secret tidak masuk client bundle, no PII di log, hindari error membocorkan info sensitif.

**SELALU MINTA KONFIRMASI EKSPLISIT** sebelum:
- Hapus file/folder/branch/data/database.
- Destructive migration (drop table/column).
- Menimpa/membatalkan perubahan user.
- `git reset --hard`, `git clean`, force push.
- Ubah config/env production, ganti/rotasi credential, atau deploy.
- Jangan pernah memasukkan credential/secret/token ke source code, log, atau chat.

## 16. Testing Strategy

```
targeted test modul terkait → affected integration test → rtk pnpm lint && rtk pnpm typecheck → final diff review
(Full test suite / rtk pnpm check HANYA dijalankan saat diminta push / merge / rilis final)
```

Gunakan targeted test untuk iterasi lokal, bukan langsung seluruh test suite.

## 17. Verifikasi Pasca-Coding

Minimal wajib: `rtk pnpm lint && rtk pnpm typecheck` (dijalankan berbarengan).
Saat iterasi: jalankan **targeted test** modul terkait.
Jika diminta push/rilis: jalankan verifikasi penuh (`rtk pnpm check` / full test suite).
Final diff review wajib: `rtk git diff --check`, `rtk git diff`, `rtk git status --short` (pastikan 0 unrelated change, 0 junk file, diff minimal). Target: 0 error & 0 warning baru.

## 18. Pre-Existing Failure

Regression akibat perubahan saat ini wajib diperbaiki. Failure pre-existing di luar scope: jangan auto-fix diam-diam, laporkan bukti bahwa error sudah ada sebelum perubahan.

## 19. Clean Workspace

Hapus file temporary/scratch/debug log yang dibuat selama pengerjaan task. Jangan hapus file existing yang sah.

## 20. Workflow Coding

```
Baca AGENTS.md → identifikasi task → baca skill relevan
→ Codebase Memory MCP → pahami dependensi & konvensi
→ Context7 jika version-sensitive → ADA AMBIGU? WAJIB TANYA USER
→ minimal diff + Ponytail → targeted test → rtk pnpm lint && rtk pnpm typecheck
→ perbaiki regression → rtk git diff --check → rtk git diff → rtk git status --short
→ bersihkan temp files → laporan akhir
```

## 21. Task Non-Coding

Review/analisis/investigasi tanpa edit: gunakan MCP bila perlu, skill reviewer/security bila relevan, Context7 hanya untuk API version-sensitive. Dilarang mengubah kode kecuali diminta.

## 22. Laporan Akhir

Format laporan:
1. Perubahan yang dilakukan
2. Alasan perubahan
3. File penting yang diubah
4. Tools/skills yang digunakan
5. Hasil verifikasi (lint/typecheck/test)
6. Hal yang belum diverifikasi (jika ada)
7. Risiko / catatan tersisa

Sampaikan laporan langsung di respons chat tanpa membuat artefak/file walkthrough terpisah kecuali jika diminta secara eksplisit.

## 23. Larangan Utama

Coding tanpa memahami konteks · lewati skill relevan · lewati MCP discovery pertama · buka file manual / crawl folder tanpa memaksimalkan MCP · shell search sebagai shortcut MCP · raw CLI tanpa RTK · fallback RTK/MCP diam-diam · **menebak/asumsi saat ada ambiguitas (WAJIB TANYA)** · andalkan API version-sensitive dari ingatan · overengineering · unrelated refactor · tambah dependency tanpa konfirmasi · tinggalkan temp file · abaikan regression · membuat artefak walkthrough tanpa diminta · klaim selesai tanpa verifikasi valid.

## 24. Decision Rules

```
Pahami task?          → Identifikasi task → baca skill relevan.
Pahami codebase?      → MCP dulu.
Efisiensi token?      → Caveman.
Shell executable?     → RTK wajib.
Ada ambiguitas?       → WAJIB TANYA USER (Dilarang asumsi/menebak).
Verifikasi pasca-code → Targeted test → rtk pnpm lint && rtk pnpm typecheck.
Belum diverifikasi?   → Jangan klaim selesai.
```