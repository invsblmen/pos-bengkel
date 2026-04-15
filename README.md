# POS Bengkel (Laravel 12 + Inertia React)

`pos_bengkel` adalah aplikasi manajemen operasional bengkel yang mencakup alur service, penjualan sparepart, pembelian sparepart, stok, appointment, laporan, dan pengaturan bisnis.

Fokus repository saat ini adalah mode `workshop-only` (modul retail POS lama sudah dibersihkan dari codebase).

## Arah Akhir Arsitektur

- GO backend dipakai sebagai jalur operasi lokal utama (local-first execution).
- Laravel dipakai sebagai jalur hosting/network untuk monitoring, fallback, dan sinkronisasi online.
- Frontend harus parity (fitur, desain, UX) antara jalur Laravel dan GO.
- Untuk jalur GO, realtime wajib native GO (WebSocket GO), tanpa ketergantungan Echo/Reverb.

Boundary dokumen acuan (2026-04-14):

- [ARCHITECTURE_BOUNDARY.md](ARCHITECTURE_BOUNDARY.md)
- [GO_TO_LARAVEL_SYNC_CHECKLIST.md](GO_TO_LARAVEL_SYNC_CHECKLIST.md)
- [BACKEND_COUPLING_AUDIT_2026-04-14.md](BACKEND_COUPLING_AUDIT_2026-04-14.md)

### Status Frontend GO (Update)

- Frontend GO aktif sekarang berjalan sebagai Next.js App Router native di [go-frontend](go-frontend).
- Arsip frontend legacy sudah dipruned dari workspace aktif.
- Dokumentasi detail frontend GO tersedia di [go-frontend/README.md](go-frontend/README.md).

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
- Notifikasi in-app dan dukungan realtime: Laravel path dapat memakai Reverb/Echo; GO path memakai realtime native GO.

## Tech Stack

- PHP `^8.2`
- Laravel `^12`
- Inertia.js (Laravel + React)
- React `^18`
- Tailwind CSS `^3`
- Vite `^6`
- Spatie Laravel Permission
- Laravel Reverb + Pusher protocol (khusus jalur Laravel, bukan keharusan jalur GO)

## Prasyarat

- PHP 8.2+
- Composer
- Node.js 20+ dan npm
- MySQL/MariaDB

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
- Go backend: `pos_bengkel_go_local`
- User lokal: `pos_bengkel` / `pos_bengkel_password`

Setelah menjalankan skrip, update `.env` lalu jalankan `php artisan config:clear` dan restart service Go.

## Menjalankan Laravel + Go + Frontend Terpisah

Jika Go backend dan frontend baru dipindah ke folder lain, gunakan runbook:

- [SEPARATED_STACK_RUNBOOK.md](SEPARATED_STACK_RUNBOOK.md)

Helper script yang tersedia:

```powershell
# One-time setup profile config (opsional, direkomendasikan)
Copy-Item scripts\separated-stack.profiles.json.example scripts\separated-stack.profiles.json

# Atau bootstrap otomatis path Go/frontend
scripts\configure-separated-stack.ps1 -Profile dev -ApplyToAllProfiles

# Start Laravel + Go + frontend (masing-masing di terminal terpisah)
scripts\start-separated-stack.ps1 -Profile dev -GoProjectPath "C:\Projects\pos_bengkel_go" -FrontendProjectPath "C:\Projects\pos_bengkel_frontend"

# Atau kalau sudah isi profile config, cukup:
scripts\start-separated-stack.ps1 -Profile dev

# Jika Laravel pakai Herd + Vite Laravel sudah jalan manual:
scripts\start-separated-stack.ps1 -Profile dev -UseHerd -SkipLaravelVite

# Mode cepat (wrapper) untuk Herd:
scripts\start-go-herd-mode.ps1 -Profile dev

# Cek endpoint service
scripts\check-separated-stack.ps1 -Profile dev

# Cek parsial (contoh, lewati Laravel check)
scripts\check-separated-stack.ps1 -Profile dev -SkipLaravel

# Mode cepat check Go-only saat pakai Herd:
scripts\check-go-herd-mode.ps1 -Profile dev

# Restart Go-only saat pakai Herd:
scripts\restart-go-herd-mode.ps1 -Env dev

# Stop service terpusat
scripts\stop-separated-stack.ps1 -Profile dev

# Stop mode cepat Go-only saat pakai Herd:
scripts\stop-go-herd-mode.ps1 -Profile dev
```

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

## Cheat Sheet Operasional (Cepat)

Jalankan dari root project `pos_bengkel`:

```powershell
# Start Laravel + frontend
php artisan serve
npm run dev

# Queue + Reverb (opsional, khusus jalur Laravel/hosting)
php artisan queue:work
php artisan reverb:start

# WhatsApp Go helper scripts
scripts\start-whatsapp-go.ps1
scripts\status-whatsapp-go.ps1
scripts\restart-whatsapp-go.ps1
scripts\stop-whatsapp-go.ps1

# Reload config setelah ubah .env
php artisan config:clear
```

### If This Then That (Troubleshooting Cepat)

| Kondisi | Penyebab Umum | Aksi Cepat |
|---|---|---|
| Halaman WhatsApp Go `401 Unauthorized` | Basic auth Go aktif, kredensial Laravel tidak cocok | Samakan `WHATSAPP_API_USERNAME` dan `WHATSAPP_API_PASSWORD` dengan salah satu akun `APP_BASIC_AUTH`, lalu `php artisan config:clear` |
| `bind ... 3000 already in use` saat start Go | Port 3000 dipakai proses lama | Jalankan `scripts\stop-whatsapp-go.ps1`, lalu `scripts\start-whatsapp-go.ps1` |
| Menu WhatsApp Go tidak membuka halaman tujuan | URL dashboard Go belum benar | Cek `WHATSAPP_GO_DASHBOARD_URL` di `.env`, lalu `php artisan config:clear` |
| Health check menandakan `down` | Service Go belum jalan / crash | Jalankan `scripts\status-whatsapp-go.ps1`, lalu `scripts\restart-whatsapp-go.ps1` |
| Gagal kirim pesan karena format nomor | Nomor masih format lokal `08xxx` | Ubah nomor ke format internasional `62xxx` |
| Setelah restart server harus scan ulang | Session store terhapus atau akun ter-unlink | Pastikan storage/session Go tidak dihapus; scan ulang hanya jika session hilang |

## Konfigurasi Environment

Perbarui `.env` minimal pada bagian berikut:

- `APP_NAME`, `APP_URL`
- `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `BROADCAST_CONNECTION` (jika jalur Laravel memakai Reverb)
- `REVERB_*` dan `VITE_REVERB_*` hanya untuk jalur Laravel
- `NEXT_PUBLIC_WS_URL` dan `NEXT_PUBLIC_WS_TOKEN` di `.env` `go-frontend` untuk jalur GO realtime native

## Inisialisasi Database

```bash
php artisan migrate --seed
```

Seeder default akan menyiapkan permission, role, user, workshop data, kategori service/part, supplier, kendaraan, dan data pendukung lainnya.

## Akun Default

- Super Admin: `arya@gmail.com` / `password`
- Cashier: `cashier@gmail.com` / `password`

## Menjalankan Aplikasi (Development)

Jalankan di terminal terpisah (jalur Laravel):

```bash
php artisan serve
npm run dev
php artisan reverb:start
```

Jalur GO local (realtime native GO) gunakan backend GO yang berjalan di port layanan GO (contoh `:8081`) dan frontend GO (Next.js) yang mengarah ke `NEXT_PUBLIC_WS_URL`.

Jika memakai queue untuk proses async:

```bash
php artisan queue:work
```

Untuk menjalankan WhatsApp Go dengan aman dari Windows PowerShell:

```powershell
scripts\start-whatsapp-go.ps1
```

Script tersebut akan mengecek port 3000 terlebih dahulu, menghindari double start, lalu menjalankan service dari folder `go-whatsapp-web-multidevice-main\src`.

Untuk menghentikan dan mengecek statusnya:

```powershell
scripts\stop-whatsapp-go.ps1
scripts\status-whatsapp-go.ps1
```

Untuk restart (stop lalu start) dalam satu perintah:

```powershell
scripts\restart-whatsapp-go.ps1
```

## Integrasi WhatsApp Go (Lengkap)

Bagian ini merangkum seluruh instruksi operasional WhatsApp Go yang sudah diintegrasikan ke dashboard Laravel.

### 1) Konfigurasi Environment Laravel

Tambahkan/cek nilai berikut pada file `.env` Laravel:

```env
WHATSAPP_ENABLED=true
WHATSAPP_API_BASE_URL=http://127.0.0.1:3000
WHATSAPP_GO_DASHBOARD_URL=http://127.0.0.1:3000

# Gunakan salah satu akun basic auth dari service Go
WHATSAPP_API_USERNAME=kemal
WHATSAPP_API_PASSWORD=secret

WHATSAPP_WEBHOOK_SECRET=secret
WHATSAPP_WEBHOOK_VERIFY_SIGNATURE=true
WHATSAPP_QUEUE=default
```

Setelah ubah `.env`, jalankan:

```bash
php artisan config:clear
```

### 2) Konfigurasi Basic Auth di Service Go

Pada file `go-whatsapp-web-multidevice-main/src/.env`, gunakan format multi-user berikut:

```env
APP_BASIC_AUTH=kemal:secret,toni:password,userName:secretPassword
APP_PORT=3000
APP_HOST=0.0.0.0
```

Catatan:
- Laravel hanya bisa menyuntikkan satu pasangan username/password otomatis saat redirect menu dashboard.
- Pilih satu akun utama untuk Laravel (contoh: `kemal:secret`).

### 3) Menjalankan Service Go Tanpa Bentrok Port

Gunakan helper script (direkomendasikan):

```powershell
scripts\start-whatsapp-go.ps1
scripts\status-whatsapp-go.ps1
scripts\stop-whatsapp-go.ps1
scripts\restart-whatsapp-go.ps1
```

Perilaku script:
- `start`: cek port 3000, hindari double start, lalu jalankan service.
- `status`: tampilkan status RUNNING/STOPPED + PID + command line.
- `stop`: hentikan proses berdasarkan PID file atau listener port 3000.
- `restart`: stop lalu start dalam satu perintah.

### 4) Akses dari Dashboard Laravel

Menu yang tersedia:
- `WhatsApp > Integrasi WhatsApp > WhatsApp Go`
- `WhatsApp > Integrasi WhatsApp > Log WhatsApp`

Halaman Log WhatsApp menyediakan:
- monitor outbound/webhook,
- retry manual pesan failed,
- health check service Go,
- auto-check periodik,
- toast notifikasi perubahan status,
- beep alert saat service berubah ke down.

### 5) Troubleshooting Umum

#### a) Halaman Go `Unauthorized (401)`

Penyebab paling umum: Basic Auth aktif di Go, tapi kredensial Laravel belum cocok.

Checklist:
1. Pastikan `APP_BASIC_AUTH` di Go benar.
2. Pastikan `WHATSAPP_API_USERNAME` dan `WHATSAPP_API_PASSWORD` di Laravel cocok dengan salah satu akun Go.
3. Jalankan `php artisan config:clear`.
4. Coba akses lagi dari menu dashboard.

#### b) Service Go gagal start (`bind ... 3000 already in use`)

Port 3000 dipakai proses lain. Gunakan:

```powershell
scripts\stop-whatsapp-go.ps1
scripts\start-whatsapp-go.ps1
```

#### c) Error format nomor telepon

Gunakan format internasional (`62xxxx`), bukan format lokal yang diawali `08`.

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
```

## Update Terbaru

### 2026-03-28

Perubahan stabilisasi dan UX yang baru ditambahkan:

- Hardening realtime event dispatch agar transaksi inti tidak gagal saat broadcaster (Reverb) tidak tersedia sementara pada jalur Laravel.
- Penambahan alert notifikasi in-app untuk kondisi Reverb down beruntun + recovery pada jalur Laravel.
- Penambahan konfigurasi host khusus backend broadcast: `REVERB_BROADCAST_HOST` (jalur Laravel).
- Reverb lokal sekarang dijalankan manual saat dibutuhkan lewat launcher runtime.
- Jalur GO local tetap memakai realtime native GO (`/ws`) dan tidak memerlukan dependensi Echo/Reverb.
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

Script lokal (Windows) untuk runtime manual:

- `scripts/manual-runtime.ps1`

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
