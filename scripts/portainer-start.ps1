# PowerShell script to start Portainer using docker compose (Windows)
$composeFile = "docker/portainer/docker-compose.yml"
if (-not (Test-Path $composeFile)) {
    Write-Error "Compose file not found: $composeFile"
    exit 1
}

Write-Host "Starting Portainer from $composeFile..."
docker compose -f $composeFile up -d --build
Write-Host "Portainer should be reachable at http://localhost:9000"
