param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Profile = 'dev',
    [switch]$KillByPort
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
    if ($KillByPort) {
        scripts\stop-separated-stack.ps1 -Profile $Profile -KillByPort
    } else {
        scripts\stop-separated-stack.ps1 -Profile $Profile
    }
} finally {
    Pop-Location
}
