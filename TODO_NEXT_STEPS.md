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
- [ ] Tambah guard agar startup launcher tidak spawn process orphan saat logout/login berulang.
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
