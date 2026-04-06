$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root "src"
$go = "C:\Program Files\Go\bin\go.exe"
$gcc = "C:\Users\dania\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin\gcc.exe"

if (-not (Test-Path $go)) {
    throw "Go executable not found: $go"
}

if (-not (Test-Path $gcc)) {
    throw "GCC not found: $gcc"
}

$env:CGO_ENABLED = "1"
$env:CC = $gcc

Set-Location $src
& $go clean -cache
& $go build -a -o whatsapp.exe

Get-Item .\whatsapp.exe | Select-Object FullName, Length, LastWriteTime
