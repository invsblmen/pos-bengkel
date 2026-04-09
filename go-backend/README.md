# Go Backend Starter for POS Bengkel

Starter service untuk migrasi bertahap endpoint Laravel ke Go.

## Jalankan Lokal

1. Copy env file:

   cp .env.example .env

2. Jalankan service:

   go run ./cmd/api

3. Cek endpoint:

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

## Rekomendasi Lokal

Gunakan MariaDB untuk local development, bukan SQLite, supaya hasil query tetap konsisten dengan Laravel dan production.

Saran praktis:

- Laravel: schema `pos_bengkel_local`
- Go backend: schema `pos_bengkel_go_local`
- Keduanya boleh berada di instance MariaDB lokal yang sama pada port 3306

SQLite tetap boleh dipakai untuk test cepat yang tidak sensitif terhadap perilaku SQL.
