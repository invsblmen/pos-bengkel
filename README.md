# POS Bengkel (Laravel 13 + Inertia React)

`pos-bengkel` adalah aplikasi manajemen operasional bengkel yang mencakup alur service, penjualan sparepart, pembelian sparepart, stok, appointment, laporan, dan pengaturan bisnis.

Fokus repository saat ini adalah mode `workshop-only` (modul retail POS lama sudah dibersihkan dari codebase).

## Tentang Repository Ini

Repository ini berisi **aplikasi Laravel + frontend Inertia React** saja.

Komponen Go yang dipakai saat operasional lokal — `go-backend`, `go-frontend` (Next.js), dan `go-whatsapp-web-multidevice` — **tidak termasuk repository ini**. Ketiganya dikecualikan lewat `.gitignore` (pola `go-*/`, `**/go.mod`, dan sejenisnya) dan hidup sebagai project terpisah di mesin lokal. Laravel berkomunikasi dengan komponen tersebut lewat HTTP API:

- Backend Go lokal: `GO_BACKEND_BASE_URL` (default `http://127.0.0.1:8081`).
- Service WhatsApp Go (`go-whatsapp-web-multidevice`): `WHATSAPP_API_BASE_URL` (default `http://127.0.0.1:3000`).

Script di folder `scripts/` (misalnya `start-separated-stack.ps1` dan `start-whatsapp-go.ps1`) adalah helper lokal yang mengasumsikan folder-folder Go tersebut ada di mesin yang sama. Arah arsitektur jangka panjangnya: Go sebagai jalur operasi lokal utama (local-first), Laravel sebagai jalur hosting/monitoring dan sinkronisasi online, dengan paritas fitur antara keduanya. Dokumen arsitektur rinci disimpan di luar repository ini.

Dokumen yang tersedia di repo:

- [docs/GO-WITHOUT-DOCKER.md](docs/GO-WITHOUT-DOCKER.md)
- [docs/PORTAINER.md](docs/PORTAINER.md)

## Gambaran Fitur

- Dashboard bengkel dengan ringkasan operasional harian.
- Manajemen master data: customer, kendaraan, mekanik, supplier.
- Manajemen layanan: service category dan services.
- Manajemen sparepart: part category, parts, stok masuk/keluar manual, low stock alert.
- Pembelian sparepart (`part-purchases`) dengan detail item dan status.
- Penjualan sparepart langsung (`part-sales`) dengan invoice dan print.
- Manajemen garansi sparepart: input masa garansi per item, status, klaim, export CSV, dan notifikasi garansi akan berakhir.
- Service order end-to-end (buat, edit, update status, print).
- Appointment dan kalender booking.
- Manajemen kas, voucher, dan pengaturan pembayaran.
- Import data dan rekomendasi.
- Laporan: service revenue, mechanic productivity, mechanic payroll, parts inventory, outstanding payments, dan part sales profit.
- Sistem role dan permission granular (Spatie Permission).
- Integrasi WhatsApp (service Go eksternal): kirim pesan, log outbound/webhook, health check, dan retry pesan gagal dari dashboard.
- Integrasi SDMS: proxy API dan halaman SPG.
- Notifikasi in-app. Broadcasting event memakai driver `log` secara default (lihat catatan realtime di Tech Stack).

## Tech Stack

Versi berikut diambil dari `composer.json` dan `package.json` saat ini:

| Komponen | Versi |
|---|---|
| PHP | `^8.3` |
| Laravel | `^13` |
| Inertia.js | `inertiajs/inertia-laravel ^3` + `@inertiajs/react ^3` |
| React | `^19` |
| Tailwind CSS | `^3` |
| Vite | `^6` |
| Spatie Laravel Permission | `^8` |
| Laravel Sanctum | `^4` |
| Tightenco Ziggy | `^2` |
| PhpSpreadsheet | `^5` (import/export) |
| PHPUnit (dev) | `^12` |
| Laravel Pint (dev) | `^1` |

Catatan realtime: file `config/reverb.php` dan variabel `REVERB_*` di `.env.example` tersedia, tetapi paket `laravel/reverb` **belum terpasang** di `composer.json` dan `laravel-echo`/`pusher-js` tidak ada di `package.json`. Jadi perintah `php artisan reverb:start` tidak tersedia secara bawaan; dispatch event broadcast sudah dibuat aman (tidak menggagalkan transaksi inti) saat broadcaster tidak tersedia. Command watchdog kustom `reverb:watchdog-status` dan `reverb:watchdog-maintain` tersedia di `routes/console.php`.

## Prasyarat

- PHP 8.3+
- Composer
- Node.js 20+ dan npm
- MySQL/MariaDB (test otomatis memakai SQLite in-memory, lihat `phpunit.xml`)

## Instalasi

```bash
git clone https://github.com/invsblmen/pos-bengkel.git
cd pos-bengkel
cp .env.example .env
composer install
npm install
php artisan key:generate
php artisan storage:link
php artisan migrate --seed
```

Seeder default akan menyiapkan permission, role, user, workshop data, kategori service/part, supplier, kendaraan, dan data pendukung lainnya.

## Akun Default (Seeder, Lokal Saja)

- Super Admin: `arya@gmail.com` / `password`
- Cashier: `cashier@gmail.com` / `password`

> Akun ini hanya untuk development lokal. Wajib diganti/dihapus di environment production.

## Setup Lokal MariaDB

Untuk local development, gunakan MariaDB dan jalankan skrip [LOCAL_MARIADB_SETUP.sql](LOCAL_MARIADB_SETUP.sql) agar schema dan user lokal siap.

Kalau kamu mau jalankan otomatis dari PowerShell, pakai:

```powershell
scripts\setup-local-mariadb.ps1
```

Kalau lebih nyaman double-click di Windows, pakai:

```bat
scripts\setup-local-mariadb.bat
```

Rekomendasi yang dipakai di contoh env:

- Laravel: `pos_bengkel_local`
- Go backend (project terpisah): `pos_bengkel_go_local`
- User lokal: `pos_bengkel` / `pos_bengkel_password`

Setelah menjalankan skrip, update `.env` lalu jalankan `php artisan config:clear`.

## Menjalankan Aplikasi (Development)

Jalankan di terminal terpisah:

```bash
php artisan serve
npm run dev
```

Jika memakai queue untuk proses async:

```bash
php artisan queue:work
```

Build asset production:

```bash
npm run build
```

## Konfigurasi Environment

Perbarui `.env` minimal pada bagian berikut:

- `APP_NAME`, `APP_URL`
- `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `GO_BACKEND_BASE_URL` (default `http://127.0.0.1:8081`) untuk backend Go lokal
- `WHATSAPP_*` untuk integrasi WhatsApp Go (lihat bagian Integrasi WhatsApp Go)
- `BROADCAST_CONNECTION`/`BROADCAST_DRIVER` — default `log`; `REVERB_*` dan `VITE_REVERB_*` hanya relevan jika paket Reverb dipasang

## Menjalankan Komponen Go (Project Terpisah, Lokal)

Bagian ini hanya berlaku jika folder project Go tersedia di mesin lokal yang sama (tidak ada di repo ini).

Salin profil contoh lalu sesuaikan path lokal di mesinmu (jangan commit path pribadi):

```powershell
Copy-Item scripts\separated-stack.profiles.json.example scripts\separated-stack.profiles.json
```

Helper script yang tersedia:

```powershell
# Bootstrap otomatis path Go/frontend
scripts\configure-separated-stack.ps1 -Profile dev -ApplyToAllProfiles

# Start Laravel + Go + frontend (masing-masing di terminal terpisah)
scripts\start-separated-stack.ps1 -Profile dev

# Jika Laravel pakai Herd + Vite Laravel sudah jalan manual:
scripts\start-separated-stack.ps1 -Profile dev -UseHerd -SkipLaravelVite

# Mode cepat (wrapper) untuk Herd:
scripts\start-go-herd-mode.ps1 -Profile dev

# Cek endpoint service
scripts\check-separated-stack.ps1 -Profile dev

# Stop service terpusat
scripts\stop-separated-stack.ps1 -Profile dev
```

Service WhatsApp Go berjalan di port `3000`, backend Go di port `8081` (sesuai profil). Detail menjalankan WhatsApp Go ada di bagian berikutnya.

## Integrasi WhatsApp Go

Dashboard Laravel terintegrasi dengan service WhatsApp Go eksternal (`go-whatsapp-web-multidevice`, berjalan dari folder lokal terpisah, port `3000`).

### 1) Konfigurasi Environment Laravel

Tambahkan/cek nilai berikut pada file `.env` Laravel (ganti nilai contoh dengan kredensialmu sendiri, jangan commit kredensial asli):

```env
WHATSAPP_ENABLED=true
WHATSAPP_API_BASE_URL=http://127.0.0.1:3000
WHATSAPP_GO_DASHBOARD_URL=http://127.0.0.1:3000

# Gunakan salah satu akun basic auth dari service Go
WHATSAPP_API_USERNAME=<username>
WHATSAPP_API_PASSWORD=<password>

WHATSAPP_WEBHOOK_SECRET=<secret>
WHATSAPP_WEBHOOK_VERIFY_SIGNATURE=true
WHATSAPP_QUEUE=default
```

Setelah ubah `.env`, jalankan:

```bash
php artisan config:clear
```

### 2) Konfigurasi Basic Auth di Service Go

Pada file `.env` di folder service Go, gunakan format multi-user berikut:

```env
APP_BASIC_AUTH=<username>:<password>,<username2>:<password2>
APP_PORT=3000
APP_HOST=0.0.0.0
```

Catatan: Laravel hanya bisa menyuntikkan satu pasangan username/password otomatis saat redirect menu dashboard. Pilih satu akun utama untuk Laravel.

### 3) Menjalankan Service Go Tanpa Bentrok Port

Gunakan helper script (direkomendasikan):

```powershell
scripts\start-whatsapp-go.ps1
scripts\status-whatsapp-go.ps1
scripts\stop-whatsapp-go.ps1
scripts\restart-whatsapp-go.ps1
```

Perilaku script:

- `start`: cek port 3000, hindari double start, lalu jalankan service dari folder `go-whatsapp-web-multidevice\src`.
- `status`: tampilkan status RUNNING/STOPPED + PID + command line.
- `stop`: hentikan proses berdasarkan PID file atau listener port 3000.
- `restart`: stop lalu start dalam satu perintah.

### 4) Akses dari Dashboard Laravel

Menu yang tersedia:

- `WhatsApp > Integrasi WhatsApp > WhatsApp Go`
- `WhatsApp > Integrasi WhatsApp > Log WhatsApp`

Halaman Log WhatsApp menyediakan monitor outbound/webhook, retry manual pesan failed, health check service Go, auto-check periodik, dan notifikasi perubahan status.

### 5) Troubleshooting Umum

| Kondisi | Penyebab Umum | Aksi Cepat |
|---|---|---|
| Halaman WhatsApp Go `401 Unauthorized` | Basic auth Go aktif, kredensial Laravel tidak cocok | Samakan `WHATSAPP_API_USERNAME` dan `WHATSAPP_API_PASSWORD` dengan salah satu akun `APP_BASIC_AUTH`, lalu `php artisan config:clear` |
| `bind ... 3000 already in use` saat start Go | Port 3000 dipakai proses lama | Jalankan `scripts\stop-whatsapp-go.ps1`, lalu `scripts\start-whatsapp-go.ps1` |
| Menu WhatsApp Go tidak membuka halaman tujuan | URL dashboard Go belum benar | Cek `WHATSAPP_GO_DASHBOARD_URL` di `.env`, lalu `php artisan config:clear` |
| Health check menandakan `down` | Service Go belum jalan / crash | Jalankan `scripts\status-whatsapp-go.ps1`, lalu `scripts\restart-whatsapp-go.ps1` |
| Gagal kirim pesan karena format nomor | Nomor masih format lokal `08xxx` | Ubah nomor ke format internasional `62xxx` |
| Setelah restart server harus scan ulang | Session store terhapus atau akun ter-unlink | Pastikan storage/session Go tidak dihapus; scan ulang hanya jika session hilang |

Catatan keamanan session: data session/chat service Go tersimpan sebagai database lokal di folder service (di mesin lokal, di luar repo ini). Jangan pernah meng-commit database session tersebut ke repository — pola `public/storages/` dan folder storage Go sudah dikecualikan di `.gitignore`.

### 6) Apakah Perlu Scan Ulang Device Saat Server Restart?

Biasanya **tidak perlu scan ulang** jika session/device store tidak dihapus.

Perlu scan ulang jika:

1. data session/device di storage terhapus,
2. akun logout/unlink dari WhatsApp,
3. database/volume session diganti atau rusak.

## Perintah Penting

```bash
# Jalankan test
php artisan test

# Build asset production
npm run build

# Seed ulang data workshop (opsional)
php artisan db:seed --class=WorkshopSeeder

# Jalankan notifikasi garansi akan habis secara manual
php artisan warranty:notify-expiring --days=7

# Lihat daftar scheduler
php artisan schedule:list

# Cek status watchdog reverb (command kustom)
php artisan reverb:watchdog-status --lines=20
```

## Update Terbaru

### 2026-03-28

Perubahan stabilisasi dan UX:

- Hardening dispatch event broadcast agar transaksi inti tidak gagal saat broadcaster tidak tersedia.
- Penambahan alert notifikasi in-app untuk kondisi broadcaster down beruntun + recovery.
- Perbaikan route link referensi di detail service order agar aman terhadap route yang tidak tersedia.
- Penambahan halaman detail pelanggan (`customers.show`) beserta akses dari daftar pelanggan.
- Penyempurnaan UI daftar pelanggan (aksi detail/edit/hapus lebih ringkas).
- Penyempurnaan UI halaman detail service order (quick insights + mode mobile cards untuk detail item).

Script lokal (Windows) untuk runtime manual: `scripts/manual-runtime.ps1`.

### 2026-03-27

Perubahan enterprise:

- Manajemen garansi sparepart pada transaksi part sales (input masa garansi per item, status, dan klaim).
- Halaman terpusat manajemen garansi sparepart dengan filter, ringkasan, pagination, dan refresh berkala.
- Export CSV data garansi sparepart berdasarkan filter aktif.
- Notifikasi in-app untuk garansi sparepart yang akan berakhir melalui command terjadwal harian (`warranty:notify-expiring`).
- Permission khusus klaim garansi sparepart: `part-sales-warranty-claim`.

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
- `app/Services`: service layer (FIFO costing, voucher, pricing, WhatsApp, dll).
- `resources/js/Pages/Dashboard`: halaman Inertia React per modul dashboard.
- `routes/web.php`: route aplikasi (dashboard, master data, transaksi, laporan, settings).
- `database/seeders`: seeder permission, role, user, dan data awal bengkel.
- `scripts`: helper script operasional lokal (Windows/PowerShell dan shell).

## Kontribusi

1. Buat branch baru dari `main`.
2. Implement perubahan dan test lokal.
3. Commit dengan pesan jelas.
4. Buka pull request berisi ringkasan perubahan dan langkah verifikasi.

## Lisensi

Project ini mengikuti lisensi MIT sesuai basis Laravel.
