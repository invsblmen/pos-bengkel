Param(
    [Parameter(Position=0)]
    [string]$Action = 'run',
    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $RepoRoot 'go-whatsapp-web-multidevice/src'

Write-Host "Go WhatsApp helper (no Docker) - action:$Action"

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Error "'go' not found. Install Go 1.24+ and ensure it's on PATH."; exit 2
}

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Warning "'ffmpeg' not found. Media processing may not work properly.";
}

Set-Location $Src

switch ($Action) {
    'build' {
        Write-Host 'Building binary (whatsapp.exe)...'
        & go build -o whatsapp.exe
        Write-Host "Built: $(Join-Path $Src 'whatsapp.exe')"
        break
    }
    default {
        $exe = Join-Path $Src 'whatsapp.exe'
        if (Test-Path $exe) {
            Write-Host "Running binary: $exe rest $($Args -join ' ')"
            & $exe rest @Args
        } else {
            Write-Host "No binary found; running via 'go run'"
            & go run . rest @Args
        }
    }
}
