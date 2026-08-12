# Portainer (Docker UI) Setup

This project includes a small Docker Compose file to deploy Portainer CE locally for managing Docker via web UI.

Files added:
- `docker/portainer/docker-compose.yml` — Compose file for Portainer CE
- `scripts/portainer-start.sh` — Unix shell script to start Portainer
- `scripts/portainer-start.ps1` — PowerShell script to start Portainer (Windows)

Quick start (one-time, requires Docker):

Unix / macOS:
```bash
sh scripts/portainer-start.sh
```

Windows (PowerShell):
```powershell
.\iles\scripts\portainer-start.ps1
```

Or run manually:
```bash
docker compose -f docker/portainer/docker-compose.yml up -d --build
```

Open `http://localhost:9000` after startup to access the Portainer UI.

Security notes:
- The compose file binds the Docker socket into the Portainer container (`/var/run/docker.sock`). This is convenient but gives Portainer full control over the Docker host — only run on trusted machines.
- For production, prefer securing the Docker Engine with TLS and configure Portainer to connect over TCP with TLS.

If you want me to start Portainer now from this environment, confirm and I will run the start script (requires Docker available in PATH and permission to run Docker commands).
