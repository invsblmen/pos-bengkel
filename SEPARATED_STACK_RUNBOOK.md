# Runbook Dual Project (Laravel + Go + Frontend Terpisah)

Dokumen ini untuk mode transisi/pasca-transisi saat project Go backend dan frontend dipindah ke folder lain di luar repository Laravel ini.

## Tujuan

1. Laravel tetap bisa berjalan sebagai legacy/fallback.
2. Go backend berjalan sebagai backend utama baru.
3. Frontend baru berjalan terpisah dan mengakses Go backend.

## Struktur Folder yang Disarankan

Contoh (bebas menyesuaikan):

```text
C:\Projects\pos_bengkel_laravel
C:\Projects\pos_bengkel_go
C:\Projects\pos_bengkel_frontend
```

## Kontrak Operasional Minimal

1. Port tidak bentrok.
2. Env masing-masing project dipisah.
3. Database/schema tetap kompatibel dengan mode fallback Laravel.
4. Feature flag bridge Go di Laravel tetap dikontrol via `.env`.

## Menjalankan Semua Service (Windows)

### Opsi A: Langsung via parameter path

Gunakan script:

```powershell
scripts\start-separated-stack.ps1 -Profile dev -GoProjectPath "C:\Projects\pos_bengkel_go" -FrontendProjectPath "C:\Projects\pos_bengkel_frontend"
```

Script akan membuka terminal baru untuk:

1. Laravel API (`php artisan serve`)
2. Laravel asset dev server (`npm run dev`)
3. Go backend (`go run ./cmd/api`)
4. Frontend baru (`npm run dev`)

### Opsi B: Pakai file profile config (direkomendasikan)

1. Jalankan bootstrap config otomatis:

```powershell
scripts\configure-separated-stack.ps1 -Profile dev -ApplyToAllProfiles
```

2. Atau copy manual file contoh:

```powershell
Copy-Item scripts\separated-stack.profiles.json.example scripts\separated-stack.profiles.json
```

3. Edit path project sesuai mesin Anda jika diperlukan.

4. Jalankan tanpa parameter path:

```powershell
scripts\start-separated-stack.ps1 -Profile dev
```

### Opsi C: Laravel dikelola Herd + npm dev sudah jalan manual

Jika Laravel API sudah ditangani Herd dan Vite Laravel sudah Anda jalankan sendiri di terminal lain, gunakan:

```powershell
scripts\start-separated-stack.ps1 -Profile dev -UseHerd -SkipLaravelVite
```

Atau jika hanya ingin menyalakan Go backend saja:

```powershell
scripts\start-separated-stack.ps1 -Profile dev -UseHerd -SkipLaravelVite -SkipFrontend
```

Mode cepat (wrapper) untuk workflow Herd + Vite manual:

```powershell
scripts\start-go-herd-mode.ps1 -Profile dev
scripts\check-go-herd-mode.ps1 -Profile dev
scripts\restart-go-herd-mode.ps1 -Env dev
scripts\stop-go-herd-mode.ps1 -Profile dev
```

Profil yang tersedia:

1. `dev` (default): Laravel `8010`, frontend `5180`
2. `staging`: Laravel `8001`, frontend `5174`
3. `prod`: Laravel `8002`, frontend `5175`

## Cek Kesehatan Service

Gunakan:

```powershell
scripts\check-separated-stack.ps1 -Profile dev
```

Untuk mode Herd/manual service, bisa pakai check parsial:

```powershell
scripts\check-separated-stack.ps1 -Profile dev -SkipLaravel
scripts\check-separated-stack.ps1 -Profile dev -SkipFrontend
```

Atau override URL:

```powershell
scripts\check-separated-stack.ps1 -LaravelUrl "http://127.0.0.1:8000" -GoUrl "http://127.0.0.1:8081/health" -FrontendUrl "http://127.0.0.1:5173"
```

Contoh override untuk profile dev saat ini:

```powershell
scripts\check-separated-stack.ps1 -LaravelUrl "http://127.0.0.1:8010" -GoUrl "http://127.0.0.1:8081/health" -FrontendUrl "http://127.0.0.1:5180"
```

Script check akan otomatis membaca `scripts\separated-stack.profiles.json` jika file tersedia.

## Menghentikan Service Terpusat

Gunakan:

```powershell
scripts\stop-separated-stack.ps1 -Profile dev
```

Jika perlu stop lebih agresif berdasarkan port:

```powershell
scripts\stop-separated-stack.ps1 -Profile dev -KillByPort
```

Script stop juga otomatis membaca konfigurasi port dari `scripts\separated-stack.profiles.json` bila file tersedia.

## Rekomendasi Mode Pasca Migrasi

1. Mode aktif-utama: frontend baru -> Go backend.
2. Laravel dijaga untuk fallback terkontrol selama masa stabilisasi.
3. Setelah stabil, Laravel bisa dipertahankan sebagai legacy mode atau dipensiunkan bertahap.
