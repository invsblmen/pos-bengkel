# Blueprint Migrasi Backend Laravel ke Go (8-12 Minggu)

Dokumen ini adalah rencana praktis untuk migrasi bertahap backend POS Bengkel dari Laravel ke Go tanpa big-bang rewrite.

## 1. Kondisi Saat Ini (Baseline)

Berdasarkan inventaris project saat ini:

- Controller: 46
- Model: 38
- Migration: 84
- Feature test: 16
- Unit test: 1
- Domain penting yang aktif: service order, appointment, part sales, part purchase, stock movement, reports, cash management, role/permission, notifikasi realtime, integrasi WhatsApp Go.

Implikasi:

- Migrasi total dalam satu kali cutover berisiko tinggi (regresi bisnis dan downtime).
- Pendekatan yang disarankan adalah strangler pattern: Laravel tetap jadi sistem utama, layanan Go menggantikan domain satu per satu.

## 2. Target Arsitektur Go

## 2.1 Prinsip Umum

- Modul bertahap, bukan full rewrite langsung.
- Kontrak API eksplisit (OpenAPI) untuk tiap domain yang dipindahkan.
- Database tetap satu sumber kebenaran pada fase awal (schema lama dipakai bersama).
- Observability wajib sejak awal: structured logging, metrics, tracing.

## 2.2 Rekomendasi Stack Go

- HTTP framework: Gin atau Echo.
- Database access: sqlc (disarankan untuk query-critical) atau GORM (cepat untuk bootstrap).
- Migration tool: golang-migrate.
- Validation: go-playground/validator.
- Auth: JWT/OAuth2 atau session bridge (transisi dari Laravel auth).
- Queue/event: Redis + worker Go (atau Kafka/NATS jika skala naik).
- Realtime: bridge ke Reverb sementara, lalu evaluasi migrasi ke WebSocket hub Go bila perlu.

## 2.3 Struktur Service (contoh)

- cmd/api
- internal/domain
- internal/usecase
- internal/repository
- internal/http
- internal/worker
- pkg/observability
- migrations
- docs/openapi

## 3. Peta Prioritas Domain

Urutan migrasi disarankan dari risiko rendah ke tinggi:

1. Domain pendukung: katalog master data terbatas, health endpoint, webhook adaptor.
2. Domain menengah: appointment, vehicle insights, notifikasi terkontrol.
3. Domain inti transaksi: part stock movement, part purchases/sales.
4. Domain paling kritikal: service order end-to-end, cash settlement, reporting agregat.
5. Domain keamanan lintas sistem: auth + role/permission final unification.

Catatan: integrasi WhatsApp Go sudah ada, jadi cocok dijadikan pola referensi service eksternal pertama.

## 4. Rencana Eksekusi 8-12 Minggu

## Fase 0 (Minggu 1): Discovery dan Guardrail

Tujuan:

- Menetapkan ruang lingkup domain gelombang 1.
- Mencegah regressi saat migrasi.

Deliverable:

- Daftar endpoint prioritas + owner domain.
- Contract test baseline untuk endpoint Laravel yang akan dimigrasi.
- Performance baseline: p95 latency, error rate, throughput.
- Definisi SLO awal (misal availability 99.5% untuk API internal).

## Fase 1 (Minggu 2-3): Platform Go Foundation

Tujuan:

- Menyiapkan fondasi service Go production-ready.

Deliverable:

- Service skeleton Go (health, readiness, liveness).
- Logging terstruktur (request_id, user_id, tenant/workshop_id bila ada).
- Metrics + tracing (Prometheus/OpenTelemetry).
- CI pipeline: lint, test, build, security scan dasar.
- OpenAPI docs + codegen client jika dibutuhkan.

## Fase 2 (Minggu 4-5): Pilot Domain (Low Risk)

Tujuan:

- Migrasi domain kecil untuk validasi pola.

Kandidat domain:

- Endpoint webhook adaptor / utilitas non-transaksional.
- Satu modul master data sederhana.

Strategi rollout:

- Shadow mode: request tetap diproses Laravel, Go menerima mirror traffic.
- Diff response otomatis untuk validasi perilaku.
- Canary 5%-20%-50%-100%.

Deliverable:

- 1 domain live di Go.
- Dashboard observability dan runbook incident.

## Fase 3 (Minggu 6-8): Domain Menengah

Tujuan:

- Migrasi domain dengan aturan bisnis menengah.

Kandidat domain:

- Appointment dan kalender slot.
- Vehicle maintenance insight read-model.
- Notifikasi terpilih yang tidak mengubah transaksi keuangan.

Deliverable:

- 2-3 domain menengah live di Go.
- Contract tests hijau untuk seluruh endpoint domain tersebut.
- Retry/idempotency policy terdokumentasi.

## Fase 4 (Minggu 9-10): Domain Transaksional

Tujuan:

- Migrasi transaksi inventori/penjualan bertahap.

Kandidat domain:

- Part stock movement.
- Part purchase (tanpa langsung memindah semua report).
- Part sales dengan fokus idempotency pembayaran.

Kontrol wajib:

- Idempotency key untuk endpoint create/update kritikal.
- Outbox pattern untuk event pasca-commit.
- Rekonsiliasi harian (data Laravel vs Go).

Deliverable:

- Domain transaksi pertama live dengan error budget terkontrol.
- Tool rekonsiliasi data otomatis.

## Fase 5 (Minggu 11-12): Core Domain dan Cutover Parsial

Tujuan:

- Mulai migrasi service order dan cash settlement secara terkendali.

Aktivitas:

- Split per use case (create order, update status, pembayaran) bukan langsung full modul.
- Freeze perubahan skema besar selama jendela cutover.
- Incident drill dan rollback simulation.

Deliverable:

- Cutover parsial domain inti dengan fallback yang sudah teruji.
- Post-cutover review + backlog hardening.

## 5. Strategi Integrasi Laravel dan Go Selama Transisi

## 5.1 API Gateway / Routing

- Pakai reverse proxy (Nginx/Traefik) atau route-level dispatch dari Laravel.
- Aturan route by route: endpoint tertentu diteruskan ke Go, sisanya tetap Laravel.

## 5.2 Auth dan Permission

- Tahap awal: Laravel tetap sumber otorisasi; Go melakukan token introspection/bridge.
- Tahap lanjut: pusatkan authorization policy service atau claims yang konsisten.

## 5.3 Event dan Queue

- Pertahankan event kontrak yang stabil.
- Untuk event penting, gunakan outbox + worker agar tidak kehilangan event.
- Event naming dan payload versioning wajib.

## 5.4 Realtime

- Pertahankan kanal realtime existing dulu agar frontend tidak terganggu.
- Gunakan helper safe dispatch untuk menghindari 500 saat transport bermasalah.

## 6. Risiko Kritis dan Mitigasi

1. Perilaku bisnis berubah diam-diam.
   Mitigasi: contract test + golden dataset + shadow diff.

2. Deadlock/inkonsistensi data transaksi.
   Mitigasi: idempotency, transaksi DB eksplisit, rekonsiliasi harian.

3. Observability kurang saat incident.
   Mitigasi: trace ID end-to-end, dashboard error per endpoint, alert berbasis SLO.

4. Perbedaan model permission.
   Mitigasi: matriks role/permission lintas sistem sebelum cutover.

5. Tim overload karena dual-stack terlalu lama.
   Mitigasi: definisikan sunset date tiap domain Laravel yang selesai dipindah.

## 7. Definisi Siap Produksi per Domain (Go-Live Checklist)

Sebuah domain dianggap selesai jika:

- Semua endpoint domain punya OpenAPI + contract tests.
- Coverage test minimal sesuai target tim (misal >=70% logic usecase).
- p95 latency tidak lebih buruk dari baseline Laravel pada beban setara.
- Error rate stabil di bawah SLO selama minimal 7 hari.
- Runbook rollback tersedia dan sudah diuji.
- Rekonsiliasi data harian tidak menunjukkan selisih material.

## 8. Rencana Tim Minimum

Komposisi minimal (ideal 4-6 orang):

- 1 Tech lead (arsitektur dan quality gate).
- 2 Backend engineer (Go focus).
- 1 Backend engineer (Laravel maintenance + bridge).
- 1 QA/automation.
- 1 DevOps/SRE part-time.

## 9. Keputusan Teknis yang Harus Dipatok di Minggu 1

- Pilih ORM/query strategy: sqlc atau GORM (jangan campur tanpa aturan).
- Tentukan model auth transisi.
- Tentukan event bus/queue strategy.
- Tetapkan SLO dan error budget.
- Tetapkan domain wave-1 dan wave-2.

## 10. Rekomendasi Praktis untuk Project Ini

- Jangan mulai dari service order dulu; mulai dari domain yang read-heavy atau side-effect ringan.
- Jadikan integrasi WhatsApp Go sebagai pola standar komunikasi service eksternal.
- Pertahankan migrasi database terpusat dan disiplin versioning schema.
- Pastikan testing diperkuat lebih dulu karena saat ini rasio test otomatis masih rendah untuk ukuran domain.

## 11. Setup Lokal Database

Untuk development lokal, gunakan MariaDB sebagai database utama.

Rekomendasi praktik:

1. Laravel tetap memakai instance MariaDB yang sama seperti sekarang.
2. Go backend memakai schema terpisah di instance MariaDB lokal yang sama, misalnya `pos_bengkel_go_local`.
3. SQLite boleh dipakai hanya untuk test ringan tertentu, bukan untuk validasi parity domain.
4. Hindari mencampur SQLite untuk flow yang banyak `JOIN`, agregasi, atau filter tanggal karena perilaku query bisa berbeda.

Contoh env lokal:

- `DB_CONNECTION=mysql`
- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_DATABASE=pos_bengkel_local` untuk Laravel
- `DB_DATABASE=pos_bengkel_go_local` untuk Go

Checklist cepat:

- Pastikan MariaDB sudah jalan di port 3306.
- Buat database terpisah untuk Laravel dan Go.
- Jalankan migration masing-masing project ke schema-nya sendiri.
- Gunakan `php artisan config:clear` dan restart service Go setelah ubah env.

Opsi otomatis dari PowerShell:

```powershell
scripts\setup-local-mariadb.ps1 -MysqlUser root -MysqlPassword ''
```

Opsi double-click di Windows:

```bat
scripts\setup-local-mariadb.bat
```

Rekomendasi paling cepat untuk Windows:

1. Double-click `scripts\setup-local-mariadb.bat`.
2. Setelah selesai, jalankan `php artisan config:clear`.
3. Start ulang service Go jika sudah berjalan.

---

Jika dibutuhkan, blueprint ini bisa diturunkan menjadi:

1. Daftar endpoint wave-by-wave yang spesifik ke route saat ini.
2. Template kontrak OpenAPI untuk domain pertama.
3. Task breakdown mingguan siap eksekusi (ticket-level) untuk tim.
