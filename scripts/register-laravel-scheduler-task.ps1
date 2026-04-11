param(
    [string]$TaskName = "POS-Bengkel-Laravel-Scheduler",
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$RunnerScript = "",
    [switch]$RunNow
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ProjectRoot)) {
    throw "Project root tidak ditemukan: $ProjectRoot"
}

$projectRootResolved = (Resolve-Path $ProjectRoot).Path
if ([string]::IsNullOrWhiteSpace($RunnerScript)) {
    $RunnerScript = Join-Path $projectRootResolved "scripts\\run-laravel-scheduler.bat"
}

if (-not (Test-Path $RunnerScript)) {
    throw "Runner script tidak ditemukan: $RunnerScript"
}

$runnerResolved = (Resolve-Path $RunnerScript).Path
$action = New-ScheduledTaskAction -Execute $runnerResolved -WorkingDirectory $projectRootResolved
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 1) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Force | Out-Null
} catch {
    throw "Gagal membuat scheduled task '$TaskName': $($_.Exception.Message)"
}

Write-Host "Scheduled task dibuat/diupdate: $TaskName"
Write-Host "Runner: $runnerResolved"
Write-Host "Task action: $runnerResolved"

if ($RunNow) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Task dijalankan sekarang: $TaskName"
}
