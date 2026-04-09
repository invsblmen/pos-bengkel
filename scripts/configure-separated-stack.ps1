param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Profile = 'dev',
    [string]$ProfilesFile = (Join-Path $PSScriptRoot 'separated-stack.profiles.json'),
    [string]$GoProjectPath = '',
    [string]$FrontendProjectPath = '',
    [switch]$ApplyToAllProfiles
)

$ErrorActionPreference = 'Stop'

function Ensure-ProfilesFile {
    param([string]$FilePath)

    if (Test-Path $FilePath) {
        return
    }

    $example = "$FilePath.example"
    if (-not (Test-Path $example)) {
        throw "Profile template not found: $example"
    }

    Copy-Item $example $FilePath -Force
}

function Find-GoProjectPath {
    param([string]$LaravelRoot)

    $localGo = Join-Path $LaravelRoot 'go-backend'
    if (Test-Path (Join-Path $localGo 'go.mod')) {
        return $localGo
    }

    $goRoot = 'C:\1. DANY ARDIANSYAH\Project\Go'
    if (Test-Path $goRoot) {
        $candidate = Get-ChildItem -Path $goRoot -Directory | Where-Object {
            Test-Path (Join-Path $_.FullName 'go.mod')
        } | Select-Object -First 1

        if ($candidate) {
            return $candidate.FullName
        }
    }

    return ''
}

function Find-FrontendProjectPath {
    $reactRoot = 'C:\1. DANY ARDIANSYAH\Project\React'
    if (-not (Test-Path $reactRoot)) {
        return ''
    }

    $candidate = Get-ChildItem -Path $reactRoot -Directory | Where-Object {
        Test-Path (Join-Path $_.FullName 'package.json')
    } | Select-Object -First 1

    if ($candidate) {
        return $candidate.FullName
    }

    return ''
}

function Set-ProfilePaths {
    param(
        [object]$Config,
        [string]$SelectedProfile,
        [string]$GoPath,
        [string]$FrontendPath,
        [bool]$AllProfiles
    )

    $targets = @($SelectedProfile)
    if ($AllProfiles) {
        $targets = @('dev', 'staging', 'prod')
    }

    foreach ($name in $targets) {
        $profileProperty = $Config.PSObject.Properties[$name]
        if ($null -eq $profileProperty) {
            continue
        }

        $profileRef = $profileProperty.Value

        if ($GoPath -ne '' -and $null -ne $profileRef.go) {
            $profileRef.go.projectPath = $GoPath
        }
        if ($FrontendPath -ne '' -and $null -ne $profileRef.frontend) {
            $profileRef.frontend.projectPath = $FrontendPath
        }
    }
}

$laravelRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

Ensure-ProfilesFile -FilePath $ProfilesFile

if ($GoProjectPath -eq '') {
    $GoProjectPath = Find-GoProjectPath -LaravelRoot $laravelRoot
}
if ($FrontendProjectPath -eq '') {
    $FrontendProjectPath = Find-FrontendProjectPath
}

$raw = Get-Content -Raw $ProfilesFile
$json = ConvertFrom-Json $raw

Set-ProfilePaths -Config $json -SelectedProfile $Profile -GoPath $GoProjectPath -FrontendPath $FrontendProjectPath -AllProfiles:$ApplyToAllProfiles

$json | ConvertTo-Json -Depth 10 | Set-Content -Path $ProfilesFile -Encoding UTF8

Write-Host "Updated profile config: $ProfilesFile"
Write-Host "Profile target: $Profile"
if ($ApplyToAllProfiles) {
    Write-Host "Applied to all profiles: dev/staging/prod"
}
Write-Host "Go path: $GoProjectPath"
Write-Host "Frontend path: $FrontendProjectPath"

if ([string]::IsNullOrWhiteSpace($FrontendProjectPath)) {
    Write-Host "Frontend path is still empty. Set it manually in separated-stack.profiles.json if needed."
}
