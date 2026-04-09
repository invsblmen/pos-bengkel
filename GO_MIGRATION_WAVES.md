# Endpoint Waves untuk Migrasi Laravel ke Go

Dokumen ini menurunkan blueprint menjadi daftar endpoint aktual per gelombang migrasi berdasarkan route aktif di dashboard.

## Prinsip Penentuan Wave

- Wave 1: read-heavy atau side-effect rendah.
- Wave 2: domain menengah dengan aturan bisnis moderat.
- Wave 3: transaksi stok dan pembelian.
- Wave 4: transaksi penjualan dan cash settlement.
- Wave 5: service order inti, reporting kompleks, auth/permission unification.

## Wave 1 (Low Risk, Quick Win)

Tujuan: validasi pola migrasi tanpa menyentuh transaksi inti.

Endpoint kandidat:

1. GET /dashboard/whatsapp/health/check
2. POST /webhooks/whatsapp
3. GET /dashboard/vehicles/{vehicle}/maintenance-insights
4. GET /dashboard/vehicles/{vehicle}/service-history
5. GET /dashboard/vehicles/{vehicle}/recommendations
6. GET /dashboard/vehicles/{vehicle}/maintenance-schedule
8. GET /dashboard/appointments/calendar
9. GET /dashboard/appointments/slots
10. POST /dashboard/appointments
11. PATCH /dashboard/appointments/{id}/status
12. DELETE /dashboard/appointments/{id}
13. GET /dashboard/reports/part-sales-profit
14. GET /dashboard/reports/part-sales-profit/by-supplier

Alasan:

- Mayoritas read endpoint atau adaptor webhook.
- Risiko dampak finansial relatif rendah.
- Cepat untuk membangun baseline observability + contract tests.

Exit criteria:

- p95 dan error rate setara/lebih baik dari baseline Laravel selama 7 hari.
- Shadow compare menunjukkan mismatch response < 1% (dengan whitelist field dinamis).

## Wave 2 (Medium Risk)

Tujuan: memindahkan domain operasional harian non-keuangan berat.

Endpoint kandidat:

1. GET /dashboard/appointments
2. GET /dashboard/appointments/calendar
3. GET /dashboard/appointments/slots
4. POST /dashboard/appointments
5. GET /dashboard/appointments/{id}/edit
6. PUT /dashboard/appointments/{id}
7. PATCH /dashboard/appointments/{id}/status
8. DELETE /dashboard/appointments/{id}
9. GET /dashboard/appointments/{id}/export
10. GET /dashboard/vehicles
11. GET /dashboard/vehicles/{vehicle}

Catatan:

- Fitur export dan status update wajib idempotent jika dipanggil ulang.
- Integrasi notifikasi appointment dipisah dulu melalui event bridge.

## Wave 3 (Medium-High Risk)

Tujuan: memindahkan inventori masuk/keluar dan pembelian.

Endpoint kandidat:

1. GET /dashboard/parts/low-stock
2. GET /dashboard/part-stock-history
3. GET /dashboard/part-stock-history/export
4. POST /dashboard/parts/stock/in
5. POST /dashboard/parts/stock/out
6. GET /dashboard/part-purchases
7. POST /dashboard/part-purchases
8. PUT /dashboard/part-purchases/{id}
9. POST /dashboard/part-purchases/{id}/update-status

Kontrol tambahan:

- DB transaction boundary eksplisit.
- Rekonsiliasi stok harian Laravel vs Go.

## Wave 4 (High Risk)

Tujuan: memindahkan domain penjualan sparepart dan settlement terkait.

Endpoint kandidat:

1. GET /dashboard/part-sales
2. POST /dashboard/part-sales
3. PUT /dashboard/part-sales/{partSale}
4. POST /dashboard/part-sales/{partSale}/update-payment
5. POST /dashboard/part-sales/{partSale}/update-status
6. POST /dashboard/part-sales/{partSale}/details/{detail}/claim-warranty
7. POST /dashboard/part-sales/create-from-order
8. POST /dashboard/cash-management/sale/settle
9. POST /dashboard/cash-management/change/suggest

Kontrol tambahan:

- Idempotency key wajib pada endpoint create/payment.
- Outbox pattern untuk event pasca-commit.

## Wave 5 (Very High Risk / Last)

Tujuan: memindahkan domain paling inti dan kompleks.

Endpoint kandidat:

1. Seluruh endpoint service-orders
2. Endpoint cash-management lain (stock/transactions)
3. Endpoint report agregasi lintas domain: GET /dashboard/reports/overall
4. Endpoint report agregasi lintas domain: GET /dashboard/reports/service-revenue
5. Endpoint report agregasi lintas domain: GET /dashboard/reports/mechanic-productivity
6. Endpoint report agregasi lintas domain: GET /dashboard/reports/mechanic-payroll
7. Endpoint report agregasi lintas domain: GET /dashboard/reports/parts-inventory
8. Endpoint report agregasi lintas domain: GET /dashboard/reports/outstanding-payments
9. Endpoint report agregasi lintas domain: GET /dashboard/reports/export
10. Role/permission unification dan auth bridge final

Kontrol tambahan:

- Freeze schema changes saat cutover.
- Rollback plan teruji (dry run minimal 2x).

## Endpoint yang Tetap di Laravel (sementara)

1. UI-driven profile/account endpoint.
2. Endpoint admin role/permission hingga policy service siap.
3. Endpoint yang sangat terikat dengan Inertia response sampai BFF strategy diputuskan.

## Template Mapping Laravel ke Go per Endpoint

- Route name:
- HTTP + path:
- Controller lama:
- Handler Go baru:
- Use case:
- Data source table:
- Permission rule:
- Side effects (event/queue/notif):
- Test kontrak:
- Canary start date:
- Cutover date:
- Rollback trigger:
