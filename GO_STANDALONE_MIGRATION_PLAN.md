# GO Standalone Migration Plan

## Catatan Pengarah Tetap (Jangan Diubah)

1. Go dan Laravel harus berjalan terpisah sebagai dua aplikasi mandiri.
2. Frontend Go harus berdiri sendiri (bukan memakai frontend Laravel saat runtime).
3. Isi/flow frontend Go harus setara dengan frontend Laravel agar transisi user tidak terasa.
4. Operasional bengkel nyata berjalan di Go lokal (offline-first), lalu data disinkronkan ke Laravel hosting.
5. Laravel hosting difungsikan untuk monitoring/reporting jarak jauh, bukan jalur transaksi utama bengkel.

## Catatan Progres Yang Sudah Ada

- Sebagian besar endpoint domain inti sudah tersedia di service Go (`go-backend/internal/httpserver/server.go`).
- Sinkronisasi Go -> Laravel sudah memiliki fondasi tabel dan endpoint (`sync_batches`, `sync_outbox_items`, `/api/v1/sync/*`, `/api/sync/*`).
- Tahap berikutnya fokus pada parity frontend Go dan hardening sync engine (idempotency, retry, observability).

## Tujuan Akhir

Menjadikan aplikasi Go sebagai sistem operasional utama bengkel yang berjalan lokal (localhost) dengan frontend sendiri, tanpa dependensi runtime ke frontend Laravel.

Laravel tetap berjalan terpisah di hosting sebagai:

- monitoring jarak jauh,
- reporting terpusat,
- backup visualisasi data dari cabang/bengkel lokal.

## Prinsip Arsitektur

1. Go = source of truth operasional harian di bengkel.
2. Laravel = consumer data sinkronisasi untuk monitoring, bukan sistem transaksi utama.
3. Operasional bengkel harus tetap berjalan saat internet putus.
4. Sinkronisasi harus idempotent, retryable, dan dapat diaudit.
5. Frontend Go menyalin perilaku UI Laravel saat ini agar transisi user mulus.

## Target Scope

### A. Frontend Go Mandiri

Frontend Go harus memiliki modul yang setara dengan Laravel saat ini:

- Dashboard
- Customers
- Vehicles
- Mechanics
- Suppliers
- Parts
- Part Purchases
- Part Sales
- Service Orders
- Appointments
- Reports utama
- Cash management

### B. Sinkronisasi Data Go -> Laravel

Arah utama sinkronisasi: satu arah dari Go lokal ke Laravel hosting.

Jenis data prioritas sinkronisasi:

- master data: customer, vehicle, part, supplier, mechanic
- transaksi: service order, part sale, part purchase, appointment
- stok/movement: part stock movements, low stock state
- agregat penting: status pembayaran, status order, total harian

## Strategi Implementasi Bertahap

### Phase 0 - Foundation

- Freeze keputusan arsitektur: Go standalone + Laravel monitoring.
- Tentukan identity strategy lintas sistem (uuid/ulid global untuk entitas utama).
- Definisikan sync protocol standar (payload envelope + metadata + signature).

Deliverable:

- Dokumen kontrak API sinkronisasi v1.
- Mapping tabel Go <-> Laravel.

### Phase 1 - Frontend Go Skeleton

- Pilih stack frontend Go (direkomendasikan: Next.js App Router + React, dijalankan sebagai app terpisah dan di-serve via Node runtime/reverse proxy lokal).
- Buat layout dan navigasi yang meniru Laravel/Inertia saat ini.
- Implementasi auth lokal untuk operasional bengkel.

Deliverable:

- halaman login,
- shell app (sidebar/topbar/routing),
- 3 modul pertama siap pakai (mis. dashboard, service order, part sales).

### Phase 2 - Feature Parity UI

- Clone perilaku halaman Laravel ke frontend Go per domain.
- Samakan validasi UI, states, filtering, sorting, pagination, print/export behavior.
- Definisikan acceptance checklist per halaman (parity checklist).

Deliverable:

- parity minimal 80% untuk semua flow operasional inti.

### Phase 3 - Sync Engine

- Tambah outbox table pada DB Go lokal untuk event perubahan data.
- Worker sinkronisasi mendorong event ke Laravel API.
- Laravel menyediakan endpoint ingest idempotent (upsert by external_id + version).
- Tambah mekanisme retry + dead-letter + manual requeue.

Deliverable:

- sinkronisasi near real-time,
- dashboard status sync (pending/sent/failed/retried),
- audit trail perubahan.

### Phase 4 - Offline-First Hardening

- Pastikan semua write operation tidak bergantung internet.
- Uji skenario internet putus 1-3 hari lalu recovery sync.
- Tambah conflict policy berbasis last-write-wins terbatas + business rule override pada data sensitif.

Deliverable:

- SOP operasional offline,
- test report recovery sync.

### Phase 5 - Cutover

- Bengkel menggunakan Go frontend + Go backend penuh.
- Laravel dialihkan ke mode monitoring-only.
- Nonaktifkan endpoint transaksi Laravel yang tidak diperlukan untuk menghindari dual write.

Deliverable:

- production cutover checklist,
- rollback plan,
- post-cutover monitoring dashboard.

## Desain Sinkronisasi (Minimal Viable)

### Event Envelope

Setiap event sinkronisasi minimal memuat:

- event_id
- entity_type
- entity_id
- action (create/update/delete)
- occurred_at
- source_node_id
- payload
- schema_version
- signature

### Idempotency

Laravel harus menyimpan:

- processed_event_id
- last_entity_version

Agar event duplikat tidak memicu double write.

### Retry Policy

- exponential backoff
- max retry count
- pindah ke dead-letter queue jika gagal permanen
- endpoint admin untuk replay event

## Risiko dan Mitigasi

1. Drift UI antara Laravel dan Go.
Mitigasi: parity checklist per halaman + snapshot visual.

2. Data mismatch saat sinkronisasi massal.
Mitigasi: checksums harian + reconciliation job.

3. Duplikasi transaksi karena replay event.
Mitigasi: idempotency key wajib di sisi Laravel ingest.

4. Beban operasional tinggi saat internet tidak stabil.
Mitigasi: queue lokal durable + observability sync status di UI Go.

## KPI Keberhasilan

- 99%+ operasi kasir/bengkel berhasil tanpa internet.
- < 5 menit median delay sinkronisasi saat koneksi normal.
- < 0.5% event gagal sinkronisasi permanen per hari.
- 100% flow operasional inti berjalan dari frontend Go.

## Action Items Minggu Ini

1. Finalkan stack frontend Go dan struktur project frontend.
2. Buat parity checklist untuk 10 halaman paling kritikal.
3. Draft kontrak API sinkronisasi v1 (Go producer, Laravel consumer).
4. Implement outbox schema + worker skeleton di Go.
5. Implement endpoint ingest idempotent pertama di Laravel (pilot: service order).
