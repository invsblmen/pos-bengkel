# Kanban Board - Next Implementation

Gunakan board ini untuk tracking eksekusi berikutnya lintas device.

Aturan pakai singkat:

- Pindahkan task antar kolom dengan cut/paste.
- Simpan format checkbox agar progress mudah dibaca.
- Gunakan tag: `[GARANSI]`, `[VOUCHER]`, `[SO-REF]`, `[TEST]`, `[INFRA]`, `[UI]`.

## To Do

- [ ] [INFRA] Tambahkan guard agar launcher tidak spawn process orphan pada skenario logout/login berulang.
- [ ] [DASHBOARD] Tambahkan dashboard conversion voucher (issued vs redeemed vs expired).
- [ ] [UI] Optimasi spacing dan typographic hierarchy agar informasi finansial lebih mudah dipindai.

## In Progress

- [ ] (Kosong)

## Blocked

- [ ] [INFRA] Otomatisasi startup berbasis Task Scheduler event Herd start (menunggu hak akses admin lokal).

## Done

- [x] [TEST] Tambahkan feature test untuk `customers.show` (akses valid, akses unauthorized, data relasi terbaca).
- [x] [TEST] Tambahkan test fallback route referensi mekanik pada detail service order.
- [x] [VOUCHER] Tambahkan validasi edge-case kombinasi voucher + diskon fixed besar di service order.
- [x] [GARANSI] Tambahkan indikator visual item garansi yang sudah mendekati expired pada detail service order.
- [x] [SO-REF] Finalisasi endpoint detail mekanik via alias route `mechanics.show`.
- [x] [UI] Sticky action bar pada detail service order (desktop).
- [x] [UI] Loading skeleton pada section detail item service order show.
- [x] [UI] Quick jump anchor antar section detail service order.
- [x] [INFRA] Command status ringkas watchdog Reverb (`reverb:watchdog-status`).
- [x] [INFRA] Housekeeping/trim log watchdog terjadwal (`reverb:watchdog-maintain`).
- [x] [TEST] Konsolidasi dan stabilisasi test suite domain garansi + voucher + service-order references (smoke suite hijau).

## Catatan Operasional

- Setelah perubahan route backend, regenerate Ziggy:
  - `php artisan ziggy:generate resources/js/ziggy.js`
- Untuk cek scheduler aktif:
  - `php artisan schedule:list`
- Untuk cek command Reverb yang tersedia:
  - `php artisan list | findstr /i reverb`
