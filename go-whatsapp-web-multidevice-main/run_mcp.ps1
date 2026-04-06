$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root "src"
$gcc = "C:\Users\dania\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe"
$exe = Join-Path $src "whatsapp.exe"

if (-not (Test-Path $exe)) {
    throw "Binary not found: $exe. Run .\\rebuild.ps1 first."
}

if (-not (Test-Path $gcc)) {
    throw "GCC not found: $gcc"
}

$env:CGO_ENABLED = "1"
$env:CC = $gcc

Set-Location $src
& .\whatsapp.exe mcp @args
