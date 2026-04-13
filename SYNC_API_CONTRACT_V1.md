# Sync API Contract V1 (Go Producer -> Laravel Consumer)

Dokumen ini mendefinisikan kontrak sinkronisasi antar aplikasi yang berjalan terpisah:

- Go lokal bengkel sebagai producer,
- Laravel hosting sebagai consumer monitoring.

## Kunci Arsitektur

- Flow utama satu arah: Go -> Laravel.
- Operasi transaksi utama terjadi di Go lokal.
- Laravel menerima data sinkron untuk monitoring/reporting.

## Endpoint Aktif Saat Ini

### 1) Laravel Consumer API

Base path: `/api/sync`

- `POST /api/sync/batches`
- `GET /api/sync/status`

Implementasi saat ini:

- [routes/api.php](routes/api.php)
- [app/Http/Controllers/Apps/SyncController.php](app/Http/Controllers/Apps/SyncController.php)

### 2) Go Producer API (operational tooling)

Base path: `/api/v1/sync`

- `GET /api/v1/sync/status`
- `GET /api/v1/sync/batches`
- `POST /api/v1/sync/batches`
- `POST /api/v1/sync/run`
- `POST /api/v1/sync/batches/{id}/send`
- `POST /api/v1/sync/batches/{id}/retry`

Implementasi saat ini:

- [go-backend/internal/httpserver/server.go](go-backend/internal/httpserver/server.go)
- [go-backend/internal/httpserver/sync.go](go-backend/internal/httpserver/sync.go)

## Authentication Header

Setiap request Go -> Laravel wajib menyertakan:

- `X-Sync-Token: <shared-token>`

Token diverifikasi di Laravel melalui config:

- `GO_SYNC_ENABLED`
- `GO_SYNC_SHARED_TOKEN`

## Envelope Request V1 (POST /api/sync/batches)

```json
{
  "sync_batch_id": "uuid-v4",
  "source_workshop_id": "local-workshop",
  "scope": "daily",
  "payload_type": "table_rows",
  "source_date": "2026-04-14",
  "payload_hash": "sha256-hex",
  "items": [
    {
      "entity_type": "service_orders",
      "entity_id": "123",
      "event_type": "upsert",
      "payload": {
        "id": 123,
        "order_number": "SO-ABC12345"
      },
      "payload_hash": "sha256-hex"
    }
  ]
}
```

## Response V1 (Success)

```json
{
  "sync_batch_id": "uuid-v4",
  "status": "acknowledged",
  "received_items": 10,
  "duplicate_items": 0,
  "invalid_items": 0,
  "acknowledged_at": "2026-04-14T12:00:00+00:00"
}
```

## Status Semantics

Batch status yang digunakan lintas sistem:

- `pending`
- `retrying`
- `failed`
- `sent`
- `acknowledged`
- `duplicate`

## Idempotency Rules V1

1. `sync_batch_id` harus global unique (UUID).
2. Laravel treat request dengan `sync_batch_id` sama sebagai duplicate.
3. Go boleh retry request batch yang sama tanpa risiko double-write.
4. `payload_hash` dipakai sebagai checksum konsistensi payload.

## Error Contract V1

### 422 Validation Error

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "sync": ["Token sinkron tidak valid."]
  }
}
```

### 500 Internal Error

```json
{
  "message": "Failed to process sync batch"
}
```

## Retry Policy V1

- Producer melakukan retry bertahap (exponential backoff).
- Batch gagal tetap disimpan untuk observability dan replay.
- Manual replay dilakukan via endpoint Go `/api/v1/sync/batches/{id}/retry`.

## Versioning Strategy

- V1 dianggap stable baseline.
- Perubahan breaking ke payload harus membuat V2 (`/api/sync/v2/...`) atau minimal `schema_version` baru.
- Untuk V1 non-breaking, field baru boleh ditambahkan sebagai optional field.

## Field Notes

- `entity_type` disarankan mereferensikan nama domain/table canonical.
- `event_type` awalnya gunakan `upsert`/`delete`; ekspansi event granular dilakukan di versi berikutnya.
- `source_workshop_id` wajib untuk skenario multi-branch.

## Next Increment Setelah V1

1. Tambah `schema_version` di batch dan item envelope.
2. Tambah `event_id` per item untuk idempotency level item.
3. Tambah signed payload (`signature`) untuk hardening integritas.
4. Tambah endpoint reconciliation snapshot hash per entitas.
