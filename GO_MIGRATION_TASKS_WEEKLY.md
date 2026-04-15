# Task Breakdown Mingguan (Siap Ticketing)

Dokumen ini adalah breakdown eksekusi 12 minggu yang bisa langsung dipindahkan ke Jira/Trello/Linear.

Alignment wajib selama eksekusi:
1. GO local diposisikan sebagai jalur operasi utama.
2. Laravel hosting diposisikan sebagai monitoring/fallback.
3. Frontend GO wajib parity terhadap Laravel (fitur/desain/UX), dengan implementasi frontend dedicated GO diperbolehkan.
4. Realtime pada jalur GO wajib native GO (tanpa ketergantungan Echo/Reverb).

## Minggu 1 - Discovery dan Quality Gate

1. Inventaris endpoint per domain dari routes aktif.
2. Tetapkan wave owner dan PIC lintas tim.
3. Definisikan SLO awal (availability, latency p95, error budget).
4. Bentuk golden dataset untuk contract testing.
5. Tambahkan baseline load test endpoint kandidat wave-1.
6. Tetapkan rollback policy dan incident severity matrix.

Definition of done:

- Dokumen endpoint wave disetujui.
- Baseline metric Laravel tersimpan.
- Checklist cutover v1 tersedia.

## Minggu 2 - Go Foundation I

1. Scaffold service Go (cmd, internal, pkg, docs).
2. Implement endpoint health, readiness, liveness.
3. Integrasi structured logger (request_id, route, latency_ms).
4. Setup env loader dan config validation.
5. Tambahkan middleware recover + timeout.
6. Setup unit test runner dan static analysis.

Definition of done:

- Service berjalan lokal.
- Health endpoint pass.
- Pipeline lint/test/build hijau.

## Minggu 3 - Go Foundation II

1. Tambahkan OpenAPI pipeline (generate spec + validation).
2. Tambahkan observability (metrics + trace basic).
3. Siapkan DB connectivity dengan pooling policy.
4. Tambahkan template repository/usecase/handler.
5. Implement auth bridge placeholder dari Laravel.
6. Siapkan deployment manifest dev/staging.

Definition of done:

- OpenAPI dapat digenerate.
- Metrics tampil di endpoint scrape.
- Service deploy ke staging.

## Minggu 4 - Wave 1 Implementasi

1. Implement GET /health-check (whatsapp health proxy atau adapter).
2. Implement POST /webhooks/whatsapp di Go dengan signature validation.
3. Implement endpoint vehicle insights read-only.
4. Tambahkan contract tests wave-1 terhadap respons Laravel.
5. Jalankan contract test dan sample replay untuk endpoint wave-1.
6. Buat dashboard rekonsiliasi response.

Definition of done:

- Semua endpoint wave-1 jalan di staging.
- Mismatch response berada di ambang aman.

## Minggu 5 - Wave 1 Hardening

1. Finalisasi hardening wave-1 tanpa rollout aktif.
2. Verifikasi error rate dan latency p95.
3. Perbaiki mismatch payload dan edge case.
4. Dokumentasikan runbook insiden wave-1.
5. Validasi stabilitas penuh sebelum cutover internal.
6. Freeze patch untuk wave-1 stabilisasi 48 jam.

Definition of done:

- Wave-1 live 100%.
- Tidak ada incident sev-1/2 selama 7 hari.

## Minggu 6 - Wave 2 Implementasi (Appointment)

1. Implement list/detail/slots appointment.
2. Implement create/update/status appointment.
3. Implement export endpoint yang kompatibel.
4. Tambahkan idempotency untuk operasi tulis sensitif.
5. Integrasikan event bridge notifikasi.
6. Tambahkan integration tests appointment.

Definition of done:

- Endpoint appointment siap untuk migrasi internal.
- Kontrak data kompatibel frontend.

## Minggu 7 - Wave 2 Hardening dan Optimasi

1. Hardening appointment tanpa skema rollout aktif.
2. Verifikasi konsistensi kalender dan status.
3. Tuning query bottleneck.
4. Perbaiki retry policy notifikasi.
5. Dokumentasikan known limitations.
6. Lock scope agar tidak creep.

Definition of done:

- Wave-2 live stabil.
- Tidak ada mismatch kritis data jadwal.

## Minggu 8 - Persiapan Wave 3 (Stock + Purchase)

1. Mapping transaksi stok masuk/keluar.
2. Mapping rule part-purchases dan status transisi.
3. Implement outbox pattern untuk event transaksi.
4. Implement rekonsiliasi stok harian.
5. Buat migrasi query-critical ke sqlc atau query raw teruji.
6. Tambahkan test konkurensi dasar.

Definition of done:

- Fondasi transaksi stok siap untuk validasi migrasi internal.

## Minggu 9 - Wave 3 Rollout

1. Validasi endpoint stock movement.
2. Validasi endpoint part-purchases.
3. Audit deadlock dan lock contention.
4. Jalankan rekonsiliasi harian otomatis.
5. Patch inkonsistensi rounding/perhitungan.
6. Finalisasi runbook rollback wave-3.

Definition of done:

- Selisih rekonsiliasi berada di ambang toleransi.
- Tidak ada kehilangan event.

## Minggu 10 - Wave 4 Implementasi (Part Sales + Cash)

1. Implement create/update/payment/status part-sales.
2. Implement claim-warranty flow.
3. Implement create-from-order flow.
4. Implement endpoint settle sale cash.
5. Tambahkan idempotency key wajib di payment/create.
6. Tambahkan fraud-safe guardrail sederhana (double submit, duplicate payment).

Definition of done:

- Transaksi penjualan lolos integration test kritikal.

## Minggu 11 - Wave 4 Hardening dan Persiapan Wave 5

1. Validasi part-sales + cash settle.
2. Verifikasi laporan keuangan harian.
3. Tuning performa query transaksi puncak.
4. Mulai split use case service-order (read dulu).
5. Persiapkan freeze window untuk domain inti.
6. Jalankan rollback drill wave-4.

Definition of done:

- Wave-4 stabil.
- Service-order migration plan detail siap.

## Minggu 12 - Wave 5 Parsial dan Post-Cutover

1. Cutover parsial service-order read endpoint.
2. Migrasi sebagian write path service-order sesuai readiness.
3. Validasi laporan agregat lintas domain.
4. Evaluasi auth/permission unification tahap akhir.
5. Post-mortem dan backlog hardening.
6. Tetapkan milestone sunset endpoint Laravel yang sudah diganti.

Definition of done:

- Domain inti mulai berjalan di Go secara terkontrol.
- Daftar endpoint legacy yang bisa dipensiunkan disetujui.

## Backlog Teknis Lintas-Minggu

1. Test coverage peningkatan bertahap per domain.
2. Data quality dashboard dan anomaly detection.
3. Performance test berkala tiap wave.
4. Security review endpoint publik dan webhook.
5. Dokumentasi operasional untuk on-call.

## Backlog Operasional Sinkronisasi Local ke Hosting

1. Rancang format payload sinkron harian dari Go local ke Laravel hosting.
2. Tentukan model sync: scheduled job, manual button, atau hybrid.
3. Tambahkan audit trail sinkron per hari dan per entitas.
4. Buat mekanisme retry jika sync gagal saat koneksi hosting tidak tersedia.
5. Buat halaman manajemen sinkronisasi agar operator bisa melihat status terakhir.
6. Tambahkan idempotency key untuk mencegah double insert saat retry.
7. Tambahkan status batch: pending, sent, acknowledged, failed, retrying.
8. Buat ringkasan `last synced at`, `pending count`, dan `failed count`.
9. Implementasi tabel outbox dan endpoint penerima sync di hosting.
10. Tambahkan batch reconciliation job untuk membandingkan ringkasan harian local vs hosting.

## Backlog Operasional Pemisahan Folder

1. Finalisasi path deployment terpisah untuk Laravel, Go backend, dan frontend baru.
2. Standarisasi env lintas project (URL, port, kredensial, CORS, queue).
3. Tetapkan mode operasi pasca-cutover: active-active, active-standby, atau legacy read-only.
4. Uji failover dari frontend baru ke Laravel fallback untuk endpoint prioritas.
5. Simpan runbook start/health-check service terpisah sebagai SOP tim.
