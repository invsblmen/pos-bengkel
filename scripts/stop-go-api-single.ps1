param(
    [int]$Port = 8081
)

$ErrorActionPreference = 'Stop'

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($null -eq $listeners -or $listeners.Count -eq 0) {
    Write-Host "No listener found on port $Port."
    exit 0
}

$stopped = @()
foreach ($listener in $listeners) {
    $ownerPid = $listener.OwningProcess
    $process = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        continue
    }

    Stop-Process -Id $ownerPid -Force
    $stopped += "$($process.ProcessName) (PID $ownerPid)"
}

if ($stopped.Count -eq 0) {
    Write-Host "Listener existed on port $Port, but no process could be stopped."
    exit 1
}

Write-Host "Stopped listeners on port ${Port}: $($stopped -join ', ')"
