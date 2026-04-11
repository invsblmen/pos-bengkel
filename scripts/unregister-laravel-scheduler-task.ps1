param(
    [string]$TaskName = "POS-Bengkel-Laravel-Scheduler"
)

$ErrorActionPreference = "Stop"

try {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    Unregister-ScheduledTask -TaskName $Task.TaskName -Confirm:$false
} catch {
    $fallback = & schtasks.exe /Query /TN $TaskName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Task tidak ditemukan: $TaskName"
        exit 0
    }

    $deleteOutput = & schtasks.exe /Delete /TN $TaskName /F 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Gagal menghapus scheduled task '$TaskName':`n$deleteOutput"
    }
}

Write-Host "Scheduled task dihapus: $TaskName"
