# Contoh panggilan API — Autentikasi

Endpoint: `POST /api/authenticate`

Base URL: `https://sdmsdealer-h23.mpm-motor.com:22000/`

Body (JSON):

```json
{
  "idInternal": "C1002",
  "username": "jajang.sukmana",
  "password": "pelitamotor0202"
}
```

Catatan penting
- Permintaan dari browser (Swagger UI atau fetch) akan diblokir jika server API tidak mengizinkan CORS.
- Postman, curl, dan panggilan dari server-side (Node/PHP) tidak dibatasi oleh CORS — itulah mengapa Postman berhasil.

1) cURL (direkomendasikan untuk tes cepat)

```bash
curl -X POST "https://sdmsdealer-h23.mpm-motor.com:22000/api/authenticate" \
  -H "Content-Type: application/json" \
  -d '{"idInternal":"C1002","username":"jajang.sukmana","password":"pelitamotor0202"}'
```

Response (contoh):

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Gunakan token untuk request selanjutnya:

```bash
curl -H "Authorization: Bearer <token>" https://sdmsdealer-h23.mpm-motor.com:22000/api/some-endpoint
```

2) Node.js (server-side) — axios

```js
const axios = require('axios');

async function authenticate() {
  const res = await axios.post('https://sdmsdealer-h23.mpm-motor.com:22000/api/authenticate', {
    idInternal: 'C1002',
    username: 'jajang.sukmana',
    password: 'pelitamotor0202'
  });
  console.log(res.data);
}

authenticate().catch(console.error);
```

3) PHP (Guzzle)

```php
use GuzzleHttp\Client;

$client = new Client();
$res = $client->post('https://sdmsdealer-h23.mpm-motor.com:22000/api/authenticate', [
    'json' => [
        'idInternal' => 'C1002',
        'username' => 'jajang.sukmana',
        'password' => 'pelitamotor0202',
    ],
    'http_errors' => false,
]);

$body = json_decode($res->getBody(), true);
print_r($body);
```

4) Browser (fetch) — hanya jika API mengizinkan CORS

```js
fetch('https://sdmsdealer-h23.mpm-motor.com:22000/api/authenticate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idInternal: 'C1002', username: 'jajang.sukmana', password: 'pelitamotor0202' }),
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

5) Opsi ketika Anda tidak bisa mengubah CORS di API eksternal: buat proxy di aplikasi ini

Tambahkan route kecil di aplikasi Laravel Anda (mis. `routes/web.php` atau `routes/api.php`) yang meneruskan permintaan ke API eksternal. Contoh:

```php
use Illuminate\Http\Request;
use GuzzleHttp\Client;

Route::post('/api-docs/proxy/authenticate', function (Request $request) {
    $client = new Client();
    $resp = $client->post('https://sdmsdealer-h23.mpm-motor.com:22000/api/authenticate', [
        'json' => $request->all(),
        'http_errors' => false,
    ]);
    return response($resp->getBody(), $resp->getStatusCode())
        ->header('Content-Type', $resp->getHeaderLine('Content-Type'));
});
```

Setelah menambahkan proxy ini, Anda dapat mengubah URL Swagger UI `openapi.yaml` atau panggilan fetch agar mengarah ke `/api-docs/proxy/authenticate` di origin `http://localhost:8000`, sehingga browser tidak lagi dibatasi CORS.

Catatan keamanan: proxy meneruskan kredensial — pastikan route ini hanya tersedia di lingkungan pengembangan atau dilindungi dengan autentikasi jika dipublikasikan.

Jika ingin, saya bisa menambahkan route proxy ini langsung ke repo dan memperbarui `openapi.yaml` agar Swagger UI menggunakan proxy saat dijalankan secara lokal.

---

# PKB — GET /api/reception/Pkb

Endpoint: `GET /api/reception/Pkb`

Base URL: `https://sdmsdealer-h23.mpm-motor.com:22000/`

Headers (required):
- `Authorization: Bearer <token>` — token yang didapat dari `POST /api/authenticate`
- `username: {{username}}` — username pemanggil
- `idInternal: {{idInternal}}` — ID internal tenant/instansi

Contoh cURL:

```bash
curl -X GET "https://sdmsdealer-h23.mpm-motor.com:22000/api/reception/Pkb" \
  -H "Authorization: Bearer <token>" \
  -H "username: jajang.sukmana" \
  -H "idInternal: C1002"
```

Contoh Node (axios):

```js
const axios = require('axios');

async function getPkb() {
  const res = await axios.get('https://sdmsdealer-h23.mpm-motor.com:22000/api/reception/Pkb', {
    headers: {
      Authorization: 'Bearer <token>',
      username: 'jajang.sukmana',
      idInternal: 'C1002',
    },
  });
  console.log(res.data);
}

getPkb().catch(console.error);
```

Jika Anda menggunakan Swagger UI lokal melalui proxy, pastikan header bisa dikirim dari UI (Swagger memungkinkan menambahkan header param via UI) atau gunakan route proxy di aplikasi Laravel untuk menambahkan header server-side.
