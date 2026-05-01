# SDMS Dealer API — Dokumentasi Swagger

Halaman ini memuat spesifikasi OpenAPI dan Swagger UI untuk endpoint yang dipakai aplikasi Laravel:

- `openapi.yaml` — kontrak API untuk autentikasi, PKB, DeliveryOrder, dan detail item DO
- `index.html` — halaman Swagger UI statis
- `EXAMPLES.md` — contoh request `curl`, Node.js, dan PHP

## Cara membuka

Jalankan aplikasi Laravel seperti biasa, lalu buka:

```text
http://localhost:8000/api-docs/index.html
```

Jika Anda memakai `php artisan serve`:

```bash
php artisan serve --port=8000
```

## Server yang tersedia di Swagger UI

- `https://sdmsdealer-h23.mpm-motor.com:22000/` untuk produksi
- `http://localhost:8000/` untuk proxy Laravel
- `http://localhost:3000/` untuk proxy Node lokal

## Proxy lokal

Jika browser menolak request karena CORS, gunakan salah satu proxy berikut.

### Proxy Laravel

Route proxy tersedia di `routes/api.php`:

- `POST /api/authenticate`
- `GET /api/reception/Pkb`
- `GET /api/part/DeliveryOrder`
- `GET /api/part/orderitemdo`
- `ANY /api/docs-proxy/{path}`

Pilih server `http://localhost:8000/` di Swagger UI agar request lewat aplikasi ini.

### Proxy Node

Proxy Node ada di `scripts/node/proxy`.

```bash
cd scripts/node/proxy
npm install
npm start
```

Lalu pilih server `http://localhost:3000/` di Swagger UI.

## Catatan penggunaan

- Endpoint PKB dan DeliveryOrder membutuhkan header `Authorization`, `username`, dan `idInternal`.
- Endpoint `orderitemdo` memakai query `fill` untuk mengambil detail item berdasarkan `idBilling`.
- Proxy Laravel sekarang mengisi `idInternal` dari claim token bila tersedia agar tidak terjadi mismatch dengan upstream.

## Jika Anda ingin menambah endpoint

Tambahkan definisi schema dan path baru ke `openapi.yaml`, lalu tulis contoh request di `EXAMPLES.md`.

