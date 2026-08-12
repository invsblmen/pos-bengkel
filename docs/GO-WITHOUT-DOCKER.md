# Running go-whatsapp-web-multidevice without Docker

This document describes how to build and run `go-whatsapp-web-multidevice` locally without Docker.

Prerequisites

- Go 1.24 or newer (https://go.dev/dl/)
- FFmpeg (for media processing)
- libwebp tools (`cwebp`, `dwebp`, `webpmux`) recommended for sticker support

Windows: WSL is recommended but PowerShell scripts are provided.

Quick start (Unix)

```bash
# from repository root
# run directly (uses 'go run')
./scripts/run-go-whatsapp.sh

# build once
./scripts/run-go-whatsapp.sh build
# run built binary
cd go-whatsapp-web-multidevice/src && ./whatsapp rest
```

Quick start (Windows PowerShell)

```powershell
# from repository root
# run via PS helper (will use 'go run' if no binary)
.
\scripts\run-go-whatsapp.ps1

# build
.
\scripts\run-go-whatsapp.ps1 build

# run built exe
cd go-whatsapp-web-multidevice/src
.\whatsapp.exe rest
```

Notes

- The default REST UI listens on port `3000`. Open `http://localhost:3000`.
- To customize flags (port, basic-auth, webhook, etc.) pass them after the command, for example:

```bash
./scripts/run-go-whatsapp.sh --port 8080 --basic-auth=admin:admin
```

- If you prefer, download a prebuilt binary from the project's Releases page instead of building locally.

Security

- When exposing to a network, secure the service (use `--basic-auth` or run behind a reverse proxy with TLS).

Troubleshooting

- If you see media/sticker errors, ensure `ffmpeg` and `webp` tools are installed and available on PATH.
- On Windows, using WSL2 usually provides a smoother environment for Go and native tools.

For more options and flags, see `go-whatsapp-web-multidevice/src --help` or the project's README in `go-whatsapp-web-multidevice/readme.md`.
