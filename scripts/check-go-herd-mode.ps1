param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Profile = 'dev',
    [switch]$IncludeFrontend
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
    if ($IncludeFrontend) {
        scripts\check-separated-stack.ps1 -Profile $Profile -SkipLaravel
    } else {
        scripts\check-separated-stack.ps1 -Profile $Profile -SkipLaravel -SkipFrontend
    }
} finally {
    Pop-Location
}
