# GO Standalone Execution Checklist

Dokumen ini menurunkan rencana besar menjadi checklist eksekusi teknis per modul.

## Kunci Arah (Locked)

- Go lokal = aplikasi operasional utama bengkel.
- Laravel hosting = monitoring/reporting + penerima sinkronisasi.
- Frontend Go harus mandiri dan parity dengan frontend Laravel.
- Tidak ada ketergantungan runtime frontend Go ke Laravel.

## Status Legenda

- done: sudah tersedia dan stabil dasar
- in-progress: sebagian sudah ada, butuh parity/hardening
- todo: belum dimulai

## Modul Operasional Inti

### 1. Service Order

- API Go parity: done
- Frontend Go parity: todo
- Sync event mapping: in-progress
- Acceptance checklist:
  - create/edit/show/print/update-status/claim warranty
  - kalkulasi biaya + diskon + pajak konsisten
  - flow pembayaran dan status akhir konsisten

### 2. Part Sales

- API Go parity: done
- Frontend Go parity: todo
- Sync event mapping: in-progress
- Acceptance checklist:
  - create/edit/show/print/update-payment/update-status
  - warranty claim dan stock movement konsisten
  - filter/pagination/index parity

### 3. Part Purchases

- API Go parity: done
- Frontend Go parity: todo
- Sync event mapping: in-progress
- Acceptance checklist:
  - create/edit/show/print/update/update-status
  - penerimaan barang memicu stock movement sesuai aturan

### 4. Appointments

- API Go parity: done
- Frontend Go parity: todo
- Sync event mapping: todo
- Acceptance checklist:
  - calendar + slot + create/update/status/export

### 5. Master Data (Customers, Vehicles, Mechanics, Suppliers, Parts)

- API Go parity: done
- Frontend Go parity: todo
- Sync event mapping: in-progress
- Acceptance checklist:
  - CRUD + search/filter utama
  - constraints data utama konsisten

### 6. Reports & Cash Management

- API Go parity: in-progress
- Frontend Go parity: todo
- Sync event mapping: n/a (kebanyakan read/aggregate)
- Acceptance checklist:
  - report utama terbuka dan konsisten
  - cash settle & change suggestion berjalan lokal

## Frontend Go Workstream

Progress terbaru:

- [x] Routing awal Batch 1 sudah ditambahkan di `go-frontend` untuk Service Orders, Part Sales, dan Part Purchases.
- [x] Scaffold halaman index/create/show/edit untuk tiga modul inti sudah tersedia sebagai baseline parity.
- [x] Build frontend Go sudah lolos setelah dependency lokal terpasang (`npm run build`).
- [x] Halaman index Service Orders/Part Sales/Part Purchases sudah memanggil API Go asli dan menampilkan tabel data dasar.
- [x] Dashboard Go sudah menampilkan panel status sinkronisasi (`/api/v1/sync/status`) untuk monitoring antrian lokal.

### Foundation

- [ ] putuskan stack final frontend Go (React/Vue + router + state + UI kit)
- [ ] struktur folder app frontend final
- [ ] auth flow lokal (login/logout/session)
- [ ] shell layout (sidebar/topbar/breadcrumb)

### Parity Batch 1 (prioritas tertinggi)

- [ ] Service Order: index/create/show/edit
- [ ] Part Sales: index/create/show/edit
- [ ] Part Purchases: index/create/show/edit

### Parity Batch 2

- [ ] Customers + Vehicles
- [ ] Mechanics + Suppliers + Parts
- [ ] Appointments + Dashboard summary

### Parity Batch 3

- [ ] Reports utama
- [ ] Cash management screens
- [ ] Sync monitoring page native Go

## Sinkronisasi Go -> Laravel Workstream

### Existing Foundation (sudah ada)

- [x] tabel sync batch/outbox
- [x] endpoint Go `/api/v1/sync/*`
- [x] endpoint Laravel `/api/sync/*`
- [x] shared token validation dasar

### Hardening Berikutnya

- [ ] outbox worker background auto-run (interval)
- [ ] idempotency guard level item (event replay aman)
- [ ] dead-letter policy + replay command
- [ ] reconciliation report harian otomatis
- [ ] dashboard operasional sync (failed/pending/acked)

## Definisi Selesai (Done Criteria)

Sebuah modul dianggap selesai bila:

1. API Go parity lulus test kontrak + test domain utama.
2. Frontend Go parity lulus UAT operator bengkel.
3. Sync event modul itu berhasil masuk Laravel tanpa mismatch mayor.
4. Skenario offline 24 jam + recovery sinkronisasi berhasil.
