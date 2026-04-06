# Setup WhatsApp Web Multidevice - Windows Guide

**Setup Date:** 6 Maret 2026  
**Status:** ✅ Siap Pakai

## Prerequisites yang Sudah Terpasang
```
✓ Go 1.26.1 → C:\Program Files\Go\bin\go.exe
✓ FFmpeg 8.0.1 → Command: ffmpeg
✓ LibWebP 1.6.0 → Command: webpmux, cwebp, dwebp
✓ GCC/MinGW → WinLibs POSIX UCRT (untuk CGO)
✓ Project → C:\Developments\Golang\go-whatsapp-web-multidevice-main\src\whatsapp.exe
```

## Cara Jalan REST Server

### Metode 1: Via PowerShell (Recommended)
```powershell
# Buka PowerShell di workspace root
cd "c:\Developments\Golang\go-whatsapp-web-multidevice-main"

# Set environment variables untuk CGO
$env:CGO_ENABLED="1"
$env:CC="C:\Users\dania\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe"

# Jalankan server
.\src\whatsapp.exe rest
```

Server akan berjalan di: **http://localhost:3000**

### Metode 2: Langsung Eksekusi Binary
```powershell
cd "c:\Developments\Golang\go-whatsapp-web-multidevice-main\src"
.\whatsapp.exe rest
```

### Metode 3: Dengan Custom Flags
```powershell
# Dengan debug mode dan custom port
.\whatsapp.exe rest --debug=true --port=8080

# Dengan basic auth
.\whatsapp.exe rest --basic-auth=user:password

# Dengan WebHook
.\whatsapp.exe rest --webhook="https://webhook.site/your-endpoint"
```

## Cara Jalan MCP Server

```powershell
.\src\whatsapp.exe mcp --port=8080
```

Config untuk Cursor/AI tools:
```json
{
  "mcpServers": {
    "whatsapp": {
      "url": "http://localhost:8080/sse"
    }
  }
}
```

## Rebuild Binary (jika ada perubahan code)

```powershell
$env:CGO_ENABLED="1"
$env:CC="C:\Users\dania\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe"

cd "c:\Developments\Golang\go-whatsapp-web-multidevice-main\src"

# Clean cache dan rebuild
& "C:\Program Files\Go\bin\go.exe" clean -cache
& "C:\Program Files\Go\bin\go.exe" build -a -o whatsapp.exe
```

## Cara Setup Environment Vars Permanen

Supaya tidak perlu set env vars setiap kali, buat file batch atau tambahkan ke PowerShell profile.

### Opsi A: Buat File `run_rest.ps1` di root workspace
```powershell
# File: run_rest.ps1
$env:CGO_ENABLED="1"
$env:CC="C:\Users\dania\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe"

Set-Location "src"
.\whatsapp.exe @args
```

Kemudian jalankan dengan:
```powershell
.\run_rest.ps1 rest --debug=true
```

### Opsi B: Tambah ke System Environment Variables (Permanen)
1. Tekan `Win + X`, pilih **System**
2. Klik **Advanced system settings**
3. Tab **Environment Variables**
4. New **System Variable**:
   - Name: `CGO_ENABLED`
   - Value: `1`
5. New **System Variable**:
   - Name: `CC`
   - Value: `C:\Users\dania\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe`

Setelah itu, bisa langsung jalankan di PowerShell baru tanpa set env vars lagi.

## Configuration via `.env` File

File `.env` sudah ada di `src/.env` dengan contoh default dari `src/.env.example`.

Contoh konfigurasi di `.env`:
```env
APP_PORT=3000
APP_HOST=0.0.0.0
APP_DEBUG=false
APP_OS=Chrome
APP_BASIC_AUTH=admin:admin
WHATSAPP_AUTO_REPLY=Dont reply this message
WHATSAPP_WEBHOOK=https://webhook.site/your-endpoint
```

Setiap property bisa override dengan command-line flags:
```powershell
.\whatsapp.exe rest --port=8080 --debug=true
```

*Priority: CLI flags > environment variables > .env file*

## Check Status Server

```powershell
# Lihat server listening
netstat -ano | findstr :3000

# Test HTTP endpoint
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
```

## Helpful Links

| Resource | URL |
|----------|-----|
| README | [readme.md](./readme.md) |
| OpenAPI Docs | [docs/openapi.yaml](./docs/openapi.yaml) |
| Project Knowledge | [AGENTS.md](./AGENTS.md) |
| Web UI | http://localhost:3000 (when server running) |

## Troubleshooting

### Error: "Binary was compiled with 'CGO_ENABLED=0'"
**Solusi:** Set `$env:CGO_ENABLED="1"` sebelum rebuild dan ensure `CC` env var menunjuk ke GCC path yang valid.

### Error: CGO C compiler not found
**Solusi:** Pastikan WinLibs sudah terinstall:
```powershell
winget list --id BrechtSanders.WinLibs
```

### Port 3000 sudah terpakai
**Solusi:** Gunakan port lain:
```powershell
.\whatsapp.exe rest --port=8080
```

### Media processing error (FFmpeg/WebP)
**Solusi:** Pastikan `ffmpeg` dan `webpmux` terinstall dan accessible:
```powershell
ffmpeg -version
webpmux -version
```

---

**Last Setup:** 2026-03-06  
**Setup Status:** Production Ready
