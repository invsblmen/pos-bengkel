param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Profile = 'dev',
    [string]$ProfilesFile = (Join-Path $PSScriptRoot 'separated-stack.profiles.json'),
    [switch]$KillByPort
)

$ErrorActionPreference = 'Stop'

function Stop-ByWindowTitle {
    param([string]$Title)

    $targets = Get-Process -Name powershell -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -eq $Title }

    foreach ($proc in $targets) {
        try {
            Stop-Process -Id $proc.Id -Force
            Write-Host "Stopped process by title: $Title (PID=$($proc.Id))"
        } catch {
            Write-Host "Failed stop by title: $Title (PID=$($proc.Id))"
        }
    }
}

function Stop-ByPort {
    param([int]$Port)

    $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    if (-not $connections) {
        return
    }

    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $pids) {
        try {
            Stop-Process -Id $processId -Force
            Write-Host "Stopped process on port $Port (PID=$processId)"
        } catch {
            Write-Host "Failed stop process on port $Port (PID=$processId)"
        }
    }
}

function Get-ProfileConfig {
    param(
        [string]$FilePath,
        [string]$SelectedProfile
    )

    if (-not (Test-Path $FilePath)) {
        return $null
    }

    $raw = Get-Content -Raw $FilePath
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }

    $json = ConvertFrom-Json $raw
    if (-not $json) {
        return $null
    }

    return $json.$SelectedProfile
}

Write-Host "== Stop separated stack =="
Write-Host "Profile: $Profile"

$profileConfig = Get-ProfileConfig -FilePath $ProfilesFile -SelectedProfile $Profile
if ($profileConfig -ne $null) {
    Write-Host "Using profile config file: $ProfilesFile"
}

$titles = @(
    "Laravel API [$Profile]",
    "Laravel Vite [$Profile]",
    "Go Backend [$Profile]",
    "Frontend [$Profile]"
)

foreach ($title in $titles) {
    Stop-ByWindowTitle -Title $title
}

if ($KillByPort) {
    $ports = New-Object System.Collections.Generic.List[int]

    if ($profileConfig -and $profileConfig.laravel -and $profileConfig.laravel.apiPort) {
        $ports.Add([int]$profileConfig.laravel.apiPort)
    }
    if ($profileConfig -and $profileConfig.go -and $profileConfig.go.port) {
        $ports.Add([int]$profileConfig.go.port)
    }
    if ($profileConfig -and $profileConfig.frontend -and $profileConfig.frontend.port) {
        $ports.Add([int]$profileConfig.frontend.port)
    }

    if ($ports.Count -eq 0) {
        switch ($Profile) {
            'dev' {
                $ports.Add(8000)
                $ports.Add(8081)
                $ports.Add(5173)
            }
            'staging' {
                $ports.Add(8001)
                $ports.Add(8081)
                $ports.Add(5174)
            }
            'prod' {
                $ports.Add(8002)
                $ports.Add(8081)
                $ports.Add(5175)
            }
        }
    }

    $ports | Select-Object -Unique | ForEach-Object {
        Stop-ByPort -Port $_
    }
}

Write-Host "Done."
