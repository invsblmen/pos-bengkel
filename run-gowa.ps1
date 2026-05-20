param(
    [switch]$BuildBinary,
    [switch]$MCP
)

Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

$src = Join-Path $scriptDir 'go-whatsapp-web-multidevice\src'
if (-not (Test-Path $src)) {
    Write-Error "Folder '$src' not found. Ensure repository contains go-whatsapp-web-multidevice."
    exit 1
}

Set-Location $src

if (-not (Test-Path '.env') -and (Test-Path '.env.example')) {
    Copy-Item .env.example .env -Force
    Write-Output "Created .env from .env.example"
}

if ($BuildBinary) {
    if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
        Write-Error "Go executable not found in PATH. Install Go or run the Docker script (run-gowa-docker.ps1)."
        exit 1
    }
    Write-Output "Building binary..."
    go build -o whatsapp.exe
    if ($MCP) { Write-Output "Starting MCP server..."; & .\whatsapp.exe mcp }
    else { Write-Output "Starting REST server..."; & .\whatsapp.exe rest }
    exit $LASTEXITCODE
}

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Output "Go not found. To run without Go, use Docker: .\\run-gowa-docker.ps1"
    exit 1
}

if ($MCP) {
    Write-Output "Running MCP server via 'go run'..."
    go run . mcp
} else {
    Write-Output "Running REST server via 'go run'..."
    go run . rest
}
