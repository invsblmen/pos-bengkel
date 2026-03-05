# Panduan Onboarding Device Baru (Git Clone)

Panduan ini dipakai setelah `git clone` agar project bisa langsung jalan di device lain, termasuk setup Herd, Reverb, dan Vite.

## 1. Prasyarat

1. PHP 8.4+
2. Composer 2+
3. Node.js 20+ dan npm
4. MySQL/MariaDB
5. Laravel Herd (opsional, direkomendasikan untuk Windows)

## 2. Clone Project

```bash
git clone https://github.com/invsblmen/pos_bengkel.git
cd pos_bengkel
```

## 3. Install Dependency

```bash
composer install
npm install
```

## 4. Buat File Environment

```bash
copy .env.example .env
php artisan key:generate
```

## 5. Konfigurasi `.env` Wajib

Sesuaikan nilai berikut:

```env
APP_NAME="POSBengkel"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://pos-bengkel.test

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel12_pos_bengkel
DB_USERNAME=root
DB_PASSWORD=root

BROADCAST_CONNECTION=reverb

REVERB_APP_ID=pos-bengkel-app
REVERB_APP_KEY=pos-bengkel-key
REVERB_APP_SECRET=pos-bengkel-secret
REVERB_HOST=pos-bengkel.test
REVERB_PORT=8080
REVERB_SCHEME=http

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

Catatan penting:
1. Gunakan domain tanpa underscore, contoh `pos-bengkel.test`.
2. Hindari `pos_bengkel.test` karena berpotensi memicu `ERR_UNSAFE_REDIRECT` di browser.

## 6. Setup Herd (Jika Pakai Herd)

Jalankan dari root project:

```bash
# Opsional tapi direkomendasikan: hapus parked parent path
# agar Herd tidak auto-generate domain dari nama folder (mis. pos_bengkel.test)
cd ..
herd forget
cd pos_bengkel

herd unlink pos_bengkel
herd link pos-bengkel
herd links
herd sites
```

Pastikan hasil `herd sites` tidak lagi menampilkan `pos_bengkel.test`.

Jika domain belum `*.test`, cek dengan:

```bash
herd tld
```

Opsional HTTPS lokal:

```bash
herd secure pos-bengkel
```

Jika HTTPS aktif, ubah di `.env`:

```env
APP_URL=https://pos-bengkel.test
REVERB_SCHEME=https
```

## 7. Setup Database

```bash
php artisan migrate --seed
php artisan storage:link
```

Jika hanya butuh data bengkel:

```bash
php artisan db:seed --class=WorkshopSeeder
```

## 8. Jalankan Aplikasi (3 Terminal)

Terminal 1:

```bash
php artisan reverb:start
```

Terminal 2:

```bash
npm run dev
```

Terminal 3:

```bash
php artisan serve
```

Jika pakai Herd, terminal ke-3 tidak wajib karena web sudah dilayani Herd.

## 9. Validasi Cepat

1. Buka `http://pos-bengkel.test` atau `https://pos-bengkel.test` (jika sudah di-secure).
2. Pastikan `npm run dev` menampilkan `APP_URL` yang sama dengan `.env`.
3. Pastikan tidak ada error browser:
- `Failed to resolve import "laravel-echo"`
- `You must pass your app key when you instantiate Pusher`

## 10. Troubleshooting Ringkas

### A. Vite gagal resolve `laravel-echo`

```bash
npm install
npm ls laravel-echo pusher-js --depth=0
```

### B. Reverb gagal start, error `Class "Pusher\\Pusher" not found`

```bash
composer require pusher/pusher-php-server
```

### C. Config tidak terbaca setelah ubah `.env`

```bash
php artisan config:clear
```

### D. Port Vite 5173 sudah dipakai

Normal, Vite akan pindah ke port lain (mis. 5174).

## 11. Checklist Cepat (Copy)

```bash
composer install
npm install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan config:clear
php artisan reverb:start
npm run dev
```

Selesai. Project siap dipakai di device baru.
