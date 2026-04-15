# Backend Coupling Audit (Routes/Controllers)

Tanggal audit: 2026-04-14
Scope: `routes/*.php`, `app/Http/Controllers/**/*.php`

## Ringkasan

1. Coupling realtime frontend Laravel Inertia ke GO sudah bersih.
2. Kontrak sinkronisasi GO -> Laravel API sudah ada dan sesuai arah target.
3. Masih ada jejak bridge GO pada beberapa controller/backend path yang perlu diputus bertahap agar boundary benar-benar ketat.

## Temuan Prioritas Tinggi

1. Dead code bridge ke GO masih ada di controller web/report:
   - `app/Http/Controllers/Reports/PartSalesProfitReportController.php`
     - `reportIndexViaGo()`
     - `reportBySupplierViaGo()`
   - `app/Http/Controllers/Apps/VehicleController.php`
     - `withHistoryViaGo()`
   - `app/Http/Controllers/Apps/RecommendationController.php`
     - `recommendationsViaGo()`
     - `maintenanceScheduleViaGo()`

Dampak:
- Menambah jejak coupling yang tidak diperlukan.
- Berisiko diaktifkan kembali tanpa sengaja saat refactor.

Rekomendasi:
- Hapus metode bridge yang tidak dipanggil.
- Hapus import terkait HTTP client yang jadi tidak terpakai setelah penghapusan.

## Temuan Prioritas Menengah

1. `routes/console.php` pernah memiliki blok operasional rollout migrasi pada fase migrasi.

Dampak:
- Bukan coupling Inertia runtime, tetapi masih membawa artefak migrasi GO yang bukan alur sinkronisasi inti.

Rekomendasi:
- Karena strategi final sudah sync API saja, command rollout lama layak didekomisioning.

## Temuan Sesuai Arah (Tetap Dipertahankan)

1. Endpoint sinkronisasi consumer Laravel:
   - `routes/api.php` -> `POST /api/sync/batches`, `GET /api/sync/status`
2. `app/Http/Controllers/Apps/SyncController.php` sebagai pintu sinkronisasi valid.
3. `config/go_backend.php` bagian `sync` valid untuk kebutuhan API sync.

## Checklist Remediasi Teknis

- [ ] Hapus semua metode `*ViaGo` yang tidak digunakan di controller web.
- [ ] Bersihkan `use Illuminate\Support\Facades\Http;` dan import lain yang orphan.
- [ ] Audit ulang `routes/console.php` untuk memastikan rollout lama tetap nonaktif dan terdokumentasi sebagai arsip.
- [ ] Jalankan pengecekan error/lint setelah cleanup.

## Status Audit

Status saat dokumen dibuat: ACTION REQUIRED (residual coupling backend non-sync masih ada, namun tidak lagi di layer frontend Inertia realtime).
