# Project Guide - POS Bengkel

Panduan terpusat untuk setup, pengembangan, testing, dan referensi fitur utama.

## Daftar Isi

1. [1. Ringkasan Proyek](#1-ringkasan-proyek)
2. [2. Tech Stack](#2-tech-stack)
3. [3. Setup Cepat (Device Baru)](#3-setup-cepat-device-baru)
4. [4. Troubleshooting Umum](#4-troubleshooting-umum)
5. [5. SOP Pengembangan Fitur Baru](#5-sop-pengembangan-fitur-baru)
6. [6. Ringkasan Fitur Diskon & Pajak](#6-ringkasan-fitur-diskon--pajak)
7. [7. Frontend Payload Acuan](#7-frontend-payload-acuan)
8. [8. Inline Creation (Part Category/Supplier)](#8-inline-creation-part-categorysupplier)
9. [9. Testing Cepat](#9-testing-cepat)
10. [10. Konvensi Penamaan](#10-konvensi-penamaan)
11. [11. Checklist Singkat Harian](#11-checklist-singkat-harian)
12. [12. Catatan Stabilitas Lokal](#12-catatan-stabilitas-lokal)
13. [13. Landasan Operasi Target](#13-landasan-operasi-target)
14. [14. Rancangan Sinkronisasi Local ke Hosting](#14-rancangan-sinkronisasi-local-ke-hosting)
15. [15. Referensi Desain Sinkron](#15-referensi-desain-sinkron)
16. [16. Referensi Tracking Migrasi](#16-referensi-tracking-migrasi)
17. [17. Boundary Arsitektur dan Audit Coupling](#17-boundary-arsitektur-dan-audit-coupling)

## 1. Ringkasan Proyek

POS Bengkel adalah sistem kasir dan operasional bengkel motor berbasis Laravel + Inertia + React.

Dokumen boundary dan audit terbaru:
1. `ARCHITECTURE_BOUNDARY.md`
2. `GO_TO_LARAVEL_SYNC_CHECKLIST.md`
3. `BACKEND_COUPLING_AUDIT_2026-04-14.md`

Cakupan utama:
1. Service order dan appointment
2. Manajemen mekanik, kendaraan, pelanggan
3. Inventori sparepart, pembelian, dan penjualan
4. Payment, invoice, dan reporting

## 2. Tech Stack

1. Laravel 12
2. Inertia.js + React 18
3. Tailwind CSS 3
4. Spatie Laravel Permission
5. Realtime split: Laravel Reverb + Laravel Echo (jalur Laravel), WebSocket native GO (jalur GO)

## 3. Setup Cepat (Device Baru)

### 3.1 Prasyarat

1. PHP 8.4+
2. Composer 2+
3. Node.js 20+ dan npm
4. MySQL/MariaDB
5. Laravel Herd (opsional, direkomendasikan di Windows)

### 3.2 Install

```bash
git clone https://github.com/invsblmen/pos_bengkel.git
cd pos_bengkel
composer install
npm install
copy .env.example .env
php artisan key:generate
```

### 3.3 Konfigurasi `.env` minimum (jalur Laravel)

Catatan penting:
1. Blok Reverb di bawah ini khusus jalur Laravel.
2. Jalur GO local gunakan konfigurasi websocket GO pada frontend Next (`NEXT_PUBLIC_WS_URL`, opsional `NEXT_PUBLIC_WS_TOKEN`).

```env
APP_NAME="POSBengkel"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://pos-bengkel.test

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel12_pos_bengkel
DB_USERNAME=root
DB_PASSWORD=root

BROADCAST_CONNECTION=reverb

REVERB_APP_ID=pos-bengkel-app
REVERB_APP_KEY=pos-bengkel-key
REVERB_APP_SECRET=pos-bengkel-secret
REVERB_HOST=pos-bengkel.test
REVERB_PORT=8080
REVERB_SCHEME=http

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"

# GO native realtime path (untuk frontend jalur GO / Next.js)
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8081/ws
NEXT_PUBLIC_WS_TOKEN=
```

Catatan:
1. Gunakan domain tanpa underscore.
2. Hindari `pos_bengkel.test` karena bisa memicu redirect/browser issue.

### 3.4 Setup Herd (opsional)

```bash
cd ..
herd forget
cd pos_bengkel
herd unlink pos_bengkel
herd link pos-bengkel
herd links
herd sites
```

Opsional HTTPS:

```bash
herd secure pos-bengkel
```

Jika HTTPS aktif:

```env
APP_URL=https://pos-bengkel.test
REVERB_SCHEME=https
```

### 3.5 Database dan Run

```bash
php artisan migrate --seed
php artisan storage:link
php artisan config:clear
```

Jalankan aplikasi (jalur Laravel):

```bash
php artisan reverb:start
npm run dev
php artisan serve
```

Untuk jalur GO local, realtime tidak bergantung pada `php artisan reverb:start`; pastikan GO API berjalan dan frontend GO mengarah ke `NEXT_PUBLIC_WS_URL`.

Jika pakai Herd, `php artisan serve` tidak wajib.

## 4. Troubleshooting Umum

1. `Failed to resolve import "laravel-echo"` (khusus jalur Laravel)

```bash
npm install
npm ls laravel-echo pusher-js --depth=0
```

2. `You must pass your app key when you instantiate Pusher` (khusus jalur Laravel)

Periksa `VITE_REVERB_APP_KEY` di `.env` dan restart Vite.

3. `Class "Pusher\\Pusher" not found` (khusus jalur Laravel)

```bash
composer require pusher/pusher-php-server
```

4. Perubahan `.env` tidak terbaca

```bash
php artisan config:clear
```

5. Port Vite 5173 terpakai

Normal, Vite akan pindah ke port lain.

6. Reverb tidak reachable dari browser atau Echo gagal connect (khusus jalur Laravel)

```bash
php artisan list | findstr /i reverb
php artisan reverb:watchdog-status --lines=20
php artisan reverb:watchdog-maintain --max-kb=1024 --keep-lines=600
```

Jika status menunjukkan Reverb tidak hidup, jalankan ulang runtime manual:

```powershell
scripts\manual-runtime.ps1 -Action start -WithReverb
scripts\manual-runtime.ps1 -Action status
```

Jika port 8080 sudah dipakai tetapi event tetap tidak masuk, cek apakah proses yang menempati port masih milik project ini dan pastikan `.env` memakai `REVERB_HOST=pos-bengkel.test` serta `REVERB_SCHEME=http` untuk dev lokal.

## 5. SOP Pengembangan Fitur Baru

### 5.1 Backend

1. Buat controller: `php artisan make:controller Apps/NamaController`
2. Buat model+migration: `php artisan make:model NamaModel -m`
3. Lengkapi schema, fillable, casts, relasi
4. Jalankan migration: `php artisan migrate`
5. Tambahkan route + middleware permission di `routes/web.php`

### 5.2 Permission

Buat permission minimal:
1. `resource-access`
2. `resource-create`
3. `resource-update`
4. `resource-delete`

Assign ke role admin dan user test.

### 5.3 Frontend

1. Tambah page di `resources/js/Pages/Dashboard/NamaFitur/`
2. Minimal `Index.jsx`, `Create.jsx`, `Edit.jsx`
3. Tambah menu di `resources/js/Utils/Menu.jsx`
4. Pastikan route name konsisten frontend-backend

### 5.4 Verifikasi

```bash
php artisan route:clear
php artisan cache:clear
php artisan config:clear
php artisan route:list --name=resource-name
npm run build
```

## 6. Ringkasan Fitur Diskon & Pajak

Dukungan diskon/pajak ada di:
1. Purchases
2. Part Purchases
3. Part Sales
4. Service Orders

Tipe:
1. `none`
2. `percent`
3. `fixed`

Level:
1. Item-level discount (detail rows)
2. Transaction-level discount
3. Transaction-level tax

Formula inti:
1. `amount_after_discount = subtotal - discount_amount`
2. `grand_total = amount_after_discount + tax_amount`

Service utama: `App\Services\DiscountTaxService` untuk validasi dan kalkulasi total.

## 7. Frontend Payload Acuan

Contoh field penting untuk form transaksi:

```json
{
  "items": [
    {
      "part_id": 1,
      "qty": 2,
      "unit_price": 100000,
      "discount_type": "percent",
      "discount_value": 10
    }
  ],
  "discount_type": "percent",
  "discount_value": 5,
  "tax_type": "percent",
  "tax_value": 10
}
```

## 8. Inline Creation (Part Category/Supplier)

Fitur inline creation tersedia pada form pembuatan part.

Endpoint:
1. `POST /part-categories/storeAjax`
2. `POST /suppliers/storeAjax`

Tujuan:
1. Tambah category/supplier tanpa keluar dari form part
2. Item baru langsung bisa dipilih

## 9. Testing Cepat

### 9.1 Smoke test

1. Login sebagai admin
2. Buka dashboard
3. Uji CRUD:
- service categories
- part categories
- services
4. Uji service order list dan filter
5. Cek toast/error di browser

### 9.2 Data check (opsional)

```bash
php artisan tinker
```

```php
App\Models\ServiceCategory::count();
App\Models\PartCategory::count();
App\Models\Service::count();
App\Models\ServiceOrder::count();
```

## 10. Konvensi Penamaan

1. URL: kebab-case (contoh: `/dashboard/service-categories`)
2. Route name: `resource.action` (contoh: `service-categories.index`)
3. Permission: `resource-action` (contoh: `service-categories-access`)
4. Controller/Model: PascalCase

## 11. Checklist Singkat Harian

```bash
composer install
npm install
php artisan migrate --seed
php artisan config:clear
php artisan reverb:start
npm run dev
```

## 12. Catatan Stabilitas Lokal

## 13. Landasan Operasi Target

1. Laravel akan tetap digunakan di server hosting untuk monitoring online dan akses jarak jauh.
2. Go akan digunakan di local untuk eksekusi operasional bengkel yang butuh performa tinggi.
3. Kedua project harus tetap identik dari sisi perilaku bisnis dan alur data.
4. Sinkronisasi dari local ke hosting menjadi fitur lanjutan, bukan pengganti operasional lokal.
5. Jika ada perbedaan, perbedaan hanya boleh ada pada bahasa implementasi dan optimasi performa.
6. Frontend yang dikonsumsi user akhir harus sama secara tampilan, interaksi, dan alur (Go-backed maupun Laravel-backed).
7. Perbedaan backend tidak boleh terlihat oleh user pada level UI/UX.

Kriteria frontend parity:

1. Struktur payload/props Go harus kompatibel dengan kontrak frontend Laravel.
2. Pagination, filter, sorting, empty/loading/error states harus berperilaku sama.
3. Format tanggal, angka, mata uang, dan teks error harus konsisten.
4. Event realtime harus kompatibel (nama event, urutan, dan bentuk payload).
5. Semua layar kritikal harus lolos uji side-by-side sebelum dinyatakan selesai.

## 14. Rancangan Sinkronisasi Local ke Hosting

Tujuan sinkronisasi:

1. Mengirim ringkasan dan detail transaksi dari Go local ke Laravel hosting untuk monitoring online.
2. Menjaga agar operasional bengkel tetap cepat di local tanpa menunggu koneksi hosting.
3. Memberi audit trail yang jelas saat data berhasil dikirim, gagal dikirim, atau perlu retry.

Model operasi yang disarankan:

1. Local-first write: semua transaksi harian ditulis dulu ke Go local.
2. Outbox sync queue: setiap data yang perlu dikirim ke hosting masuk ke antrian sinkron lokal.
3. Scheduled sync: job harian mengirim data saat jam tutup atau saat koneksi stabil.
4. Manual sync button: operator bisa memaksa kirim ulang jika dibutuhkan.
5. Reconcile mode: hosting menandai data yang sudah diterima agar tidak double insert.

Entitas yang disarankan untuk disinkronkan terlebih dahulu:

1. Service order summary harian.
2. Part sales harian.
3. Part purchases harian.
4. Cash movement / settlement harian.
5. Snapshot stok dan perubahan penting.

Aturan teknis:

1. Gunakan `sync_batch_id` atau `source_event_id` sebagai idempotency key.
2. Simpan status sinkron per batch: pending, sent, acknowledged, failed, retrying.
3. Simpan error terakhir dan waktu percobaan terakhir.
4. Jika hosting belum bisa diakses, data tetap aman di local dan masuk retry queue.
5. Konflik data harus diselesaikan dengan aturan deterministik, bukan edit manual langsung pada payload.

Opsi UI yang disarankan di Go local:

1. Halaman manajemen sinkron dengan status terakhir.
2. Tombol `Sync Now` untuk kirim batch pending.
3. Tombol `Retry Failed` untuk batch yang gagal.
4. Ringkasan `last synced at`, `pending count`, dan `failed count`.
5. Log sinkron per hari yang bisa dibuka operator.

Catatan implementasi:

1. Sinkronisasi harus dipisah dari jalur transaksi utama agar tidak memperlambat kasir.
2. Kegagalan sinkron tidak boleh menggagalkan transaksi lokal.
3. Laravel hosting cukup menjadi penerima dan agregator monitoring, bukan pengontrol operasional local.

## 15. Referensi Desain Sinkron

Dokumen teknis utama untuk implementasi sinkronisasi ada di [GO_SYNC_DESIGN.md](GO_SYNC_DESIGN.md). Gunakan dokumen itu sebagai acuan untuk:

1. Struktur tabel sinkron.
2. Kontrak endpoint sync.
3. Aturan idempotency dan retry.
4. Desain dashboard manajemen sinkron di Go local.
5. Mekanisme rekonsiliasi dan conflict handling.

## 16. Referensi Tracking Migrasi

1. `GO_MIGRATION_BLUEPRINT.md`
2. `GO_MIGRATION_TASKS_WEEKLY.md`
3. `GO_MIGRATION_WAVES.md`

## 17. Boundary Arsitektur dan Audit Coupling

1. Policy boundary stack:
  `ARCHITECTURE_BOUNDARY.md`
2. Checklist implementasi sinkronisasi GO -> Laravel:
  `GO_TO_LARAVEL_SYNC_CHECKLIST.md`
3. Hasil audit backend route/controller:
  `BACKEND_COUPLING_AUDIT_2026-04-14.md`

Gunakan dokumen berikut sebagai acuan tracking operasional migrasi:

1. `MIGRATION_MASTER_CHECKLIST.md` untuk status menyeluruh, weekly milestones, dan completion gate.
2. `FRONTEND_PARITY_MATRIX.md` untuk parity layar per layar (Laravel-backed vs Go-backed).

## 17. Operasional Scheduler Sync Go

Tujuan bagian ini adalah memastikan sync harian berjalan otomatis tanpa intervensi manual.

Konfigurasi env:

```env
GO_SYNC_ENABLED=true
GO_SYNC_RUN_TIMEOUT_SECONDS=60
GO_SYNC_RETRY_TIMEOUT_SECONDS=60
GO_SYNC_ALERT_TIMEOUT_SECONDS=30
GO_SYNC_RECONCILIATION_TIMEOUT_SECONDS=45
GO_SYNC_RETENTION_DAYS=30
GO_SYNC_RETENTION_PURGE_ENABLED=true
GO_SYNC_RETENTION_PURGE_DAILY_AT=03:20
GO_SYNC_RETRY_DEFAULT_LIMIT=5
GO_SYNC_RETRY_MAX_LIMIT=200
GO_SYNC_SCHEDULE_ENABLED=true
GO_SYNC_SCHEDULE_DAILY_AT=23:40
GO_SYNC_SCHEDULE_RETRY_LIMIT=5
GO_SYNC_ALERT_ENABLED=true
GO_SYNC_ALERT_FAILED_MINUTES=120
GO_SYNC_ALERT_LIMIT=20
GO_SYNC_RECONCILIATION_ENABLED=true
GO_SYNC_RECONCILIATION_DAILY_AT=00:15
GO_SYNC_RECONCILIATION_MAX_VARIANCE=5
```

Command operasional:

```bash
php artisan go:sync:run --scope=daily
php artisan go:sync:retry-failed --limit=5
php artisan go:sync:alert-long-failed --minutes=120 --limit=20
php artisan go:sync:reconciliation-daily --max-variance-percent=5
php artisan go:sync:purge-old --days=30 --dry-run=1
php artisan go:sync:benchmark-capacity --timeouts=60,120,180 --iterations=1
```

Contoh retry dengan backoff policy:

```bash
php artisan go:sync:retry-failed --limit=5 --base-minutes=5 --max-minutes=240 --respect-backoff=1
```

Jadwal yang terpasang saat scheduler aktif:

1. `go:sync:run --scope=daily` dijalankan harian pada jam `GO_SYNC_SCHEDULE_DAILY_AT` (default 23:40).
2. `go:sync:retry-failed --limit={GO_SYNC_SCHEDULE_RETRY_LIMIT}` dijalankan tiap 30 menit.
3. `go:sync:alert-long-failed` dijalankan tiap 30 menit saat `GO_SYNC_ALERT_ENABLED=true`.
4. `go:sync:reconciliation-daily` dijalankan harian pada jam `GO_SYNC_RECONCILIATION_DAILY_AT` (default 00:15) saat `GO_SYNC_RECONCILIATION_ENABLED=true`.
5. `go:sync:purge-old --days={GO_SYNC_RETENTION_DAYS}` dijalankan harian pada jam `GO_SYNC_RETENTION_PURGE_DAILY_AT` (default 03:20) saat `GO_SYNC_RETENTION_PURGE_ENABLED=true`.

Verifikasi jadwal:

```bash
php artisan schedule:list
```

Perintah reconciliation membandingkan:
- Go backend: batch_total, pending, failed, acknowledged
- Laravel received: received, acknowledged, duplicate, invalid, failed

Jika variance % melampaui threshold (default 5%), command mengembalikan exit code 1 dan menlog alert.

Untuk operasional harian yang konsisten, gunakan script agregasi metrik berikut:

```powershell
./scripts/collect-go-migration-metrics.ps1 -Date 2026-04-11 -VarianceThreshold 5 -TrendDays 7
```

Script akan menjalankan reconciliation dan ringkasan metrik sync yang masih aktif, lalu menyimpan laporan ke `storage/logs/go-migration/metrics-<date>-<timestamp>.log`.

Profil tuning awal (disarankan):

1. Dataset kecil/menengah: timeout run/retry 60 detik, retry default limit 5.
2. Dataset besar (jam sibuk): timeout run/retry 120-180 detik, retry default limit 10-20.
3. Batas aman: `GO_SYNC_RETRY_MAX_LIMIT` jangan di atas 200 tanpa load test, untuk mencegah lonjakan request retry serentak.

Command benchmark kapasitas:

```bash
php artisan go:sync:benchmark-capacity --timeouts=60,120,180 --iterations=3
```

Output benchmark menampilkan:

1. Ringkasan per timeout: success/failed, min/avg/p95/max latency.
2. Detail per percobaan: duration, HTTP status, send status, batch id.
3. Log terstruktur ke aplikasi: `go_sync_capacity_benchmark`.

Baseline lokal terakhir (2026-04-11, `--iterations=10`):

1. Timeout 60s: success 10/10, p95 351.94 ms, max 372.63 ms, HTTP 200 acknowledged.
2. Timeout 120s: success 10/10, p95 313.91 ms, max 316.52 ms, HTTP 200 acknowledged.
3. Timeout 180s: success 10/10, p95 269.08 ms, max 275.69 ms, HTTP 200 acknowledged.

Rekomendasi final sementara (berdasarkan benchmark lokal):

1. Pertahankan default `GO_SYNC_RUN_TIMEOUT_SECONDS=60` dan `GO_SYNC_RETRY_TIMEOUT_SECONDS=60`.
2. Simpan `GO_SYNC_ALERT_TIMEOUT_SECONDS=30` dan `GO_SYNC_RECONCILIATION_TIMEOUT_SECONDS=45`.
3. Naikkan timeout ke 120 hanya jika pada traffic nyata p95 mulai mendekati 60.000 ms.

### 17.1 Threshold Mismatch dan Sign-off

Matrix threshold operasional (baseline):

| Area | Indikator | Warning | Critical | Keputusan |
| --- | --- | --- | --- | --- |
| Sync Reconciliation | Variance batch_total | > 5% | > 10% | Warning: investigasi harian, Critical: freeze perubahan sync |
| Sync Reconciliation | Variance acknowledged_total | > 5% | > 10% | Warning: retry + audit, Critical: eskalasi on-call |
| Failed Batch Aging | failed batch > 120 menit | >= 1 batch | >= 5 batch | Warning: retry manual, Critical: incident response |

Proses sign-off operasional:

1. Laporan mingguan dikirim ke product owner berisi variance dan status retry/aging.
2. Sign-off diberikan jika 7 hari berturut-turut semua indikator berada di bawah level warning.
3. Jika ada indikator di level critical, sign-off otomatis ditunda sampai 3 hari stabil kembali.
4. Jika perlu perubahan perilaku sync, update konfigurasi atau contract API, bukan menaikkan rollout runtime.

### 17.2 SOP Konflik dan Incident Sync

Peran utama:

1. Operator shift: menjalankan cek rutin scheduler dan retry manual awal.
2. On-call engineer: analisis root cause, patch konfigurasi, dan pemulihan data.
3. Product owner: validasi dampak bisnis dan prioritas perbaikan contract sync.

SLA respons:

1. P1 (critical mismatch atau backlog failed >= 5): acknowledge <= 15 menit, mitigasi awal <= 60 menit.
2. P2 (warning berulang > 2 siklus): acknowledge <= 60 menit, mitigasi <= 4 jam.
3. P3 (anomali minor): review pada daily ops berikutnya.

Runbook incident singkat:

1. Jalankan cek status:
  - `php artisan go:sync:alert-long-failed --minutes=120 --limit=50`
  - `php artisan go:sync:reconciliation-daily --max-variance-percent=5`
2. Jika ada batch failed, lakukan retry terkontrol:
  - `php artisan go:sync:retry-failed --limit=20 --base-minutes=5 --max-minutes=240 --respect-backoff=1`
3. Jika variance tetap critical setelah 2 siklus retry, hentikan deploy perubahan sync dan audit payload/endpoint bermasalah.
4. Catat incident ke log operasional dengan data: waktu, batch_id terdampak, indikator threshold, tindakan, hasil.
5. Tutup incident hanya jika 2 siklus reconciliation berikutnya kembali di bawah warning.

Runtime lokal sekarang dijalankan manual (tanpa task scheduler otomatis):

```powershell
.\scripts\manual-runtime.ps1 -Action start -WithReverb -WithScheduler
```

Untuk menghentikan runtime:

```powershell
.\scripts\manual-runtime.ps1 -Action stop
```

Bagian ini merangkum masalah lokal yang sempat terjadi beserta konfigurasi/fix yang terbukti stabil.

### 12.1 Domain Herd dan APP_URL

1. Gunakan domain tanpa underscore: `pos-bengkel.test`
2. Hindari `pos_bengkel.test` karena rawan `ERR_UNSAFE_REDIRECT`
3. Jika domain lama masih aktif karena parked path:

```bash
cd ..
herd forget
cd pos_bengkel
herd unlink pos_bengkel
herd link pos-bengkel
```

### 12.2 Reverb WebSocket Lokal (khusus jalur Laravel)

Catatan penting alignment arsitektur:
- Bagian ini khusus jalur Laravel (hosting/fallback/monitoring).
- Untuk jalur GO local, gunakan realtime native GO (`/ws`) dan bukan Reverb.

Untuk local development yang stabil:

```env
APP_URL=http://pos-bengkel.test
REVERB_HOST=pos-bengkel.test
REVERB_PORT=8080
REVERB_SCHEME=http
```

Jalankan:

```bash
php artisan config:clear
php artisan reverb:start
npm run dev
```

Kalau Reverb tetap unreachable, gunakan urutan cek berikut:

1. Pastikan command Reverb tersedia dengan `php artisan list | findstr /i reverb`.
2. Cek status watchdog dengan `php artisan reverb:watchdog-status --lines=20`.
3. Jalankan `scripts\manual-runtime.ps1 -Action start -WithReverb` untuk start Reverb manual.
4. Cek status dengan `scripts\manual-runtime.ps1 -Action status`.
5. Setelah `.env` diubah, jalankan lagi `php artisan config:clear` lalu restart Vite.

Jika site sebelumnya di-HTTPS Herd dan handshake gagal, nonaktifkan HTTPS lokal:

```bash
herd unsecure pos-bengkel
```

### 12.2.1 Diagnostik Realtime GO (Local-First)

Untuk jalur GO native realtime, gunakan pengecekan berikut:

```bash
GET /api/v1/realtime/subscribers
POST /api/v1/realtime/emit
GET /ws
```

Checklist cepat:
1. Pastikan GO API berjalan pada port target (contoh `:8081`).
2. Cek subscriber aktif via `/api/v1/realtime/subscribers`.
3. Uji emit event via `/api/v1/realtime/emit` dan verifikasi pesan diterima client WebSocket.

### 12.3 CSRF 419 (Login/Logout)

Masalah 419 dapat muncul setelah transisi HTTPS/HTTP karena cookie lama.

Rekomendasi:

```env
SESSION_DOMAIN=pos-bengkel.test
SESSION_SECURE_COOKIE=false
SESSION_COOKIE=posbengkel_session_http
```

Lalu jalankan:

```bash
php artisan config:clear
php artisan cache:clear
```

Dan jika masih 419, hapus cookie browser untuk `pos-bengkel.test` lalu login ulang.

Catatan frontend:
1. Jangan override CSRF header pakai meta token statis di interceptor Axios.
2. Biarkan Axios/Laravel memakai cookie `XSRF-TOKEN` bawaan.

### 12.4 Favicon Unsafe Redirect

Jika browser memunculkan `favicon.ico ... ERR_UNSAFE_REDIRECT`, gunakan fallback favicon inline di head:

```html
<link rel="icon" href="data:,">
<link rel="shortcut icon" href="data:,">
```

Lalu jalankan:

```bash
php artisan view:clear
```

### 12.5 Default Product Image 404

Jika muncul `GET /storage/products/default.jpg 404`:
1. Tambahkan file default image di `storage/app/public/products/default.jpg`, atau
2. Ubah fallback path image di kode sesuai asset yang tersedia.

### 12.6 Go API Single-Instance (Anti Port Conflict)

Jika Go API sering gagal start dengan error bind port 8081, gunakan script single-instance berikut:

```bash
scripts\stop-go-api-single.ps1 -Port 8081
scripts\start-go-api-single.ps1 -Port 8081 -KillExisting
scripts\status-go-api-single.ps1 -Port 8081 -TailLines 20
scripts\restart-go-api-single.ps1 -Port 8081 -ShowStatus
```

Catatan:
1. Script `start-go-api-single.ps1` melakukan preflight cek listener pada port target.
2. Jika port sudah dipakai dan `-KillExisting` tidak dipakai, script akan berhenti dengan pesan jelas.
3. Untuk stop service secara eksplisit gunakan `stop-go-api-single.ps1`.
4. Hindari menjalankan `api.exe` berulang tanpa stop karena dapat memicu konflik bind socket.
5. Untuk inspeksi cepat gunakan `status-go-api-single.ps1` (status listener, pid file, tail log stdout/stderr).
6. Untuk restart aman satu perintah gunakan `restart-go-api-single.ps1`.

Checklist troubleshooting cepat (Go-only):
1. `scripts\status-go-api-single.ps1 -Port 8081 -TailLines 30`
2. Jika status STOPPED, jalankan `scripts\start-go-api-single.ps1 -Port 8081 -KillExisting`
3. Jika status RUNNING tapi endpoint gagal, cek bagian `ERR_LOG` dari output status script.
4. Jika masih gagal bind, jalankan `scripts\stop-go-api-single.ps1 -Port 8081` lalu start ulang.


Dokumen ini menggantikan catatan teknis terpisah yang sebelumnya tersebar di banyak file markdown.
