// Simple Node script to call POST /api/authenticate
// Requires Node 18+ (global fetch). If using older Node, run `npm install node-fetch`.
// Usage:
//   node scripts/node/authenticate.js
// or with env vars:
//   BASE_URL='https://...' ID_INTERNAL='C1002' USERNAME='user' PASSWORD='pass' node scripts/node/authenticate.js

async function getFetch() {
  if (typeof global.fetch === 'function') return global.fetch;
  try {
    const mod = await import('node-fetch');
    return mod.default;
  } catch (err) {
    console.error('node-fetch not installed and global fetch not available. Install node-fetch or use Node 18+.');
    process.exit(1);
  }
}

const BASE = process.env.BASE_URL || 'https://sdmsdealer-h23.mpm-motor.com:22000';
const URL = `${BASE.replace(/\/$/, '')}/api/authenticate`;

const payload = {
  idInternal: process.env.ID_INTERNAL || 'C1002',
  username: process.env.USERNAME || 'jajang.sukmana',
  password: process.env.PASSWORD || 'pelitamotor0202',
};

async function main() {
  const fetchImpl = await getFetch();
  try {
    const res = await fetchImpl(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    console.log('Request URL:', URL);
    console.log('Status:', res.status);
    console.log('Response:');
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));

    if (res.ok && data && data.access_token) {
      console.log('\nUse this token for subsequent requests:');
      console.log(`Authorization: Bearer ${data.access_token}`);
    }
  } catch (err) {
    console.error('Request failed:', err.message || err);
  }
}

main();
