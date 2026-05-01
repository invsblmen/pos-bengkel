# SDMS Dealer — Local proxy (development)

This is a simple Express proxy to bypass browser CORS during development. It forwards requests from `/api/*` to the target API.

Install dependencies and run:

```bash
cd scripts/node/proxy
npm install
npm start
```

Environment variables:

- `TARGET_URL` — URL of the real API (default: `https://sdmsdealer-h23.mpm-motor.com:22000`)
- `PORT` — local port to listen on (default: `3000`)

Example (Linux/macOS):

```bash
TARGET_URL='https://sdmsdealer-h23.mpm-motor.com:22000' PORT=3000 npm start
```

Windows (PowerShell):

```powershell
$env:TARGET_URL = 'https://sdmsdealer-h23.mpm-motor.com:22000'
$env:PORT = '3000'
npm start
```

How to use with Swagger UI:

1. Run the proxy as above.
2. Open `http://localhost:8000/api-docs/index.html`.
3. In the server selector (top of Swagger UI), choose `http://localhost:3000/` (Local proxy).
4. Use "Try it out" — calls will be proxied to the real API and avoid CORS issues.

Security note: This proxy is for local development only. Do NOT expose it publicly or use it in production.
