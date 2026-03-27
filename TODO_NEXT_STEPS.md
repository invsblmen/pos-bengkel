# TODO Lanjutan Pengembangan (Lintas Device)

Dokumen ini dibuat untuk melanjutkan pekerjaan dari device lain dengan konteks terbaru per 2026-03-27.

## Ringkasan Kondisi Saat Ini

- Manajemen garansi sparepart untuk transaksi part sales sudah tersedia (list, filter, klaim, export CSV).
- Notifikasi expiry garansi sparepart sudah ada via command terjadwal harian.
- Permission khusus klaim garansi sparepart sudah ditambahkan.

## Prioritas 1 - Redesign Fondasi Garansi (Item-Level, Unified)

Tujuan: garansi tidak lagi melekat ke transaksi penjualan sparepart, tetapi ke master item (sparepart dan layanan), dan bisa dikelola dalam satu modul.

- [ ] Rancang model data garansi item-level.
- [ ] Tambahkan properti garansi di master sparepart:
  - [ ] `has_warranty` (boolean)
  - [ ] `warranty_duration_days` (nullable integer)
  - [ ] `warranty_terms` (nullable text)
- [ ] Tambahkan properti garansi di master layanan:
  - [ ] `has_warranty` (boolean)
  - [ ] `warranty_duration_days` (nullable integer)
  - [ ] `warranty_terms` (nullable text)
- [ ] Buat aturan validasi:
  - [ ] Jika `has_warranty = false`, durasi harus null/0.
  - [ ] Jika `has_warranty = true`, durasi harus > 0.
- [ ] Refactor pembentukan data garansi saat transaksi:
  - [ ] Part sales membaca default dari master part.
  - [ ] Service order membaca default dari master service dan/atau part yang dipakai.
- [ ] Tambahkan opsi override di transaksi (opsional per item) bila dibutuhkan bisnis.
- [ ] Siapkan migration backfill dari data lama part-sale-detail ke struktur baru tanpa kehilangan histori klaim.

## Prioritas 2 - Unified Warranty Management (Part + Service)

Tujuan: satu halaman manajemen garansi untuk semua sumber (penjualan sparepart dan service order).

- [ ] Buat tabel registri garansi terpadu (disarankan: `warranty_registrations`) dengan referensi polymorphic:
  - [ ] `warrantable_type`, `warrantable_id` (mengarah ke part/service master)
  - [ ] `source_type`, `source_id`, `source_detail_id` (asal transaksi)
  - [ ] `customer_id`, `vehicle_id` (nullable untuk konteks service)
  - [ ] `warranty_start_date`, `warranty_end_date`
  - [ ] `status` (active/expiring/expired/claimed/void)
  - [ ] metadata klaim
- [ ] Buat service class untuk registrasi garansi otomatis saat transaksi selesai/confirmed.
- [ ] Satukan halaman monitoring garansi:
  - [ ] filter sumber (part sale vs service order)
  - [ ] filter tipe item (sparepart vs layanan)
  - [ ] filter customer, kendaraan, mekanik, status, rentang tanggal
  - [ ] aksi klaim, export, dan histori aktivitas
- [ ] Integrasikan notifikasi expiry berbasis tabel registri terpadu (bukan hanya part sale detail).

## Prioritas 3 - Garansi pada Service Order

Tujuan: item sparepart dan layanan yang dipakai di service order bisa memicu registri garansi.

- [ ] Identifikasi titik finalisasi service order (status yang dianggap selesai).
- [ ] Saat finalisasi:
  - [ ] generate registri garansi untuk layanan yang eligible
  - [ ] generate registri garansi untuk sparepart yang eligible
- [ ] Tampilkan badge/status garansi pada detail service order.
- [ ] Tambahkan aksi klaim dari konteks service order bila status garansi aktif.
- [ ] Pastikan event realtime/notifikasi mengikuti update status garansi di service order.

## Prioritas 4 - Manajemen Voucher (Item dan Transaksi)

Tujuan: voucher dapat berlaku untuk item sparepart, item layanan, atau total transaksi.

- [ ] Buat modul master voucher:
  - [ ] kode, nama, deskripsi, periode aktif, kuota, limit per customer
  - [ ] jenis diskon (`percent`/`fixed`)
  - [ ] scope voucher (`item_part`, `item_service`, `transaction`)
  - [ ] minimal belanja, maksimal diskon, kombinasi dengan diskon lain
- [ ] Buat relasi eligibilitas voucher:
  - [ ] voucher ke part category/part tertentu
  - [ ] voucher ke service category/service tertentu
- [ ] Integrasi engine kalkulasi:
  - [ ] validasi voucher di part sales
  - [ ] validasi voucher di service order
  - [ ] audit trail pemakaian voucher per transaksi
- [ ] Tambahkan manajemen penggunaan voucher (usage log + anti reuse abuse).

## Prioritas 5 - Klik Referensi dari Detail Service Order

Tujuan: dari halaman detail service order, user bisa klik referensi untuk buka detail terkait.

- [ ] Jadikan data pelanggan clickable ke halaman detail pelanggan.
- [ ] Jadikan data kendaraan clickable ke halaman detail kendaraan.
- [ ] Jadikan data mekanik clickable ke halaman detail performa/detail mekanik.
- [ ] Pastikan route dan permission check aman untuk setiap link.
- [ ] Tambahkan fallback UI jika user tidak punya permission akses tujuan.

## Prioritas 6 - Hardening dan Testing

- [ ] Tambahkan test feature untuk:
  - [ ] registrasi garansi dari part sales
  - [ ] registrasi garansi dari service order
  - [ ] klaim garansi valid/invalid/expired
  - [ ] voucher validasi per scope
- [ ] Tambahkan test permission:
  - [ ] siapa boleh klaim
  - [ ] siapa boleh kelola voucher
- [ ] Tambahkan benchmark ringan untuk query list garansi terpadu dan voucher validation path.
- [ ] Review index database untuk kolom filter utama (status, tanggal, customer, source).

## Urutan Implementasi yang Disarankan

1. Fondasi data garansi item-level (master part + service).
2. Registri garansi terpadu dan migrasi backfill.
3. Integrasi service order ke registri garansi.
4. Unified UI manajemen garansi.
5. Modul voucher dan integrasi kalkulasi.
6. Linking referensi detail service order.
7. Testing, hardening, dan dokumentasi akhir.

## Catatan Teknis Penting

- Gunakan `ValidationException::withMessages` untuk kegagalan rule bisnis agar tetap UI-friendly pada Inertia flow.
- Hindari coupling logic garansi ke satu jenis transaksi; semua mengarah ke registri garansi terpadu.
- Pertahankan pola permission granular (Spatie) untuk aksi sensitif (klaim garansi, kelola voucher, override policy).

## Sprint Plan Mingguan (Rekomendasi Eksekusi)

Target: 6 sprint, masing-masing 1 minggu kerja efektif.

### Sprint 1 - Fondasi Garansi Item-Level

- [ ] Migration kolom garansi di master part dan master service.
- [ ] Form create/edit part dan service: toggle garansi + durasi + terms.
- [ ] Validasi backend + frontend untuk kombinasi `has_warranty` dan durasi.
- [ ] Seeder/update permission jika ada menu/aksi baru.

Definition of Done:

- [ ] Master part dan service sudah punya policy garansi yang bisa diaktif/nonaktifkan.
- [ ] Tidak ada regression pada create/edit part/service.

### Sprint 2 - Warranty Registration Terpadu

- [ ] Buat tabel `warranty_registrations`.
- [ ] Buat service class registrasi garansi reusable.
- [ ] Integrasikan registrasi dari flow part sales.
- [ ] Siapkan script backfill dari histori part sale detail lama.

Definition of Done:

- [ ] Setiap transaksi part sales eligible otomatis menghasilkan registri garansi.
- [ ] Data lama masih terbaca dan tidak hilang.

### Sprint 3 - Integrasi Garansi Service Order

- [ ] Hook registrasi garansi saat service order final/complete.
- [ ] Registri untuk service item + sparepart item di service order.
- [ ] Badge/status garansi tampil di detail service order.
- [ ] Klaim garansi dari konteks service order.

Definition of Done:

- [ ] Garansi service order dan part sales sama-sama masuk tabel registri terpadu.
- [ ] Klaim dari service order tervalidasi rule dan permission.

### Sprint 4 - Unified Warranty Dashboard

- [ ] Bangun halaman manajemen garansi gabungan (part + service).
- [ ] Filter lanjutan: source, item type, customer, kendaraan, mekanik, status, tanggal.
- [ ] Export CSV dari dashboard unified.
- [ ] Integrasi reminder expiry berdasarkan registri terpadu.

Definition of Done:

- [ ] Tim operasional cukup memakai satu halaman untuk monitoring/klaim garansi.
- [ ] Export dan reminder memakai sumber data unified.

### Sprint 5 - Voucher Engine (Item + Transaksi)

- [ ] Modul master voucher + masa aktif + kuota + limit customer.
- [ ] Scope voucher: `item_part`, `item_service`, `transaction`.
- [ ] Rule eligibilitas ke part/service tertentu atau category.
- [ ] Integrasi apply voucher ke part sales dan service order.
- [ ] Usage log untuk audit dan anti penyalahgunaan.

Definition of Done:

- [ ] Voucher tervalidasi konsisten di semua flow transaksi.
- [ ] Riwayat pemakaian voucher bisa ditelusuri.

### Sprint 6 - Clickable References + Hardening

- [ ] Detail service order: link ke detail customer, kendaraan, mekanik.
- [ ] Fallback permission-aware jika user tidak berhak akses.
- [ ] Test feature untuk garansi terpadu dan voucher.
- [ ] Test permission untuk klaim garansi dan kelola voucher.
- [ ] Review index DB dan benchmark query utama.

Definition of Done:

- [ ] Navigasi referensi di service order mulus dan aman.
- [ ] Area garansi + voucher punya coverage test yang memadai.

## Backlog Opsional (Setelah Sprint 6)

- [ ] Tambahkan SLA/aging view untuk klaim garansi (waktu sejak klaim dibuat).
- [ ] Tambahkan auto assignment PIC untuk klaim garansi.
- [ ] Tambahkan dashboard conversion voucher (issued vs redeemed).
