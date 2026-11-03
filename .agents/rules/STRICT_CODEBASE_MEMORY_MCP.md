# Strict Codebase Memory MCP Enforcement

> [!CAUTION]
> **CBM-FIRST — STRICT CODE DISCOVERY POLICY**
>
> Proyek ini menggunakan `codebase-memory-mcp` sebagai **alat utama untuk menemukan kode dan menelusuri relasi antarsimbol**. Agent WAJIB mengutamakan MCP sebelum menjalankan pencarian teks umum terhadap source code. Kebijakan ini berlaku untuk Codex, Claude Code, Antigravity, dan agent lain yang membaca dokumen ini.
>
> **Prinsip:** MCP-first, bukan MCP-only untuk seluruh aktivitas. Jangan mengorbankan kebenaran, keamanan perubahan, atau pengujian hanya demi menghindari `Read`.

## 1. Larangan Pencarian Source Code di Luar MCP

1. **DILARANG sebagai langkah pertama:** Menggunakan `default_api:grep_search`, `grep`, `rg`, `findstr`, `Select-String`, `Get-ChildItem -Recurse` untuk mencari isi kode, atau fitur pencarian kode lain sebagai pengganti MCP.
2. **WAJIB menggunakan MCP:** Untuk mencari fungsi, variabel, class, komponen, implementasi, caller/callee, referensi, dan dependensi, gunakan tool yang benar-benar tersedia pada server `codebase-memory-mcp` seperti `search_code`, `search_graph`/`query_graph`, `get_file_outline`, `get_code_snippet`, dan `trace_path` sesuai skema tool yang terdaftar.
3. **Tidak boleh fallback diam-diam:** Kegagalan satu panggilan MCP bukan alasan berpindah langsung ke grep atau membaca seluruh repository.
4. **Pengecualian pencarian non-kode:** Pencarian teks biasa diperbolehkan untuk dokumentasi dan data non-source seperti `.md`, `.json`, `.env.example`, log, dan file konfigurasi, jika MCP tidak menyediakan hasil yang sesuai. **Jangan membuka atau mencetak isi rahasia `.env` secara sembarangan.**

## 2. Urutan Eksplorasi Wajib

Ikuti urutan berikut, dan berhenti apabila informasi yang diperlukan sudah cukup:

1. **Discover:** Gunakan `search_graph`/`query_graph` untuk menemukan simbol atau `search_code` untuk pola teks, termasuk string literal dan identifier.
2. **Scope:** Gunakan `get_file_outline` bila perlu memahami struktur file. Batasi `path_pattern`, nama simbol, atau filter lain agar hasil relevan.
3. **Inspect:** Gunakan `get_code_snippet` untuk membaca implementasi fungsi/method spesifik jika tool tersedia dan hasilnya mencakup konteks yang dibutuhkan.
4. **Trace:** Gunakan `trace_path` atau kemampuan relasi graph untuk mengetahui alur pemanggilan dan dependensi bila relevan.
5. **Verify:** Gunakan `Read`/pembaca file untuk memverifikasi isi terkini, konteks JSX, import, konfigurasi, lokasi edit, atau implementasi penuh yang tidak tercakup dalam snippet.
6. **Edit & test:** Gunakan alat edit dan eksekusi yang sesuai. Jalankan pemeriksaan, build, serta tes yang relevan setelah perubahan.

**Aturan efisiensi:** Jangan membuka file penuh hanya untuk membaca satu fungsi yang sudah dapat diperoleh lewat snippet. Jangan mengulang pencarian dengan pola setara tanpa alasan yang jelas.

## 3. Penanganan Error dan Index

1. Jika pemanggilan MCP gagal karena argumen salah (misalnya `query` alih-alih `pattern`), **baca schema/error lalu ulangi dengan argumen yang benar**.
2. Jika hasil kosong, periksa batas `path_pattern`, nama proyek, penulisan simbol, filter, serta kemungkinan pagination. Coba variasi pencarian yang masuk akal, bukan loop tanpa batas.
3. Jika hasil graph bertentangan dengan source code atau dicurigai usang, cek cakupan/status index melalui tool yang tersedia dan lakukan reindex sesuai prosedur server jika diperlukan.
4. Source code aktual adalah **sumber kebenaran terakhir** untuk perubahan. Hasil graph/index dapat tertinggal dari perubahan terbaru atau tidak menangkap semua pola dinamis.
5. Fallback pencarian source code non-MCP hanya boleh setelah MCP tidak tersedia, index relevan gagal/tidak mencakup target setelah upaya perbaikan yang wajar, atau tugas memerlukan pemeriksaan tekstual yang memang tidak dapat diberikan MCP. Jelaskan alasan fallback secara singkat.

## 4. Penggunaan Read yang Diizinkan

`Read` **bukan pelanggaran** bila dipakai secara terarah untuk:

- Membaca beberapa baris konteks sebelum mengedit, memeriksa import, JSX/TSX, tipe, dan efek samping.
- Memverifikasi isi file setelah pengeditan atau membandingkan hasil dengan snippet yang mungkin stale.
- Membaca file kecil, konfigurasi, tes, atau data yang tidak terwakili secara baik di graph.
- Menyelidiki bug yang memerlukan konteks lintas baris, runtime, atau perilaku dinamis.

Hindari membaca banyak file penuh secara berurutan apabila CBM sudah memberi lokasi dan potongan kode yang cukup.

## 5. Kualitas dan Kepatuhan

- **Ketepatan lebih penting daripada kepatuhan mekanis:** jangan mengarang kode atau mengandalkan graph tanpa verifikasi saat mengubah perilaku aplikasi.
- **Minimal context:** pilih query sempit, snippet relevan, dan perluas hanya sesuai kebutuhan.
- **Tidak menghalangi pengujian:** perintah menjalankan test, lint, typecheck, build, dan pemeriksaan git tetap diperbolehkan. Jangan mengalihkan seluruh aktivitas shell ke MCP.
- **Transparan:** saat memakai fallback untuk mencari source code, sebutkan alasan faktualnya, bukan sekadar menyatakan MCP gagal.
- **Periksa kemampuan nyata:** nama tool dapat berbeda menurut versi MCP dan client. Gunakan tool serta parameter yang benar-benar tersedia; jangan mengarang nama atau argumen.

## 6. Checklist Sebelum Mencari Kode

- [ ] Sudah mencoba `search_graph`/`query_graph` atau `search_code` yang sesuai?
- [ ] Sudah mempersempit ruang pencarian agar tidak menghasilkan konteks berlebihan?
- [ ] Sudah memakai outline/snippet/trace bila relevan dan tersedia?
- [ ] Jika MCP error, sudah memeriksa schema dan memperbaiki pemanggilan?
- [ ] Jika memakai `Read`, apakah ada kebutuhan konkret untuk membaca source aktual?
- [ ] Jika fallback ke pencarian teks biasa, apakah alasannya sesuai pengecualian dan dijelaskan?

**Ringkasan:** **CBM untuk discovery dan penelusuran graph → snippet untuk inspeksi terarah → Read untuk verifikasi/edit → test untuk memastikan hasil.**
