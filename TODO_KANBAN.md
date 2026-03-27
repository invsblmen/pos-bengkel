# Kanban Board - Next Implementation

Gunakan board ini untuk tracking harian lintas device.

Aturan pakai singkat:

- Pindahkan task antar kolom dengan cut/paste.
- Simpan format checkbox agar progress mudah dibaca.
- Gunakan tag: `[GARANSI]`, `[VOUCHER]`, `[SO-REF]`, `[TEST]`, `[INFRA]`.

## To Do

- [ ] [GARANSI] Sprint 1: Tambah kolom `has_warranty`, `warranty_duration_days`, `warranty_terms` di master part.
- [ ] [GARANSI] Sprint 1: Tambah kolom `has_warranty`, `warranty_duration_days`, `warranty_terms` di master service.
- [ ] [GARANSI] Sprint 1: Validasi rule kombinasi `has_warranty` dan durasi (backend + frontend).
- [ ] [GARANSI] Sprint 1: Update UI create/edit part dan service untuk policy garansi.

- [ ] [GARANSI] Sprint 2: Buat tabel `warranty_registrations` (polymorphic item + sumber transaksi).
- [ ] [GARANSI] Sprint 2: Implement service class registrasi garansi reusable.
- [ ] [GARANSI] Sprint 2: Integrasikan auto-registrasi dari flow part sales.
- [ ] [GARANSI] Sprint 2: Buat script backfill histori garansi lama.

- [ ] [GARANSI] Sprint 3: Integrasikan registrasi garansi dari service order saat finalisasi.
- [ ] [GARANSI] Sprint 3: Tampilkan badge/status garansi di detail service order.
- [ ] [GARANSI] Sprint 3: Tambahkan klaim garansi dari konteks service order.
- [ ] [INFRA] Sprint 3: Sinkronkan notifikasi expiry agar membaca sumber registri terpadu.

- [ ] [GARANSI] Sprint 4: Bangun halaman unified warranty dashboard.
- [ ] [GARANSI] Sprint 4: Tambah filter advanced (source, item type, customer, vehicle, mechanic, status, date).
- [ ] [GARANSI] Sprint 4: Tambah export CSV dari dashboard unified.

- [ ] [VOUCHER] Sprint 5: Buat modul master voucher (periode, kuota, limit customer, scope).
- [ ] [VOUCHER] Sprint 5: Tambah relasi eligibilitas voucher ke part/service/category.
- [ ] [VOUCHER] Sprint 5: Integrasikan validasi voucher ke part sales.
- [ ] [VOUCHER] Sprint 5: Integrasikan validasi voucher ke service order.
- [ ] [VOUCHER] Sprint 5: Tambah usage log + guard anti reuse abuse.

- [ ] [SO-REF] Sprint 6: Jadikan customer di detail service order clickable ke detail customer.
- [ ] [SO-REF] Sprint 6: Jadikan kendaraan di detail service order clickable ke detail kendaraan.
- [ ] [SO-REF] Sprint 6: Jadikan mekanik di detail service order clickable ke detail mekanik/performance.
- [ ] [SO-REF] Sprint 6: Tambah fallback UI jika permission akses tujuan tidak ada.

- [ ] [TEST] Sprint 6: Feature test registrasi garansi dari part sales.
- [ ] [TEST] Sprint 6: Feature test registrasi garansi dari service order.
- [ ] [TEST] Sprint 6: Feature test klaim garansi valid/invalid/expired.
- [ ] [TEST] Sprint 6: Feature test validasi voucher per scope.
- [ ] [TEST] Sprint 6: Permission test klaim garansi dan kelola voucher.
- [ ] [INFRA] Sprint 6: Review index DB dan benchmark query utama garansi/voucher.

## In Progress

- [ ] (Kosong)

## Blocked

- [ ] (Kosong)

## Done

- [x] [GARANSI] Manajemen garansi sparepart pada part sales (input, status, klaim).
- [x] [GARANSI] Halaman manajemen garansi sparepart (filter, summary, pagination, realtime refresh).
- [x] [GARANSI] Export CSV garansi sparepart berdasarkan filter aktif.
- [x] [INFRA] Command notifikasi expiry garansi: `warranty:notify-expiring` + schedule harian.
- [x] [INFRA] Permission khusus klaim garansi sparepart: `part-sales-warranty-claim`.

## Catatan Operasional

- Gunakan `ValidationException::withMessages` untuk business-rule failure pada flow Inertia.
- Setelah perubahan route backend, jalankan regenerate Ziggy:
  - `php artisan ziggy:generate resources/js/ziggy.js`
- Untuk cek scheduler aktif:
  - `php artisan schedule:list`
