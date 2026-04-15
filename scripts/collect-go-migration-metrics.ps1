param(
    [string]$Date = (Get-Date).ToString('yyyy-MM-dd'),
    [int]$VarianceThreshold = 5,
    [int]$TrendDays = 7,
    [switch]$SkipRetention
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$reportDir = Join-Path $repoRoot 'storage\logs\go-migration'
$reportPath = Join-Path $reportDir ("metrics-{0}-{1}.log" -f $Date, $timestamp)

if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

function Write-Section {
    param([string]$Title)
    "" | Tee-Object -FilePath $reportPath -Append | Out-Null
    ("===== {0} =====" -f $Title) | Tee-Object -FilePath $reportPath -Append | Out-Null
}

function Invoke-AndLog {
    param(
        [string]$Title,
        [string]$Command
    )

    Write-Section -Title $Title
    ("$ {0}" -f $Command) | Tee-Object -FilePath $reportPath -Append | Out-Null

    $output = & cmd /c $Command 2>&1
    $exitCode = $LASTEXITCODE

    if ($null -ne $output) {
        $output | Tee-Object -FilePath $reportPath -Append | Out-Null
    }

    ("[exit_code] {0}" -f $exitCode) | Tee-Object -FilePath $reportPath -Append | Out-Null

    return $exitCode
}

Set-Location $repoRoot

("Collecting Go sync metrics for date {0}" -f $Date) | Tee-Object -FilePath $reportPath -Append | Out-Null
("Report file: {0}" -f $reportPath) | Tee-Object -FilePath $reportPath -Append | Out-Null

$reconciliationExit = Invoke-AndLog -Title 'Reconciliation Daily' -Command ("php artisan go:sync:reconciliation-daily --date={0} --max-variance-percent={1}" -f $Date, $VarianceThreshold)

$retentionExit = 0
if (-not $SkipRetention) {
    $retentionExit = Invoke-AndLog -Title 'Retention Purge Dry Run' -Command ("php artisan go:sync:purge-old --days=30 --dry-run=1")
}

Write-Section -Title 'Summary'
("reconciliation_exit={0}" -f $reconciliationExit) | Tee-Object -FilePath $reportPath -Append | Out-Null
("retention_exit={0}" -f $retentionExit) | Tee-Object -FilePath $reportPath -Append | Out-Null

if ($reconciliationExit -eq 0 -and ($SkipRetention -or $retentionExit -eq 0)) {
    Write-Host ("Metrics collection completed successfully. Report: {0}" -f $reportPath)
    exit 0
}

Write-Warning ("Metrics collection completed with warnings/errors. Report: {0}" -f $reportPath)
exit 1
