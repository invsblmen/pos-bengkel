param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Env = 'dev',
    [switch]$StartFrontend,
    [switch]$KillByPort
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
    if ($KillByPort) {
        scripts\stop-go-herd-mode.ps1 -Profile $Env -KillByPort
    } else {
        scripts\stop-go-herd-mode.ps1 -Profile $Env
    }

    if ($StartFrontend) {
        scripts\start-go-herd-mode.ps1 -Profile $Env -StartFrontend
    } else {
        scripts\start-go-herd-mode.ps1 -Profile $Env
    }
} finally {
    Pop-Location
}
