$ErrorActionPreference = 'SilentlyContinue'

$projectPath = Split-Path -Parent $PSScriptRoot
$projectPathEscaped = [regex]::Escape($projectPath)
$artisanPath = Join-Path $projectPath 'artisan'
$artisanPathEscaped = [regex]::Escape($artisanPath)
$pidFilePath = Join-Path $projectPath 'storage\framework\cache\reverb.pid'

function Get-ProjectReverbProcesses {
    Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -match 'artisan\s+reverb:start' -and
        ($_.CommandLine -match $projectPathEscaped -or $_.CommandLine -match $artisanPathEscaped) -and
        $_.Name -match 'php|powershell'
    }
}

function Get-ReverbProcessFromPidFile {
    if (-not (Test-Path $pidFilePath)) {
        return $null
    }

    $pidText = Get-Content $pidFilePath -ErrorAction SilentlyContinue | Select-Object -First 1
    $processId = 0
    if (-not [int]::TryParse($pidText, [ref]$processId)) {
        return $null
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
    if ($null -ne $process -and $process.CommandLine -match 'artisan\s+reverb:start') {
        return $process
    }

    return $null
}

function Stop-ReverbByPortOwner {
    $listener = Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $listener) {
        return
    }

    $ownerProcessId = $listener.OwningProcess
    if ($null -eq $ownerProcessId) {
        return
    }

    $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerProcessId"
    if ($null -ne $owner -and $owner.CommandLine -match 'artisan\s+reverb:start') {
        Stop-Process -Id $ownerProcessId -Force -ErrorAction SilentlyContinue
    }
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

# Check whether Herd app is running.
$herdProcess = Get-Process -Name "Herd" -ErrorAction SilentlyContinue
if ($null -eq $herdProcess) {
    $trackedProcess = Get-ReverbProcessFromPidFile
    if ($null -ne $trackedProcess) {
        Stop-Process -Id $trackedProcess.ProcessId -Force -ErrorAction SilentlyContinue
    }

    # Herd is down: stop Reverb for this project (if any).
    $projectReverbProcesses = Get-ProjectReverbProcesses
    foreach ($proc in $projectReverbProcesses) {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }

    # Fallback: if old startup style left only php listener, stop by 8080 owner.
    Stop-ReverbByPortOwner
    Remove-Item $pidFilePath -ErrorAction SilentlyContinue
    exit 0
}

# If Reverb already has an active process command, do nothing.
$trackedReverbProcess = Get-ReverbProcessFromPidFile
if ($null -ne $trackedReverbProcess) {
    exit 0
}

# If Reverb already has an active process command, do nothing.
$reverbProcess = Get-ProjectReverbProcesses
if ($null -ne $reverbProcess) {
    exit 0
}

# If port 8080 is already listening, assume Reverb is up.
$reverbPort = Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue
if ($null -ne $reverbPort) {
    exit 0
}

$phpExecutable = Get-PhpExecutable
if ($null -eq $phpExecutable) {
    exit 1
}

$started = Start-Process -FilePath $phpExecutable -WorkingDirectory $projectPath -ArgumentList @('artisan', 'reverb:start') -PassThru
if ($null -ne $started) {
    Set-Content -Path $pidFilePath -Value $started.Id -Encoding ASCII
}
exit 0
