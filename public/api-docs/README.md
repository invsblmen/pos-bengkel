# SDMS Dealer API — Dokumentasi (Swagger UI)

Lokasi file:

- `openapi.yaml` — spesifikasi OpenAPI 3.0 untuk endpoint autentikasi
- `index.html` — halaman Swagger UI statis yang memuat `openapi.yaml`

Cara melihat (lokal):

1. Pastikan file ada di `public/api-docs` di dalam project Laravel.
2. Jalankan server Laravel (contoh):

```bash
php artisan serve --port=8000
```

3. Buka: `http://localhost:8000/api-docs/index.html`

Catatan "Try it out":

- Untuk fitur "Try it out" bekerja di browser, server API (`https://sdmsdealer-...:22000`) harus mengizinkan CORS dari origin tempat halaman docs diload.
- Jika API tidak mengizinkan CORS, Anda bisa menggunakan proxy atau menjalankan docs dari origin yang diizinkan.

Selanjutnya saya bisa:

- Menambahkan potongan kode contoh (curl, JavaScript/fetch, PHP) ke dalam spec dan README.
- Menambah endpoint lain ke `openapi.yaml`.

Beritahu saya bahasa contoh kode yang Anda mau, lalu saya tambahkan contoh dan endpoint tambahan.

Local proxy
------------

Jika server API eksternal tidak mengizinkan CORS, jalankan proxy lokal yang saya sediakan di `scripts/node/proxy`.

1. Masuk ke folder proxy:

```bash
cd scripts/node/proxy
npm install
npm start
```

2. Buka `http://localhost:8000/api-docs/index.html` dan pilih server `http://localhost:3000/` di Swagger UI.

3. Sekarang fitur "Try it out" akan mengirimkan permintaan ke proxy lokal yang meneruskan ke API eksternal.

Catatan keamanan: proxy hanya untuk pengembangan — jangan publikasikan atau gunakan di production tanpa proteksi.

Laravel proxy (alternatif)
--------------------------

Jika Anda lebih suka proxy di server Laravel agar Swagger UI yang di-serve dari `http://localhost:8000` bisa langsung memanggil API, saya menambahkan rute proxy di `routes/api.php`.

- Endpoint yang dibuat:
	- `POST /api/authenticate` — meneruskan ke `{SDMS_API_BASE}/authenticate`
	- `ANY /api/docs-proxy/{path}` — meneruskan ke `{SDMS_API_BASE}/{path}`

Langkah untuk menggunakan:

1. Pastikan `.env` memiliki `SDMS_API_BASE` jika Anda ingin mengganti target (default: `https://sdmsdealer-h23.mpm-motor.com:22000`).
2. Jalankan Laravel dev server:

```bash
php artisan serve --port=8000
```

3. Buka `http://localhost:8000/api-docs/index.html`, pilih server `http://localhost:8000/` di Swagger UI, lalu gunakan "Try it out".

Catatan: rute proxy berada di `routes/api.php` dan menggunakan HTTP client Laravel. Proxy ini hanya untuk development.

