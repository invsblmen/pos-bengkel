# Kanban Board - Next Implementation

Gunakan board ini untuk tracking eksekusi berikutnya lintas device.

Aturan pakai singkat:

- Pindahkan task antar kolom dengan cut/paste.
- Simpan format checkbox agar progress mudah dibaca.
- Gunakan tag: `[GARANSI]`, `[VOUCHER]`, `[SO-REF]`, `[TEST]`, `[INFRA]`, `[UI]`.

## To Do

Catatan alignment arah akhir:
- GO local adalah jalur utama operasional dan realtime native GO.
- Laravel hosting adalah jalur monitoring/fallback (boleh tetap memakai Reverb bila diperlukan).
- Frontend harus parity fitur/desain/UX lintas jalur.

Status audit dokumen root (2026-04-12):
- Aligned: README, PROJECT_GUIDE, GO_MIGRATION_BLUEPRINT, GO_MIGRATION_WAVES, GO_MIGRATION_TASKS_WEEKLY, TODO_NEXT_STEPS, SEPARATED_STACK_RUNBOOK, MIGRATION_MASTER_CHECKLIST, FRONTEND_PARITY_MATRIX, OPTIMIZATION_SUMMARY, MISSING_VIIAGO_BRIDGES.
- Minor fix done: FINAL_HANDOVER_SIGN_OFF (phrasing inventori dokumentasi dirapikan agar tidak ambigu terhadap arah arsitektur).

Status audit subfolder penting (2026-04-12):
- go-backend/README: aligned + guardrail arsitektur ditambahkan.
- go-whatsapp-web-multidevice-main/*.md: tidak terkait langsung dengan arah migrasi GO local vs Laravel hosting POS inti, sehingga tidak diubah pada pass ini.

Status audit lanjutan (2026-04-12, pass-2):
- Tidak ditemukan konflik wording tambahan pada dokumen non-root yang relevan migrasi inti.
- Tidak ada patch tambahan yang diperlukan selain penguatan guardrail yang sudah diterapkan.

### Formal UAT Execution (3 Critical Screens)

- [ ] [UAT] Side-by-side laravel vs GO test Appointment Index (C1-C8 parity checklist + JSON payload compare).
- [ ] [UAT] Side-by-side laravel vs GO test Service Order Index (C1-C8 parity checklist + JSON payload compare).
- [ ] [UAT] Side-by-side laravel vs GO test Vehicle Index (C1-C8 parity checklist + JSON payload compare).

### Optional Backlog

- [ ] [DASHBOARD] Tambahkan dashboard conversion voucher (issued vs redeemed vs expired).
- [x] [UI] Optimasi spacing dan typographic hierarchy agar informasi finansial lebih mudah dipindai.

## In Progress

- [x] [INFRA] Create GO Frontend React SPA scaffold (Vite + React 18 + Tailwind + React Router) [historical phase].
- [ ] [INFRA] Implement GO pages: Dashboard, Service Orders Index, Appointments Index, Vehicles Index (match parity with Laravel).

## Blocked

- [ ] [INFRA] Otomatisasi startup berbasis Task Scheduler event Herd start (menunggu hak akses admin lokal).

## Done

- [x] [INFRA] Create GO SQLite architecture documentation (GO_SQLITE_ARCHITECTURE.md).
- [x] [INFRA] Implement GO database configuration module (internal/config/database.go with driver detection).
- [x] [INFRA] Create SQLite schema migration (001_init_sqlite.sql with all POS tables).
- [x] [INFRA] Create setup script for SQLite initialization (scripts/setup-go-sqlite.ps1).
- [x] [INFRA] Create GO Frontend React SPA scaffold (Vite + React 18 + Tailwind + React Router + Axios) [historical phase].
- [x] [INFRA] Migrate GO frontend runtime to Next.js App Router native (`go-frontend/app`) and prune legacy archive.
- [x] [TEST] Eksekusi bundle validasi migrasi (review risiko realtime GO + `go test ./...` + `npm run build`).
- [x] [INFRA] Tambahkan guard agar launcher tidak spawn process orphan pada skenario logout/login berulang.
- [x] [TEST] Tambahkan feature test untuk `customers.show` (akses valid, akses unauthorized, data relasi terbaca).
- [x] [TEST] Tambahkan test fallback route referensi mekanik pada detail service order.
- [x] [VOUCHER] Tambahkan validasi edge-case kombinasi voucher + diskon fixed besar di service order.
- [x] [GARANSI] Tambahkan indikator visual item garansi yang sudah mendekati expired pada detail service order.
- [x] [UI] Optimasi spacing dan typographic hierarchy agar informasi finansial lebih mudah dipindai.
- [x] [SO-REF] Finalisasi endpoint detail mekanik via alias route `mechanics.show`.
- [x] [UI] Sticky action bar pada detail service order (desktop).
- [x] [UI] Loading skeleton pada section detail item service order show.
- [x] [UI] Quick jump anchor antar section detail service order.
- [x] [INFRA] Command status ringkas watchdog Reverb (`reverb:watchdog-status`).
- [x] [INFRA] Housekeeping/trim log watchdog terjadwal (`reverb:watchdog-maintain`).
- [x] [INFRA] Dokumentasikan troubleshooting standar saat Reverb unreachable di dev environment.
- [x] [TEST] Konsolidasi dan stabilisasi test suite domain garansi + voucher + service-order references (smoke suite hijau).

## Catatan Operasional

- Setelah perubahan route backend, regenerate Ziggy:
  - `php artisan ziggy:generate resources/js/ziggy.js`
- Untuk cek scheduler aktif:
  - `php artisan schedule:list`
- Untuk cek command Reverb yang tersedia:
  - `php artisan list | findstr /i reverb` (khusus jalur Laravel)
