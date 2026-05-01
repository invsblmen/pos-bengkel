# Node examples — authenticate

Usage (Node 18+):

```bash
node scripts/node/authenticate.js
```

Set custom values via environment variables:

Linux / macOS:

```bash
BASE_URL='https://sdmsdealer-h23.mpm-motor.com:22000' ID_INTERNAL='C1002' USERNAME='jajang.sukmana' PASSWORD='pelitamotor0202' node scripts/node/authenticate.js
```

Windows (PowerShell):

```powershell
$env:BASE_URL = 'https://sdmsdealer-h23.mpm-motor.com:22000'
$env:ID_INTERNAL = 'C1002'
$env:USERNAME = 'jajang.sukmana'
$env:PASSWORD = 'pelitamotor0202'
node scripts/node/authenticate.js
```

Notes:
- The script uses the global `fetch` if available (Node 18+). If your Node is older, install `node-fetch`:

```bash
npm install node-fetch
```

- This runs server-side, so it is not affected by browser CORS restrictions.
