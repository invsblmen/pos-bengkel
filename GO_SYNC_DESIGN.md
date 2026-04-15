# Desain Sinkronisasi Local ke Hosting

Dokumen ini menjabarkan rancangan teknis sinkronisasi dari Go local ke Laravel hosting. Tujuannya adalah menjaga performa operasional bengkel tetap tinggi di local, sambil tetap memberi visibilitas online di hosting untuk monitoring dan rekonsiliasi.

## 1. Tujuan Teknis

1. Local tetap menjadi sistem penulisan utama saat transaksi berlangsung.
2. Hosting menerima salinan data yang sudah final untuk monitoring online.
3. Sinkronisasi harus idempotent, bisa di-retry, dan mudah diaudit.
4. Kegagalan sinkron tidak boleh mengganggu transaksi operasional lokal.

## 2. Prinsip Desain

1. Local-first write: semua transaksi disimpan di database lokal lebih dulu.
2. Outbox pattern: setiap perubahan yang perlu dikirim ke hosting masuk ke antrian sinkron lokal.
3. Push-based sync: local mendorong data ke hosting ketika jadwal sync berjalan atau saat operator menekan tombol sync.
4. Acknowledgement-based: hosting mengembalikan tanda terima agar local bisa menandai batch sebagai terkirim.
5. Deterministic conflict handling: jika data sudah pernah terkirim, pengiriman ulang harus dianggap update aman atau no-op, bukan insert duplikat.

## 3. Alur Data

### 3.1 Write Path

1. Operator melakukan transaksi di Go local.
2. Go menyimpan data ke tabel operasional utama.
3. Go membuat record outbox untuk batch sinkron.
4. Worker sinkron memproses outbox sesuai jadwal atau trigger manual.
5. Data dikirim ke endpoint sync Laravel hosting.
6. Hosting validasi payload, simpan data, lalu mengembalikan acknowledgement.
7. Go menandai batch sebagai acknowledged.

### 3.2 Retry Path

1. Jika hosting tidak bisa diakses, batch tetap pending.
2. Retry berjalan dengan backoff.
3. Jika gagal berulang, batch masuk status failed.
4. Operator bisa menjalankan retry manual dari halaman manajemen sinkron.

### 3.3 Rekonsiliasi Harian

1. Setelah jam tutup, Go mengirim ringkasan harian.
2. Laravel membandingkan jumlah batch dan total nominal terhadap data lokal.
3. Jika ada selisih, batch ditandai untuk investigasi.

## 4. Entitas yang Disinkronkan

Prioritas awal:

1. Service order summary harian.
2. Part sales harian.
3. Part purchases harian.
4. Cash movement / settlement harian.
5. Snapshot stok dan delta penting.

Prioritas berikutnya:

1. Detail transaksi untuk audit.
2. Status perubahan yang mempengaruhi laporan.
3. Event notifikasi jika diperlukan untuk monitoring.

## 5. Struktur Data Sinkron

### 5.1 Tabel Lokal: `sync_batches`

Kolom yang disarankan:

- `id`
- `sync_batch_id` UUID unik
- `scope` string, misalnya `daily`, `manual`, `retry`
- `payload_type` string, misalnya `part_sales_daily`
- `payload_hash` string untuk deteksi perubahan isi
- `status` enum/string: `pending`, `sent`, `acknowledged`, `failed`, `retrying`
- `source_date` date
- `attempt_count` integer
- `last_attempt_at` timestamp nullable
- `acknowledged_at` timestamp nullable
- `last_error` text nullable
- `created_at`, `updated_at`

Fungsi:

1. Menjadi kepala batch sinkron.
2. Menyimpan status lifecycle batch.
3. Menjadi sumber dashboard manajemen sinkron.

### 5.2 Tabel Lokal: `sync_outbox_items`

Kolom yang disarankan:

- `id`
- `sync_batch_id` foreign key / UUID
- `entity_type` string
- `entity_id` string/int sesuai domain
- `event_type` string, misalnya `created`, `updated`, `settled`
- `payload` JSON
- `payload_hash` string
- `status` enum/string: `pending`, `locked`, `sent`, `failed`
- `attempt_count` integer
- `last_attempt_at` timestamp nullable
- `last_error` text nullable
- `created_at`, `updated_at`

Fungsi:

1. Menyimpan item granular yang akan dikirim.
2. Menghindari kehilangan event jika batch besar gagal sebagian.
3. Memudahkan retry per item jika diperlukan.

### 5.3 Tabel Hosting: `sync_received_batches`

Kolom yang disarankan:

- `id`
- `sync_batch_id` UUID unik dari local
- `source_workshop_id`
- `payload_type`
- `payload_hash`
- `received_at`
- `status`
- `summary_json`
- `created_at`, `updated_at`

Fungsi:

1. Mencegah double insert di hosting.
2. Menjadi audit trail penerimaan data dari local.
3. Menyimpan status hasil validasi payload.

## 6. API Sync yang Disarankan

### 6.1 Endpoint di Laravel Hosting

1. `POST /api/sync/batches`
2. `POST /api/sync/batches/{syncBatchId}/ack`
3. `GET /api/sync/batches/{syncBatchId}`
4. `GET /api/sync/status`

### 6.2 Kontrak Payload `POST /api/sync/batches`

Contoh payload:

```json
{
  "sync_batch_id": "7d2f8f57-7ce8-4f12-9f3d-7b22a1d3f2c1",
  "source_workshop_id": 1,
  "scope": "daily",
  "payload_type": "part_sales_daily",
  "source_date": "2026-04-09",
  "payload_hash": "sha256-hash",
  "items": [
    {
      "entity_type": "part_sale",
      "entity_id": 123,
      "event_type": "created",
      "payload": {
        "sale_number": "SAL-20260409-0001",
        "grand_total": 150000
      },
      "payload_hash": "item-hash"
    }
  ]
}
```

### 6.3 Respons yang Disarankan

```json
{
  "sync_batch_id": "7d2f8f57-7ce8-4f12-9f3d-7b22a1d3f2c1",
  "status": "acknowledged",
  "received_items": 1,
  "duplicate_items": 0,
  "invalid_items": 0,
  "acknowledged_at": "2026-04-09T20:15:00+07:00"
}
```

## 7. Aturan Idempotency

1. `sync_batch_id` harus unik per batch.
2. `payload_hash` dipakai untuk mendeteksi payload yang sama.
3. Jika batch yang sama dikirim ulang, hosting harus mengembalikan hasil yang sama tanpa duplikasi data.
4. Jika item sudah pernah diterima, hosting boleh menandai sebagai duplicate tetapi tidak boleh membuat record baru.
5. Ulang kirim hanya sah jika status batch sebelumnya belum acknowledged atau ada alasan retry.

## 8. Konflik Data

### 8.1 Jenis Konflik

1. Batch sudah pernah diterima.
2. Item dengan `entity_id` sama memiliki payload berbeda.
3. Local dan hosting menghitung summary yang tidak sama.

### 8.2 Aturan Penyelesaian

1. Untuk batch duplicate, pilih no-op atau acknowledge ulang.
2. Untuk payload berbeda pada entitas yang sama, prioritaskan versi lokal sebagai sumber operasional, lalu tandai conflict untuk audit.
3. Untuk selisih summary, hosting menyimpan selisihnya dan operator melihatnya di dashboard rekonsiliasi.

### 8.3 SOP Operasional Konflik

1. Trigger warning: variance rekonsiliasi > 5% atau mismatch compare historis > 2%.
2. Trigger critical: variance > 10%, mismatch > 5%, atau failed batch aging >= 5 batch.
3. Pada warning, operator menjalankan retry terkontrol dan verifikasi ulang dalam 30 menit.
4. Pada critical, on-call menghentikan perubahan sync dan memaksa fallback endpoint bermasalah ke Laravel.
5. Incident ditutup jika dua siklus rekonsiliasi berurutan kembali di bawah threshold warning.

## 9. Retry Policy

1. Retry otomatis berjalan dengan exponential backoff.
2. Batas retry dapat dimulai dari 3 sampai 5 percobaan per batch.
3. Batch yang gagal terlalu lama masuk status failed.
4. Operator bisa menekan `Retry Failed` dari UI.
5. Retry tidak boleh mengubah status transaksi utama di local.

Implementasi operasional saat ini:

1. `php artisan go:sync:run --scope=daily` untuk membuat+mengirim batch harian via API Go.
2. `php artisan go:sync:retry-failed --limit=5 --base-minutes=5 --max-minutes=240 --respect-backoff=1` untuk retry batch failed yang sudah melewati jeda backoff.
3. `php artisan go:sync:alert-long-failed --minutes=120 --limit=20` untuk mendeteksi batch failed yang terlalu lama.
4. `php artisan go:sync:reconciliation-daily --max-variance-percent=5` untuk membandingkan batch total dan count antara Go dan Laravel, mendeteksi variance > threshold.
5. Scheduler Laravel akan mendaftarkan job ini jika `GO_SYNC_SCHEDULE_ENABLED=true`.
6. Jadwal default:
  - `go:sync:run` pada `GO_SYNC_SCHEDULE_DAILY_AT` (default `23:40`).
  - `go:sync:retry-failed` setiap 30 menit.
  - `go:sync:alert-long-failed` setiap 30 menit jika `GO_SYNC_ALERT_ENABLED=true`.
  - `go:sync:reconciliation-daily` pada `GO_SYNC_RECONCILIATION_DAILY_AT` (default `00:15`) jika `GO_SYNC_RECONCILIATION_ENABLED=true`.
7. Di Windows local, runtime scheduler/reverb dijalankan manual sesuai kebutuhan.
8. Helper script yang tersedia:
  - `scripts/manual-runtime.ps1 -Action start -WithScheduler`
  - `scripts/manual-runtime.ps1 -Action status`
  - `scripts/manual-runtime.ps1 -Action stop`

Variabel env terkait:

1. `GO_SYNC_RUN_TIMEOUT_SECONDS`
2. `GO_SYNC_RETRY_TIMEOUT_SECONDS`
3. `GO_SYNC_ALERT_TIMEOUT_SECONDS`
4. `GO_SYNC_RECONCILIATION_TIMEOUT_SECONDS`
5. `GO_SYNC_RETRY_DEFAULT_LIMIT`
6. `GO_SYNC_RETRY_MAX_LIMIT`
7. `GO_SYNC_SCHEDULE_ENABLED`
8. `GO_SYNC_SCHEDULE_DAILY_AT`
9. `GO_SYNC_SCHEDULE_RETRY_LIMIT`
10. `GO_SYNC_ALERT_ENABLED`
11. `GO_SYNC_ALERT_FAILED_MINUTES`
12. `GO_SYNC_ALERT_LIMIT`
13. `GO_SYNC_RECONCILIATION_ENABLED`
14. `GO_SYNC_RECONCILIATION_DAILY_AT`
15. `GO_SYNC_RECONCILIATION_MAX_VARIANCE`

Catatan tuning kapasitas:

1. Semua command sync kini memakai timeout berbasis konfigurasi (bukan hardcoded), dengan rentang aman 5-600 detik.
2. Untuk volume tinggi, naikkan `GO_SYNC_RUN_TIMEOUT_SECONDS` dan `GO_SYNC_RETRY_TIMEOUT_SECONDS` bertahap (misal 60 -> 120 -> 180) sambil monitor durasi request dan error rate.
3. Batasi kandidat retry per siklus melalui `GO_SYNC_RETRY_DEFAULT_LIMIT` dan `GO_SYNC_RETRY_MAX_LIMIT` agar tidak menimbulkan spike saat ada banyak batch gagal.
4. Gunakan command benchmark untuk validasi berkala: `php artisan go:sync:benchmark-capacity --timeouts=60,120,180 --iterations=3`.
5. Simpan hasil benchmark di log aplikasi (`go_sync_capacity_benchmark`) untuk pembandingan tren antar hari.

Hasil benchmark lokal terbaru (2026-04-11, iterations=10):

1. Seluruh percobaan sukses (30/30), tanpa timeout/exceptions.
2. p95 latency: 60s=351.94 ms, 120s=313.91 ms, 180s=269.08 ms.
3. Keputusan default sementara: timeout run/retry 60 detik sudah memadai untuk kondisi lokal saat ini.

## 10. UI yang Disarankan di Go Local

1. Dashboard sinkron berisi `last synced at`, `pending count`, `failed count`, dan `last error`.
2. Tombol `Sync Now` untuk memproses batch pending.
3. Tombol `Retry Failed` untuk batch gagal.
4. Daftar batch sinkron dengan filter tanggal dan status.
5. Detail batch untuk melihat item mana yang berhasil atau gagal.

## 11. Keamanan

1. Endpoint sync harus memakai API key atau token khusus service-to-service.
2. Payload sebaiknya ditandatangani untuk mencegah manipulasi.
3. Log sync jangan menyimpan data sensitif penuh jika tidak perlu.
4. Source workshop harus divalidasi di hosting.
5. Rate limit perlu dipasang agar endpoint sync tidak jadi target abuse.

## 12. Urutan Implementasi

1. Buat tabel outbox dan batch di Go local.
2. Buat endpoint penerima di Laravel hosting.
3. Tambahkan worker sync local.
4. Tambahkan dashboard manajemen sync di frontend Go.
5. Tambahkan rekonsiliasi harian dan laporan conflict.
6. Baru kemudian perluas ke detail transaksi jika monitoring memerlukannya.

## 13. Definisi Selesai

Sinkronisasi dianggap layak tahap awal jika:

1. Batch harian berhasil terkirim tanpa duplicate insert.
2. Retry gagal bisa dipulihkan manual.
3. Dashboard menunjukkan status sync yang jelas.
4. Rekonsiliasi harian tidak menunjukkan selisih material.
5. Transaksi lokal tetap cepat walau hosting sedang tidak tersedia.
