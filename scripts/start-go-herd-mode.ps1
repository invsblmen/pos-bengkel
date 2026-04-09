param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Profile = 'dev',
    [switch]$StartFrontend
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
    if ($StartFrontend) {
        scripts\start-separated-stack.ps1 -Profile $Profile -UseHerd -SkipLaravelVite
    } else {
        scripts\start-separated-stack.ps1 -Profile $Profile -UseHerd -SkipLaravelVite -SkipFrontend
    }
} finally {
    Pop-Location
}
