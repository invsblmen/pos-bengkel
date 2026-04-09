param(
    [string]$LaravelRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$GoProjectPath = '',
    [string]$FrontendProjectPath = '',
    [string]$ProfilesFile = (Join-Path $PSScriptRoot 'separated-stack.profiles.json'),
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Profile = 'dev',
    [string]$LaravelCommand = '',
    [string]$GoCommand = '',
    [string]$FrontendCommand = '',
    [switch]$UseHerd,
    [switch]$SkipLaravelVite,
    [switch]$SkipLaravel,
    [switch]$SkipGo,
    [switch]$SkipFrontend
)

$ErrorActionPreference = 'Stop'

function Start-NewTerminal {
    param(
        [string]$WorkingDirectory,
        [string]$Command,
        [string]$Title
    )

    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes("Set-Location '$WorkingDirectory'; `$Host.UI.RawUI.WindowTitle = '$Title'; $Command"))
    Start-Process powershell -ArgumentList "-NoExit", "-EncodedCommand", $encoded | Out-Null
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

function Get-DefaultCommand {
    param(
        [string]$Service,
        [string]$SelectedProfile
    )

    switch ("${Service}:${SelectedProfile}") {
        'laravel:dev' { return "`$env:STACK_PROFILE='dev'; php artisan serve" }
        'laravel:staging' { return "`$env:STACK_PROFILE='staging'; php artisan serve --host=127.0.0.1 --port=8001" }
        'laravel:prod' { return "`$env:STACK_PROFILE='prod'; php artisan serve --host=127.0.0.1 --port=8002" }

        'go:dev' { return "`$env:STACK_PROFILE='dev'; go run ./cmd/api" }
        'go:staging' { return "`$env:STACK_PROFILE='staging'; go run ./cmd/api" }
        'go:prod' { return "`$env:STACK_PROFILE='prod'; go run ./cmd/api" }

        'frontend:dev' { return "`$env:STACK_PROFILE='dev'; npm run dev" }
        'frontend:staging' { return "`$env:STACK_PROFILE='staging'; npm run dev -- --port 5174" }
        'frontend:prod' { return "`$env:STACK_PROFILE='prod'; npm run dev -- --port 5175" }

        default { throw "Unknown service/profile combination: $Service / $SelectedProfile" }
    }
}

Write-Host "== Start separated stack =="
Write-Host "Profile: $Profile"

$profileConfig = Get-ProfileConfig -FilePath $ProfilesFile -SelectedProfile $Profile
if ($profileConfig -ne $null) {
    Write-Host "Using profile config file: $ProfilesFile"
}

if ($GoProjectPath -eq '' -and $profileConfig -and $profileConfig.go -and $profileConfig.go.projectPath) {
    $GoProjectPath = [string]$profileConfig.go.projectPath
}
if ($FrontendProjectPath -eq '' -and $profileConfig -and $profileConfig.frontend -and $profileConfig.frontend.projectPath) {
    $FrontendProjectPath = [string]$profileConfig.frontend.projectPath
}

if ($LaravelCommand -eq '') {
    if ($profileConfig -and $profileConfig.laravel -and $profileConfig.laravel.command) {
        $LaravelCommand = [string]$profileConfig.laravel.command
    } else {
        $LaravelCommand = Get-DefaultCommand -Service 'laravel' -SelectedProfile $Profile
    }
}
if ($GoCommand -eq '') {
    if ($profileConfig -and $profileConfig.go -and $profileConfig.go.command) {
        $GoCommand = [string]$profileConfig.go.command
    } else {
        $GoCommand = Get-DefaultCommand -Service 'go' -SelectedProfile $Profile
    }
}
if ($FrontendCommand -eq '') {
    if ($profileConfig -and $profileConfig.frontend -and $profileConfig.frontend.command) {
        $FrontendCommand = [string]$profileConfig.frontend.command
    } else {
        $FrontendCommand = Get-DefaultCommand -Service 'frontend' -SelectedProfile $Profile
    }
}

if (-not $SkipLaravel) {
    if (-not (Test-Path (Join-Path $LaravelRoot 'artisan'))) {
        throw "Laravel root tidak valid: $LaravelRoot"
    }

    if ($UseHerd) {
        Write-Host "[Laravel] API startup skipped because -UseHerd is enabled (Laravel handled by Herd)."
    } else {
        Write-Host "[Laravel] starting command: $LaravelCommand"
        Start-NewTerminal -WorkingDirectory $LaravelRoot -Command $LaravelCommand -Title "Laravel API [$Profile]"
    }

    $laravelViteCommand = "npm run dev"
    if ($profileConfig -and $profileConfig.laravel -and $profileConfig.laravel.viteCommand) {
        $laravelViteCommand = [string]$profileConfig.laravel.viteCommand
    }

    if ($SkipLaravelVite) {
        Write-Host "[Laravel] Vite startup skipped because -SkipLaravelVite is enabled."
    } else {
        Write-Host "[Laravel] starting command: $laravelViteCommand"
        Start-NewTerminal -WorkingDirectory $LaravelRoot -Command "`$env:STACK_PROFILE='$Profile'; $laravelViteCommand" -Title "Laravel Vite [$Profile]"
    }
}

if (-not $SkipGo -and $GoProjectPath -ne '') {
    if (-not (Test-Path (Join-Path $GoProjectPath 'go.mod'))) {
        throw "Go project path tidak valid (go.mod tidak ditemukan): $GoProjectPath"
    }

    Write-Host "[Go] starting command: $GoCommand"
    Start-NewTerminal -WorkingDirectory $GoProjectPath -Command $GoCommand -Title "Go Backend [$Profile]"
} elseif (-not $SkipGo -and $GoProjectPath -eq '') {
    Write-Host "[Go] skipped because projectPath is empty. Set it in separated-stack.profiles.json or pass -GoProjectPath."
}

if (-not $SkipFrontend -and $FrontendProjectPath -ne '') {
    if (-not (Test-Path (Join-Path $FrontendProjectPath 'package.json'))) {
        throw "Frontend path tidak valid (package.json tidak ditemukan): $FrontendProjectPath"
    }

    Write-Host "[Frontend] starting command: $FrontendCommand"
    Start-NewTerminal -WorkingDirectory $FrontendProjectPath -Command $FrontendCommand -Title "Frontend [$Profile]"
} elseif (-not $SkipFrontend -and $FrontendProjectPath -eq '') {
    Write-Host "[Frontend] skipped because projectPath is empty. Set it in separated-stack.profiles.json or pass -FrontendProjectPath."
}

Write-Host "Done. Gunakan scripts\check-separated-stack.ps1 -Profile $Profile untuk cek status endpoint."
