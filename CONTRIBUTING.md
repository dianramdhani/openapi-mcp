# Panduan Kontribusi (Contributing Guide)

Terima kasih telah tertarik untuk berkontribusi pada **OpenAPI MCP Server**! Kami sangat menghargai bantuan Anda dalam membuat proyek ini menjadi lebih baik.

Dokumen ini berisi panduan untuk membantu Anda memulai kontribusi, mulai dari melaporkan bug hingga mengirimkan Pull Request.

## 🌈 Kebijakan Kode Etik

Meskipun kami belum memiliki dokumen formal, kami mengharapkan semua kontributor untuk tetap sopan, profesional, dan inklusif dalam setiap interaksi di proyek ini.

## 🐛 Melaporkan Bug

Jika Anda menemukan bug atau perilaku yang tidak terduga, silakan buka **Issue** di repositori ini dengan menyertakan:

1.  **Deskripsi**: Apa masalahnya?
2.  **Langkah Reproduksi**: Bagaimana cara kami melihat bug tersebut?
3.  **Hasil yang Diharapkan**: Apa yang seharusnya terjadi?
4.  **Hasil Aktual**: Apa yang sebenarnya terjadi?
5.  **Lingkungan**: Versi Node.js, sistem operasi, dan versi OpenAPI MCP Server yang digunakan.

## 💡 Menyarankan Fitur Baru

Kami selalu terbuka untuk ide-ide baru! Untuk menyarankan fitur:

1.  Buka **Issue** baru.
2.  Gunakan label `enhancement`.
3.  Jelaskan mengapa fitur ini berguna dan bagaimana cara kerjanya.

## 🛠️ Pengembangan Lokal

Ikuti langkah-langkah di bawah ini untuk menyiapkan lingkungan pengembangan di komputer Anda:

### Prasyarat

*   **Node.js** (Versi >= 18)
*   **Yarn** (Pengelola paket yang digunakan dalam proyek ini)

### Setup Proyek

1.  **Fork dan Clone**:
    ```bash
    git clone https://github.com/dianramdhani/openapi-mcp.git
    cd openapi-mcp
    ```

2.  **Instal Dependensi**:
    Kami menggunakan Yarn, jadi pastikan Anda menggunakan perintah berikut:
    ```bash
    yarn install
    ```

3.  **Membangun Proyek**:
    Kompilasi TypeScript ke JavaScript di direktori `dist/`:
    ```bash
    yarn build
    ```

4.  **Menjalankan Mode Pengembangan**:
    ```bash
    yarn dev
    ```

5.  **Linting dan Formating**:
    ```bash
    # Cek kesalahan kode
    yarn lint

    # Perbaiki kesalahan kode secara otomatis
    yarn lint:fix
    ```

## 🧪 Pengujian (Testing)

Setiap perubahan kode sebaiknya disertai dengan pengujian untuk memastikan tidak ada fitur yang rusak.

```bash
# Menjalankan pengujian penuh (build + generator test + tsc check)
yarn test

# Menjalankan pengujian build & generator saja
yarn test:skip-tsc

# Menjalankan spesifik test case
node dist/test-generate.js /path/to/spec.json [optional-tag]
```

## 📜 Standar Kode

Untuk menjaga konsistensi kode, harap perhatikan hal-hal berikut:

*   **TypeScript**: Gunakan tipe data yang eksplisit dan hindari penggunaan `any` sebisa mungkin.
*   **Penamaan**:
    *   `PascalCase` untuk nama class dan interface.
    *   `camelCase` untuk nama fungsi, variabel, dan file `.ts` kecuali jika ada alasan khusus.
*   **Dokumentasi**: Tambahkan komentar JSDoc untuk fungsi atau logika yang kompleks agar mudah dipahami oleh kontributor lain.
*   **ES Modules**: Proyek ini menggunakan sistem modul ESM. Pastikan setiap import file lokal menyertakan ekstensi `.js`.

## 🚀 Alur Kerja Pull Request

1.  **Buat Branch Baru**: Gunakan nama yang deskriptif, misal `feat/add-msw-support` atau `fix/parser-error`.
2.  **Commit Perubahan**: 
    Kami menggunakan **Conventional Commits**. Anda disarankan menggunakan Commitizen untuk membantu menulis pesan commit yang benar:
    ```bash
    yarn commit
    ```
    Atau jika menggunakan `git commit` langsung, pastikan formatnya sesuai (misal: `feat: add something` atau `fix: bug description`). Pesan commit akan divalidasi secara otomatis.
3.  **Push ke Fork Anda**: Kirim perubahan ke repositori fork Anda di GitHub.
4.  **Buka Pull Request (PR)**:
    *   Jelaskan apa yang Anda ubah.
    *   Pastikan semua test sudah lunas (pass).
    *   Tautkan Issue yang relevan jika ada.

## 🏗️ Struktur Proyek

*   `src/index.ts`: Entry point server MCP dan tool registration.
*   `src/parser.ts`: Logika pemrosesan OpenAPI specification.
*   `src/type-generator.ts`: Logika konversi OpenAPI schema ke TypeScript types.
*   `src/service-generator.ts`: Logika pembuatan API client (services).
*   `src/output-manager.ts`: Manajemen penulisan file, deduplikasi, dan index generation.
*   `test/`: Skrip dan file pendukung untuk pengujian.

---

Sekali lagi, terima kasih telah berkontribusi! Bersama-sama kita bisa membuat alat pengembangan yang luar biasa. 🚀
