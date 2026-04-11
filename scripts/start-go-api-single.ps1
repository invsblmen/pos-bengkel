param(
    [int]$Port = 8081,
    [switch]$UseGoRun,
    [switch]$KillExisting
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$goRoot = Join-Path $root 'go-backend'
$exePath = Join-Path $goRoot 'api.exe'

function Get-ListenerByPort {
    param([int]$TargetPort)

    return Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

function Wait-ForListener {
    param(
        [int]$TargetPort,
        [int]$TimeoutSeconds = 8
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $listener = Get-ListenerByPort -TargetPort $TargetPort
        if ($null -ne $listener) {
            return $listener
        }
        Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $deadline)

    return $null
}

$existing = Get-ListenerByPort -TargetPort $Port
if ($null -ne $existing) {
    $existingProcess = Get-Process -Id $existing.OwningProcess -ErrorAction SilentlyContinue
    $processInfo = if ($null -ne $existingProcess) { "$($existingProcess.ProcessName) (PID $($existingProcess.Id))" } else { "PID $($existing.OwningProcess)" }

    if (-not $KillExisting) {
        Write-Host "Port $Port is already in use by $processInfo."
        Write-Host "Use -KillExisting to stop the listener first."
        exit 1
    }

    if ($null -ne $existingProcess) {
        Stop-Process -Id $existingProcess.Id -Force
        Write-Host "Stopped existing listener: $processInfo"
    }
}

Push-Location $goRoot
try {
    if (-not $UseGoRun -and (Test-Path $exePath)) {
        $started = Start-Process -FilePath $exePath -WorkingDirectory $goRoot -PassThru
        Write-Host "Started Go API using api.exe (PID $($started.Id))."
    } else {
        $started = Start-Process -FilePath 'go' -ArgumentList @('run', './cmd/api') -WorkingDirectory $goRoot -PassThru
        Write-Host "Started Go API using go run ./cmd/api (PID $($started.Id))."
    }
} finally {
    Pop-Location
}

$listener = Wait-ForListener -TargetPort $Port -TimeoutSeconds 8
if ($null -eq $listener) {
    Write-Host "Go API did not bind on port $Port within timeout."
    exit 1
}

Write-Host "Go API is listening on port $Port (PID $($listener.OwningProcess))."
