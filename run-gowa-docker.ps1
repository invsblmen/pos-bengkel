Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

$proj = Join-Path $scriptDir 'go-whatsapp-web-multidevice'
if (-not (Test-Path $proj)) {
    Write-Error "Folder '$proj' not found."
    exit 1
}

Set-Location $proj

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker not found. Install Docker Desktop or use run-gowa.ps1 with Go installed."
    exit 1
}

Write-Output "Starting GoWA with Docker Compose..."
docker-compose up -d --build
