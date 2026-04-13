# Go Backend Starter for POS Bengkel

Starter service untuk migrasi bertahap endpoint Laravel ke Go.

## Guardrail Arsitektur (Wajib)

1. Go local adalah jalur operasi utama harian bengkel.
2. Laravel hosting dipakai untuk monitoring online, fallback, dan sinkronisasi.
3. Jalur realtime GO wajib native WebSocket GO (`/ws`) dan tidak bergantung Echo/Reverb.
4. Frontend jalur GO boleh implementasi source terpisah, tetapi parity fitur/desain/UX harus tetap sama.

## Jalankan Lokal

1. Copy env file:

   cp .env.example .env

2. Jalankan service:

   go run ./cmd/api

   Optional security for local realtime websocket:
   - set env `GO_WS_TOKEN=your-local-token`
   - connect websocket using `ws://127.0.0.1:8081/ws?token=your-local-token`

3. Cek endpoint:

- GET /go-ui (native UI untuk monitoring cepat service Go dengan WebSocket real-time)
- GET /ws (WebSocket endpoint untuk realtime events jalur GO, tidak bergantung Reverb)
- GET /api/v1/realtime/subscribers (debug subscriber count per domain)
- GET /health
- GET /ready
- GET /live
- GET /api/v1/whatsapp/health/check
- POST /api/v1/webhooks/whatsapp
- GET /api/v1/appointments
- GET /api/v1/appointments/calendar
- GET /api/v1/appointments/slots
- POST /api/v1/appointments
- GET /api/v1/appointments/{id}
- GET /api/v1/appointments/{id}/export
- POST /api/v1/part-purchases/{id}/update-status
- POST /api/v1/part-sales
- GET /api/v1/part-sales
- GET /api/v1/part-sales/warranties
- GET /api/v1/part-sales/warranties/export
- GET /api/v1/part-sales/{id}
- GET /api/v1/part-sales/{id}/print
- GET /api/v1/part-sales/{id}/edit
- PUT /api/v1/part-sales/{id}
- DELETE /api/v1/part-sales/{id}
- POST /api/v1/part-sales/create-from-order
- POST /api/v1/part-sales/{id}/update-payment
- POST /api/v1/part-sales/{id}/update-status
- POST /api/v1/part-sales/{partSale}/details/{detail}/claim-warranty
- GET /api/v1/part-stock-history
- GET /api/v1/part-stock-history/export
- PUT /api/v1/appointments/{id}
- PATCH /api/v1/appointments/{id}/status
- DELETE /api/v1/appointments/{id}
- GET /api/v1/parts/low-stock
- POST /api/v1/cash-management/change/suggest
- POST /api/v1/cash-management/sale/settle
- GET /api/v1/reports/part-sales-profit
- GET /api/v1/reports/part-sales-profit/by-supplier
- GET /api/v1/reports/overall
- GET /api/v1/reports/service-revenue
- GET /api/v1/reports/mechanic-productivity
- GET /api/v1/reports/mechanic-payroll
- GET /api/v1/reports/parts-inventory
- GET /api/v1/reports/outstanding-payments
- GET /api/v1/reports/export
- GET /api/v1/sync/status
- GET /api/v1/sync/batches
- POST /api/v1/sync/batches
- POST /api/v1/sync/run
- POST /api/v1/sync/batches/{id}/send
- POST /api/v1/sync/batches/{id}/retry
- GET /api/v1/vehicles/{id}/maintenance-insights
- GET /api/v1/vehicles/{id}/service-history
- GET /api/v1/vehicles/{id}/with-history
- GET /api/v1/vehicles/{id}/recommendations
- GET /api/v1/vehicles/{id}/maintenance-schedule

Default port: 8081.

## Struktur Folder

- cmd/api: entrypoint service.
- internal/config: parsing environment.
- internal/httpserver: setup mux + server.
- internal/middleware: middleware logging dan request id.
- docs/openapi: template kontrak endpoint.

## Catatan Integrasi

Pada fase awal, routing masih dikelola Laravel/proxy. Endpoint Go dipublikasikan bertahap sesuai wave.

## Konfigurasi DB untuk Endpoint Vehicle

Isi env berikut agar endpoint vehicle insights dapat query ke database:

- DB_HOST
- DB_PORT
- DB_DATABASE
- DB_USERNAME
- DB_PASSWORD
- DB_PARAMS

## Mode Database Lokal

Go backend sekarang mendukung dua mode database:

- `sqlite` untuk target local-first workshop mode
- `mysql` untuk parity mode dengan schema Laravel/MariaDB

Contoh mode SQLite:

```env
GO_DATABASE_DRIVER=sqlite
GO_DATABASE_SQLITE_PATH=./data/posbengkel.db
```

Contoh mode MySQL:

```env
GO_DATABASE_DRIVER=mysql
GO_DATABASE_HOST=127.0.0.1
GO_DATABASE_PORT=3306
GO_DATABASE_NAME=pos_bengkel_go_local
GO_DATABASE_USER=pos_bengkel
GO_DATABASE_PASSWORD=pos_bengkel_password
```

Catatan penting:

1. Runtime server Go akan mengikuti `GO_DATABASE_DRIVER`.
2. Env `DB_*` lama masih dibaca sebagai fallback agar setup lama tidak langsung rusak.
3. Sebagian handler masih dibuat dari query parity Laravel, jadi mode SQLite perlu diverifikasi endpoint per endpoint saat migrasi local-first dilanjutkan.

## Konfigurasi Sync Local -> Hosting

Isi env berikut di `go-backend/.env` untuk mengaktifkan sinkronisasi ke Laravel hosting:

- GO_SYNC_ENABLED=true
- GO_SYNC_HOST_URL=http://127.0.0.1:8000
- GO_SYNC_SHARED_TOKEN=isi-token-yang-sama-dengan-laravel
- GO_SYNC_SOURCE_ID=local-workshop
- GO_SYNC_REQUEST_TIMEOUT=20s
- GO_SYNC_WORKER_ENABLED=false
- GO_SYNC_WORKER_INTERVAL=30s
- GO_SYNC_WORKER_LIMIT=3

Catatan operasional:

1. Saat startup, Go akan mencoba bootstrap tabel `sync_batches` dan `sync_outbox_items` secara otomatis.
2. Jika koneksi DB sedang gagal, server tetap hidup dalam mode degraded (endpoint yang butuh DB akan memberi respons service unavailable).
3. Endpoint `POST /api/v1/sync/run` akan membuat batch dan langsung mengirim ke Laravel (`/api/sync/batches`).
4. Jika `GO_SYNC_WORKER_ENABLED=true`, background worker Go akan otomatis memproses batch `pending/retrying/failed` secara periodik.
