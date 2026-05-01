# Contoh panggilan API SDMS

Base URL produksi:

```text
https://sdmsdealer-h23.mpm-motor.com:22000/
```

## 1) Autentikasi

Endpoint:

```text
POST /api/authenticate
```

Body JSON:

```json
{
  "idInternal": "C1002",
  "username": "jajang.sukmana",
  "password": "pelitamotor0202"
}
```

Contoh cURL:

```bash
curl -X POST "https://sdmsdealer-h23.mpm-motor.com:22000/api/authenticate" \
  -H "Content-Type: application/json" \
  -d '{"idInternal":"C1002","username":"jajang.sukmana","password":"pelitamotor0202"}'
```

## 2) List PKB

Endpoint:

```text
GET /api/reception/Pkb
```

Headers wajib:

```text
Authorization: Bearer <token>
username: jajang.sukmana
idInternal: C1002
```

Contoh cURL:

```bash
curl -X GET "https://sdmsdealer-h23.mpm-motor.com:22000/api/reception/Pkb" \
  -H "Authorization: Bearer <token>" \
  -H "username: jajang.sukmana" \
  -H "idInternal: C1002"
```

## 3) List DeliveryOrder

Endpoint:

```text
GET /api/part/DeliveryOrder
```

Headers wajib:

```text
Authorization: Bearer <token>
username: jajang.sukmana
idInternal: C1002
```

Contoh cURL:

```bash
curl -X GET "https://sdmsdealer-h23.mpm-motor.com:22000/api/part/DeliveryOrder" \
  -H "Authorization: Bearer <token>" \
  -H "username: jajang.sukmana" \
  -H "idInternal: C1002"
```

## 4) Detail item DeliveryOrder

Endpoint:

```text
GET /api/part/orderitemdo?fill=<idBilling>
```

Contoh cURL:

```bash
curl -X GET "https://sdmsdealer-h23.mpm-motor.com:22000/api/part/orderitemdo?fill=123456" \
  -H "Authorization: Bearer <token>" \
  -H "username: jajang.sukmana" \
  -H "idInternal: C1002"
```

## 5) Pakai proxy lokal agar tidak kena CORS

### Laravel proxy

Buka Swagger UI lewat Laravel:

```text
http://localhost:8000/api-docs/index.html
```

Pilih server `http://localhost:8000/` di Swagger UI. Route proxy yang tersedia:

- `/api/authenticate`
- `/api/reception/Pkb`
- `/api/part/DeliveryOrder`
- `/api/part/orderitemdo`

### Node proxy

```bash
cd scripts/node/proxy
npm install
npm start
```

Lalu pilih server `http://localhost:3000/` di Swagger UI.

## 6) Contoh server-side Node.js

```js
const axios = require('axios');

async function getDeliveryOrders() {
  const res = await axios.get('https://sdmsdealer-h23.mpm-motor.com:22000/api/part/DeliveryOrder', {
    headers: {
      Authorization: 'Bearer <token>',
      username: 'jajang.sukmana',
      idInternal: 'C1002',
    },
  });

  console.log(res.data);
}

getDeliveryOrders().catch(console.error);
```
