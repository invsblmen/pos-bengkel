param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Profile = 'dev',
    [string]$ProfilesFile = (Join-Path $PSScriptRoot 'separated-stack.profiles.json'),
    [string]$LaravelUrl = '',
    [string]$GoUrl = '',
    [string]$FrontendUrl = '',
    [int]$TimeoutSeconds = 5,
    [switch]$SkipLaravel,
    [switch]$SkipGo,
    [switch]$SkipFrontend
)

$ErrorActionPreference = 'Stop'

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$Timeout
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $Timeout -UseBasicParsing
        [PSCustomObject]@{
            Service = $Name
            Url = $Url
            Status = 'UP'
            HttpCode = $response.StatusCode
        }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        [PSCustomObject]@{
            Service = $Name
            Url = $Url
            Status = 'DOWN'
            HttpCode = $statusCode
        }
    }
}

function Get-ProfileUrls {
    param([string]$SelectedProfile)

    switch ($SelectedProfile) {
        'dev' {
            return @{
                Laravel = 'http://127.0.0.1:8000'
                Go = 'http://127.0.0.1:8081/health'
                Frontend = 'http://127.0.0.1:5173'
            }
        }
        'staging' {
            return @{
                Laravel = 'http://127.0.0.1:8001'
                Go = 'http://127.0.0.1:8081/health'
                Frontend = 'http://127.0.0.1:5174'
            }
        }
        'prod' {
            return @{
                Laravel = 'http://127.0.0.1:8002'
                Go = 'http://127.0.0.1:8081/health'
                Frontend = 'http://127.0.0.1:5175'
            }
        }
        default {
            throw "Unknown profile: $SelectedProfile"
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

$defaults = Get-ProfileUrls -SelectedProfile $Profile
$profileConfig = Get-ProfileConfig -FilePath $ProfilesFile -SelectedProfile $Profile
if ($profileConfig -ne $null) {
    Write-Host "Using profile config file: $ProfilesFile"

    if ($profileConfig.laravel -and $profileConfig.laravel.url) {
        $defaults.Laravel = [string]$profileConfig.laravel.url
    }
    if ($profileConfig.go -and $profileConfig.go.healthUrl) {
        $defaults.Go = [string]$profileConfig.go.healthUrl
    }
    if ($profileConfig.frontend -and $profileConfig.frontend.url) {
        $defaults.Frontend = [string]$profileConfig.frontend.url
    }
}

if ($LaravelUrl -eq '') { $LaravelUrl = $defaults.Laravel }
if ($GoUrl -eq '') { $GoUrl = $defaults.Go }
if ($FrontendUrl -eq '') { $FrontendUrl = $defaults.Frontend }

Write-Host "== Check separated stack =="
Write-Host "Profile: $Profile"

$results = @()
if (-not $SkipLaravel) {
    $results += Test-Endpoint -Name 'Laravel' -Url $LaravelUrl -Timeout $TimeoutSeconds
} else {
    Write-Host "Skipping Laravel check (-SkipLaravel)."
}

if (-not $SkipGo) {
    $results += Test-Endpoint -Name 'Go Backend' -Url $GoUrl -Timeout $TimeoutSeconds
} else {
    Write-Host "Skipping Go check (-SkipGo)."
}

if (-not $SkipFrontend) {
    $results += Test-Endpoint -Name 'Frontend' -Url $FrontendUrl -Timeout $TimeoutSeconds
} else {
    Write-Host "Skipping Frontend check (-SkipFrontend)."
}

if ($results.Count -eq 0) {
    Write-Host 'No checks were executed.'
    exit 0
}

$results | Format-Table -AutoSize

$downCount = ($results | Where-Object { $_.Status -eq 'DOWN' }).Count
if ($downCount -gt 0) {
    exit 1
}

exit 0
