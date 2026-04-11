param(
    [int]$Port = 8081,
    [switch]$UseGoRun,
    [switch]$KillExisting
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$goRoot = Join-Path $root 'go-backend'
$exePath = Join-Path $goRoot 'api.exe'
$logDir = Join-Path $root 'storage\logs'
$pidFile = Join-Path $logDir 'go-api-single.pid'
$outLog = Join-Path $logDir 'go-api-single.out.log'
$errLog = Join-Path $logDir 'go-api-single.err.log'

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Read-PidFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $null
    }

    $raw = (Get-Content $Path -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }

    $value = 0
    if (-not [int]::TryParse($raw.Trim(), [ref]$value)) {
        return $null
    }

    return $value
}

function Remove-PidFileSafe {
    param([string]$Path)

    if (Test-Path $Path) {
        Remove-Item $Path -Force -ErrorAction SilentlyContinue
    }
}

function Is-GoApiProcess {
    param([System.Diagnostics.Process]$Process)

    if ($null -eq $Process) {
        return $false
    }

    if ($Process.ProcessName -ieq 'api') {
        return $true
    }

    if ($Process.ProcessName -ieq 'go') {
        return $true
    }

    return $false
}

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

$pidFromFile = Read-PidFile -Path $pidFile
if ($null -ne $pidFromFile) {
    $pidProcess = Get-Process -Id $pidFromFile -ErrorAction SilentlyContinue

    if ($null -ne $pidProcess -and (Is-GoApiProcess -Process $pidProcess)) {
        if (-not $KillExisting) {
            Write-Host "Go API already tracked by pid file: PID $pidFromFile ($($pidProcess.ProcessName))."
            Write-Host "Use -KillExisting to restart safely."
            exit 0
        }

        Stop-Process -Id $pidProcess.Id -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped existing tracked Go API process: $($pidProcess.ProcessName) (PID $($pidProcess.Id))."
        Remove-PidFileSafe -Path $pidFile
    } else {
        Remove-PidFileSafe -Path $pidFile
    }
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
        $started = Start-Process -FilePath $exePath -WorkingDirectory $goRoot -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
        Write-Host "Started Go API using api.exe (PID $($started.Id))."
    } else {
        $started = Start-Process -FilePath 'go' -ArgumentList @('run', './cmd/api') -WorkingDirectory $goRoot -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
        Write-Host "Started Go API using go run ./cmd/api (PID $($started.Id))."
    }
} finally {
    Pop-Location
}

$listener = Wait-ForListener -TargetPort $Port -TimeoutSeconds 8
if ($null -eq $listener) {
    Write-Host "Go API did not bind on port $Port within timeout."
    Remove-PidFileSafe -Path $pidFile
    exit 1
}

Set-Content -Path $pidFile -Value ([string]$listener.OwningProcess) -Encoding ASCII

Write-Host "Go API is listening on port $Port (PID $($listener.OwningProcess))."
