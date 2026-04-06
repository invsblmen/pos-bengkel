# Quick Start Shortcuts

Salinan ke `src/` folder dan taruh file-file ini di workspace root untuk kemudahan.

## `run_rest.ps1` - Start REST Server
Copy content di bawah ke file `run_rest.ps1` di **workspace root**:

```powershell
# run_rest.ps1 - Start WhatsApp REST API server

$env:CGO_ENABLED = "1"
$env:CC = "C:\Users\dania\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe"

Set-Location -Path "src"
& .\whatsapp.exe rest @args

# Usage:
# .\run_rest.ps1
# .\run_rest.ps1 --port=8080
# .\run_rest.ps1 --debug=true --basic-auth=user:pass
```

Jalankan dengan: `.\run_rest.ps1`

## `run_mcp.ps1` - Start MCP Server
Copy content di bawah ke file `run_mcp.ps1` di **workspace root**:

```powershell
# run_mcp.ps1 - Start WhatsApp MCP server

$env:CGO_ENABLED = "1"
$env:CC = "C:\Users\dania\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe"

Set-Location -Path "src"
& .\whatsapp.exe mcp @args

# Usage:
# .\run_mcp.ps1
# .\run_mcp.ps1 --port=8080 --host=127.0.0.1
```

Jalankan dengan: `.\run_mcp.ps1`

## `rebuild.ps1` - Rebuild Binary
Copy content di bawah ke file `rebuild.ps1` di **workspace root**:

```powershell
# rebuild.ps1 - Rebuild WhatsApp binary

$env:CGO_ENABLED = "1"
$env:CC = "C:\Users\dania\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe"

Set-Location -Path "src"

Write-Host "Cleaning cache..." -ForegroundColor Green
& "C:\Program Files\Go\bin\go.exe" clean -cache

Write-Host "Building binary..." -ForegroundColor Green
& "C:\Program Files\Go\bin\go.exe" build -a -o whatsapp.exe

if (Test-Path "whatsapp.exe") {
    Write-Host "✓ Build successful!" -ForegroundColor Green
    Get-Item "whatsapp.exe" | Select-Object Length,LastWriteTime
} else {
    Write-Host "✗ Build failed!" -ForegroundColor Red
}
```

Jalankan dengan: `.\rebuild.ps1`

---

**Tip:** Jalankan PowerShell script pertama kali mungkin ada error policy. Jika diminta, ketik:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

Setelah itu script bisa dijalankan tanpa masalah.
