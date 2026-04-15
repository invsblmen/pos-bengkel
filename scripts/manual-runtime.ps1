param(
    [ValidateSet('start', 'stop', 'status')]
    [string]$Action = 'start',
    [switch]$WithScheduler,
    [switch]$WithReverb
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$artisanPath = Join-Path $projectRoot 'artisan'

if (-not (Test-Path $artisanPath)) {
    throw "Artisan file not found: $artisanPath"
}

function Get-PhpExecutable {
    $herdPhp = Get-ChildItem -Path "$env:USERPROFILE\.config\herd\bin\php*\php.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1

    if ($null -ne $herdPhp) {
        return $herdPhp.FullName
    }

    $phpCommand = Get-Command php -ErrorAction SilentlyContinue
    if ($null -ne $phpCommand -and -not [string]::IsNullOrWhiteSpace($phpCommand.Source)) {
        return $phpCommand.Source
    }

    return $null
}

function Get-ProjectPhpProcess {
    param([string]$Match)

    $projectPathEscaped = [regex]::Escape($projectRoot)

    Get-CimInstance Win32_Process | Where-Object {
        $_.Name -match 'php' -and
        $_.CommandLine -match $Match -and
        $_.CommandLine -match $projectPathEscaped
    }
}

function Start-Reverb {
    $existing = Get-ProjectPhpProcess -Match 'artisan\s+reverb:start'
    if ($existing) {
        Write-Host 'Reverb already running.'
        return
    }

    $phpPath = Get-PhpExecutable
    if ($null -eq $phpPath) {
        throw 'PHP executable not found. Install PHP or run via Herd.'
    }

    Start-Process -FilePath $phpPath -WorkingDirectory $projectRoot -ArgumentList @('artisan', 'reverb:start')
    Write-Host 'Reverb started.'
}

function Start-Scheduler {
    $existing = Get-ProjectPhpProcess -Match 'artisan\s+schedule:work'
    if ($existing) {
        Write-Host 'Scheduler worker already running.'
        return
    }

    $phpPath = Get-PhpExecutable
    if ($null -eq $phpPath) {
        throw 'PHP executable not found. Install PHP or run via Herd.'
    }

    Start-Process -FilePath $phpPath -WorkingDirectory $projectRoot -ArgumentList @('artisan', 'schedule:work')
    Write-Host 'Scheduler worker started.'
}

function Stop-ProjectProcess {
    param([string]$Match, [string]$Name)

    $processes = Get-ProjectPhpProcess -Match $Match
    if (-not $processes) {
        Write-Host "$Name is not running."
        return
    }

    foreach ($process in $processes) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Write-Host "$Name stopped."
}

function Show-Status {
    $reverb = Get-ProjectPhpProcess -Match 'artisan\s+reverb:start'
    $scheduler = Get-ProjectPhpProcess -Match 'artisan\s+schedule:work'

    Write-Host 'Runtime status:'
    Write-Host ("- Reverb: {0}" -f ($(if ($reverb) { 'RUNNING' } else { 'STOPPED' })))
    Write-Host ("- Scheduler worker: {0}" -f ($(if ($scheduler) { 'RUNNING' } else { 'STOPPED' })))
}

$runReverb = $WithReverb.IsPresent -or ((-not $WithReverb.IsPresent) -and (-not $WithScheduler.IsPresent))
$runScheduler = $WithScheduler.IsPresent

switch ($Action) {
    'start' {
        if ($runReverb) {
            Start-Reverb
        }

        if ($runScheduler) {
            Start-Scheduler
        }

        Show-Status
    }
    'stop' {
        if ($runReverb) {
            Stop-ProjectProcess -Match 'artisan\s+reverb:start' -Name 'Reverb'
        }

        if ($runScheduler) {
            Stop-ProjectProcess -Match 'artisan\s+schedule:work' -Name 'Scheduler worker'
        }

        if (-not $WithScheduler.IsPresent -and -not $WithReverb.IsPresent) {
            Stop-ProjectProcess -Match 'artisan\s+reverb:start' -Name 'Reverb'
            Stop-ProjectProcess -Match 'artisan\s+schedule:work' -Name 'Scheduler worker'
        }

        Show-Status
    }
    'status' {
        Show-Status
    }
}