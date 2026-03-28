# POS Bengkel (Laravel 12 + Inertia React)

`pos_bengkel` adalah aplikasi manajemen operasional bengkel yang mencakup alur service, penjualan sparepart, pembelian sparepart, stok, appointment, laporan, dan pengaturan bisnis.

Fokus repository saat ini adalah mode `workshop-only` (modul retail POS lama sudah dibersihkan dari codebase).

## Gambaran Fitur

- Dashboard bengkel dengan ringkasan operasional harian.
- Manajemen master data: customer, kendaraan, mekanik, supplier.
- Manajemen layanan: service category dan services.
- Manajemen sparepart: part category, parts, stok masuk/keluar manual, low stock alert.
- Pembelian sparepart (`part-purchases`) dengan detail item dan status.
- Penjualan sparepart langsung (`part-sales`) dengan invoice dan print.
- Service order end-to-end (buat, edit, update status, print).
- Appointment dan kalender booking.
- Laporan: service revenue, mechanic productivity, mechanic payroll, parts inventory, outstanding payments, dan part sales profit.
- Sistem role dan permission granular (Spatie Permission).
- Notifikasi in-app dan dukungan realtime (Reverb/Echo).

## Tech Stack

- PHP `^8.2`
- Laravel `^12`
- Inertia.js (Laravel + React)
- React `^18`
- Tailwind CSS `^3`
- Vite `^6`
- Spatie Laravel Permission
- Laravel Reverb + Pusher protocol

## Prasyarat

- PHP 8.2+
- Composer
- Node.js 20+ dan npm
- MySQL/MariaDB

## Instalasi

```bash
git clone <repo-url>
cd pos_bengkel
cp .env.example .env
composer install
npm install
php artisan key:generate
php artisan storage:link
```

## Konfigurasi Environment

Perbarui `.env` minimal pada bagian berikut:

- `APP_NAME`, `APP_URL`
- `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `BROADCAST_CONNECTION` (default: `reverb`)
- `REVERB_*` dan `VITE_REVERB_*` jika realtime diaktifkan

## Inisialisasi Database

```bash
php artisan migrate --seed
```

Seeder default akan menyiapkan permission, role, user, workshop data, kategori service/part, supplier, kendaraan, dan data pendukung lainnya.

## Akun Default

- Super Admin: `arya@gmail.com` / `password`
- Cashier: `cashier@gmail.com` / `password`

## Menjalankan Aplikasi (Development)

Jalankan di terminal terpisah:

```bash
php artisan serve
npm run dev
php artisan reverb:start
```

Jika memakai queue untuk proses async:

```bash
php artisan queue:work
```

## Perintah Penting

```bash
# Jalankan test
php artisan test

# Build asset production
npm run build

# Seed ulang data workshop (opsional)
php artisan db:seed --class=WorkshopSeeder
```

## Update Terbaru

### 2026-03-28

Perubahan stabilisasi dan UX yang baru ditambahkan:

- Hardening realtime event dispatch agar transaksi inti tidak gagal saat broadcaster (Reverb) tidak tersedia sementara.
- Penambahan alert notifikasi in-app untuk kondisi Reverb down beruntun + recovery.
- Penambahan konfigurasi host khusus backend broadcast: `REVERB_BROADCAST_HOST`.
- Otomatisasi startup Reverb lokal (Windows startup + watchdog script) agar tidak perlu menjalankan perintah manual setiap kali login.
- Perbaikan route link referensi di detail service order agar aman terhadap route yang tidak tersedia.
- Penambahan halaman detail pelanggan (`customers.show`) beserta akses dari daftar pelanggan.
- Penyempurnaan UI daftar pelanggan (aksi detail/edit/hapus lebih ringkas).
- Penyempurnaan UI halaman detail service order (quick insights + mode mobile cards untuk detail item).

Perintah operasional tambahan:

```bash
# Cek command reverb bawaan yang tersedia
php artisan list | findstr /i reverb

# Cek status watchdog reverb (pid, process, port, last logs)
php artisan reverb:watchdog-status --lines=20

# Trim log watchdog saat ukuran membesar
php artisan reverb:watchdog-maintain --max-kb=1024 --keep-lines=600
```

Script lokal (Windows) yang digunakan untuk auto-start watchdog Reverb:

- `scripts/start-reverb-if-needed.ps1`
- `scripts/watch-reverb.ps1`

### 2026-03-27

Perubahan enterprise yang baru ditambahkan:

- Manajemen garansi sparepart pada transaksi part sales (input masa garansi per item, status, dan klaim).
- Halaman terpusat manajemen garansi sparepart dengan filter, ringkasan, pagination, dan realtime refresh.
- Export CSV data garansi sparepart berdasarkan filter aktif.
- Notifikasi in-app untuk garansi sparepart yang akan berakhir melalui command terjadwal harian.
- Permission khusus klaim garansi sparepart: `part-sales-warranty-claim`.

Command terkait garansi:

```bash
# Jalankan notifikasi garansi akan habis secara manual
php artisan warranty:notify-expiring --days=7

# Lihat daftar scheduler termasuk job notifikasi garansi
php artisan schedule:list
```

Dokumen lanjutan implementasi lintas device tersedia di:

- `TODO_NEXT_STEPS.md`
- `TODO_KANBAN.md`

## Catatan Migrasi Cleanup Legacy

Repository ini sudah melakukan cleanup modul retail lama, termasuk migration drop tabel legacy melalui:

- `database/migrations/2026_03_06_000001_drop_legacy_retail_tables.php`

Untuk environment lama, jalankan:

```bash
php artisan migrate
```

## Struktur Modul Utama

- `app/Http/Controllers/Apps`: controller domain bengkel.
- `app/Models`: model service order, parts, purchases, sales, vehicle, appointment, dll.
- `resources/js/Pages/Dashboard`: halaman Inertia React per modul dashboard.
- `routes/web.php`: route aplikasi (dashboard, master data, transaksi, laporan, settings).
- `database/seeders`: seeder permission, role, user, dan data awal bengkel.

## Kontribusi

1. Buat branch baru dari `main`.
2. Implement perubahan dan test lokal.
3. Commit dengan pesan jelas.
4. Buka pull request berisi ringkasan perubahan dan langkah verifikasi.

## Lisensi

Project ini mengikuti lisensi MIT sesuai basis Laravel.
