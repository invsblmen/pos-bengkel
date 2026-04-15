# Checklist Implementasi Sinkronisasi GO -> Laravel

Tanggal acuan: 2026-04-14

Checklist ini dipakai untuk implementasi production-grade alur sinkronisasi data satu arah dari GO ke Laravel.

## 1. Kontrak API

- [ ] Konfirmasi endpoint Laravel aktif: `POST /api/sync/batches`, `GET /api/sync/status`.
- [ ] Gunakan envelope payload V1 sesuai `SYNC_API_CONTRACT_V1.md`.
- [ ] Tetapkan `schema_version` pada batch dan item sebelum ekspansi V2.

## 2. Keamanan

- [ ] Aktifkan token sinkronisasi (`GO_SYNC_ENABLED=true`).
- [ ] Set token kuat di `GO_SYNC_SHARED_TOKEN`.
- [ ] Kirim header `X-Sync-Token` di semua request producer GO.
- [ ] Rotasi token terjadwal dan dokumentasikan prosedurnya.

## 3. Idempotency

- [ ] Set `sync_batch_id` sebagai UUID global unik.
- [ ] Pastikan retry dengan `sync_batch_id` sama tidak membuat double-write.
- [ ] Simpan `payload_hash` untuk verifikasi konsistensi payload.

## 4. Reliabilitas Producer (GO)

- [ ] Terapkan exponential backoff untuk retry.
- [ ] Simpan batch gagal untuk replay manual.
- [ ] Aktifkan endpoint retry/replay terkontrol.

## 5. Validasi Consumer (Laravel)

- [ ] Validasi struktur envelope dan item.
- [ ] Untuk error business-rule gunakan respons validasi terstruktur (422).
- [ ] Bedakan error validasi, duplicate, dan internal error.

## 6. Observability

- [ ] Simpan status batch: `pending`, `retrying`, `failed`, `sent`, `acknowledged`, `duplicate`.
- [ ] Tambahkan correlation/request id di log.
- [ ] Pastikan ada dashboard/halaman monitoring sinkronisasi.

## 7. Operasional

- [ ] Atur timeout `run/retry/alert/reconciliation` sesuai kapasitas environment.
- [ ] Aktifkan schedule harian hanya setelah dry-run lolos.
- [ ] Aktifkan retention purge dengan kebijakan hari yang disepakati.

## 8. Uji Coba Wajib

- [ ] Happy path: batch valid diterima Laravel.
- [ ] Duplicate path: batch yang sama dikirim ulang.
- [ ] Validation path: payload invalid mengembalikan 422.
- [ ] Failure path: simulasi timeout dan retry berhasil.
- [ ] Recovery path: replay batch failed berhasil acknowledged.

## 9. Kriteria Go-Live

- [ ] Tidak ada dependency runtime Laravel Inertia ke GO untuk rendering halaman.
- [ ] Seluruh sinkronisasi lintas stack hanya melalui API contract.
- [ ] Alerting dan prosedur incident response sudah diuji.
