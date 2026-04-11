# TODO Lanjutan Pengembangan (Lintas Device)

Dokumen ini berisi rencana kerja berikutnya setelah batch implementasi 2026-03-28.

## Fokus Iterasi Berikutnya

1. Stabilisasi test suite untuk domain garansi, voucher, dan service order references.
2. Penyempurnaan UX halaman detail service order (navigasi, sticky actions, loading states).
3. Penguatan observability lokal untuk realtime Reverb (watchdog + log maintenance).

## Prioritas Eksekusi

### Prioritas 1 - Testing dan Quality Gate

- [x] Tambah feature test untuk halaman `customers.show` (render, relasi, permission).
- [x] Tambah test untuk fallback route mekanik di detail service order.
- [x] Tambah test regresi untuk clickable references (`customer`, `vehicle`, `mechanic`) di service order detail.
- [x] Tambah test edge-case voucher pada kombinasi diskon fixed/percent dan batas maksimum diskon.
- [x] Jalankan subset test cepat sebagai smoke suite untuk domain workshop core.

Status terbaru (2026-03-28):

- [x] Perbaikan failure 419 pada test klaim garansi service order (CSRF middleware dikecualikan pada feature test terkait).
- [x] Smoke suite domain warranty + voucher + service-order references: 18 test PASS.
- [x] Tambahan test coverage: 14 PASS (2 customer show + 4 service order reference + 8 voucher validation).
- [x] Total test suite: 32+ PASS, semua domain core workshops hijau.

### Prioritas 2 - UX Detail Service Order

- [x] Tambahkan sticky action bar (kembali, cetak, edit) pada layar desktop.
- [x] Tambahkan loading skeleton untuk blok detail item saat payload besar.
- [x] Tambahkan quick jump anchor antar section (info utama, biaya, item, catatan).
- [x] Tambahkan visual indicator aging untuk warranty mendekati expiry (7 hari threshold).
- [ ] Optimasi spacing dan typographic hierarchy agar informasi finansial lebih mudah dipindai.

### Prioritas 3 - Infra Realtime Lokal

- [x] Tambah utilitas command status watchdog (`port`, `pid`, `process`, `last log lines`).
- [x] Tambah housekeeping untuk log watchdog (truncate/rotate mingguan).
- [x] Tambah guard agar startup launcher tidak spawn process orphan saat logout/login berulang.
- [ ] Dokumentasikan troubleshooting standar saat Reverb unreachable di dev environment.

Tambahan status (2026-03-28):

- [x] Finalisasi keputusan referensi detail mekanik: route alias `mechanics.show` mengarah ke halaman performa mekanik existing.
- [x] Quality gate: ALL TESTS PASSING (32+ tests across warranty, voucher, service-order, customer, mechanic domains).


## Backlog Opsional

- [x] Tambahkan visual indicator aging untuk klaim garansi (mis. 7 hari sebelum expiry).
- [ ] Tambahkan dashboard conversion voucher (issued vs redeemed vs expired).
- [ ] Tambahkan opsi notifikasi internal untuk anomali stok setelah service order finalisasi.

## Catatan Operasional

- Setelah perubahan route backend, regenerate Ziggy:
  - `php artisan ziggy:generate resources/js/ziggy.js`
- Untuk cek scheduler:
  - `php artisan schedule:list`
- Untuk cek command Reverb yang tersedia:
  - `php artisan list | findstr /i reverb`

## Update Progress Migrasi Go-Laravel (2026-04-11)

Ringkasan ini dipakai untuk weekly review lintas tim (engineering, QA, operasi, bisnis).

### Status Umum

- Engineering core sync: 95% (stabil, command utama tersedia, benchmark tervalidasi).
- Dokumentasi operasional: 100% (SOP, incident runbook, UAT checklist, sign-off template).
- UAT parity frontend: in progress (template siap, eksekusi per screen belum selesai).
- Business sign-off threshold: menunggu baseline 7 hari.

### Yang Sudah Selesai (Teknis)

- [x] Core sync command: `go:sync:run`, `go:sync:retry-failed`, `go:sync:alert-long-failed`, `go:sync:reconciliation-daily`, `go:sync:benchmark-capacity`.
- [x] Timeout dan retry limit fully configurable via env (`GO_SYNC_*`).
- [x] Benchmark kapasitas: 30/30 run sukses, p95 latency terukur dan stabil.
- [x] Shadow compare helper + integrasi di controller prioritas.
- [x] Import module (master + transaksi) beserta UI Import dan UI Sync dashboard.
- [x] Retention purge policy: command `go:sync:purge-old` + scheduler harian.
- [x] Repo hygiene: commit sudah terkelompok, artefak biner lokal di-ignore.

### Yang Masih In Progress

- [~] Retry/backoff prolonged-failure test cycle (observasi lebih panjang).
- [~] Alerting integration ke channel notifikasi produksi (di luar log aplikasi).
- [~] Frontend parity side-by-side UAT untuk screen kritis.
- [~] Kalibrasi mismatch threshold final per fitur untuk persetujuan bisnis.

### Blocking Non-Engineering

- [ ] UAT execution oleh QA untuk seluruh screen kritis.
- [ ] Persetujuan bisnis berdasarkan metrik 7 hari (variance/mismatch/skipped rate).
- [ ] Final release gate approval lintas owner.

### Next Action 7 Hari

1. Jalankan `go:sync:reconciliation-daily` harian dan kumpulkan metrik ke template sign-off.
2. Jalankan UAT parity untuk 3 screen prioritas dulu: Appointment Index, Service Order Index, Vehicle Index.
3. Eksekusi dry-run retention mingguan: `php artisan go:sync:purge-old --days=30 --dry-run=1`.
4. Review mingguan dengan PO/QA lead untuk keputusan canary ramp.

### Baseline Snapshot (2026-04-11)

- Reconciliation: HOLD (variance batch_total 15.91%, acknowledged 12.20% > threshold 5%).
- Shadow summary (hari ini): mismatch 0%, skipped 0% untuk `report_overall` dan `report_part_sales_profit`.
- Shadow trend 7 hari: masih ada historical violation (avg mismatch report_overall/report_part_sales_profit 33.59%).
- Canary gate: `GATE RESULT: HOLD` (coverage/samples belum cukup + historical mismatch/skipped tinggi).

Command agregasi harian:

```powershell
./scripts/collect-go-migration-metrics.ps1 -Date 2026-04-11 -VarianceThreshold 5 -TrendDays 7 -CurrentCanary 5
```
