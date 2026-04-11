param(
    [int]$Port = 8081
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$pidFile = Join-Path $root 'storage\logs\go-api-single.pid'

if (Test-Path $pidFile) {
    $rawProcessId = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $trackedProcessNumber = 0
    if (-not [string]::IsNullOrWhiteSpace($rawProcessId) -and [int]::TryParse($rawProcessId.Trim(), [ref]$trackedProcessNumber)) {
        $trackedProcess = Get-Process -Id $trackedProcessNumber -ErrorAction SilentlyContinue
        if ($null -ne $trackedProcess) {
            Stop-Process -Id $trackedProcessNumber -Force -ErrorAction SilentlyContinue
            Write-Host ("Stopped tracked Go API process from pid file: {0} (ProcessId {1})" -f $trackedProcess.ProcessName, $trackedProcessNumber)
        }
    }

    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($null -eq $listeners -or $listeners.Count -eq 0) {
    Write-Host "No listener found on port $Port."
    exit 0
}

$stopped = @()
foreach ($listenerEntry in $listeners) {
    $ownerProcessNumber = $listenerEntry.OwningProcess
    $process = Get-Process -Id $ownerProcessNumber -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        continue
    }

    Stop-Process -Id $ownerProcessNumber -Force
    $stopped += "$($process.ProcessName) (ProcessId $ownerProcessNumber)"
}

if ($stopped.Count -eq 0) {
    Write-Host "Listener existed on port $Port, but no process could be stopped."
    exit 1
}

if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Write-Host ("Stopped listeners on port {0}. {1}" -f $Port, ($stopped -join ', '))
