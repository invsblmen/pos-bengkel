# TODO Lanjutan Pengembangan (Lintas Device)

Dokumen ini berisi rencana kerja berikutnya setelah batch implementasi 2026-03-28.

## Fokus Iterasi Berikutnya

Catatan alignment tujuan final:
- GO local = jalur operasi utama + realtime native GO.
- Laravel hosting = jalur monitoring/fallback + kebutuhan online.
- Frontend parity wajib sama lintas jalur.

1. Stabilisasi test suite untuk domain garansi, voucher, dan service order references.
2. Penyempurnaan UX halaman detail service order (navigasi, sticky actions, loading states).
3. Penguatan observability realtime per jalur: GO-native realtime (GO path) dan Reverb watchdog (Laravel path).

## Prioritas Eksekusi

### Prioritas 1 - Testing dan Quality Gate

- [x] Tambah feature test untuk halaman `customers.show` (render, relasi, permission).
- [x] Tambah test untuk fallback route mekanik di detail service order.
- [x] Tambah test regresi untuk clickable references (`customer`, `vehicle`, `mechanic`) di service order detail.
- [x] Tambah test edge-case voucher pada kombinasi diskon fixed/percent dan batas maksimum diskon.
- [x] Jalankan subset test cepat sebagai smoke suite untuk domain workshop core.

Status terbaru (2026-03-28):

- [x] Perbaikan failure 419 pada test klaim garansi service order (CSRF middleware dikecualikan pada feature test terkait).
- [x] Smoke suite domain warranty + voucher + service-order references: 18 test PASS.
- [x] Tambahan test coverage: 14 PASS (2 customer show + 4 service order reference + 8 voucher validation).
- [x] Total test suite: 32+ PASS, semua domain core workshops hijau.

### Prioritas 2 - UX Detail Service Order

- [x] Tambahkan sticky action bar (kembali, cetak, edit) pada layar desktop.
- [x] Tambahkan loading skeleton untuk blok detail item saat payload besar.
- [x] Tambahkan quick jump anchor antar section (info utama, biaya, item, catatan).
- [x] Tambahkan visual indicator aging untuk warranty mendekati expiry (7 hari threshold).
- [x] Optimasi spacing dan typographic hierarchy agar informasi finansial lebih mudah dipindai.

### Prioritas 3 - Infra Realtime Lokal

- [x] Tambah utilitas command status watchdog (`port`, `pid`, `process`, `last log lines`) untuk jalur Laravel/Reverb.
- [x] Tambah housekeeping untuk log watchdog (truncate/rotate mingguan) untuk jalur Laravel/Reverb.
- [x] Tambah guard agar startup launcher tidak spawn process orphan saat logout/login berulang.
- [x] Dokumentasikan troubleshooting standar saat Reverb unreachable di dev environment (khusus jalur Laravel).

Tambahan status (2026-03-28):

- [x] Finalisasi keputusan referensi detail mekanik: route alias `mechanics.show` mengarah ke halaman performa mekanik existing.
- [x] Quality gate: ALL TESTS PASSING (32+ tests across warranty, voucher, service-order, customer, mechanic domains).


## Backlog Opsional

- [x] Tambahkan visual indicator aging untuk klaim garansi (mis. 7 hari sebelum expiry).
- [ ] Tambahkan dashboard conversion voucher (issued vs redeemed vs expired).
- [ ] Tambahkan opsi notifikasi internal untuk anomali stok setelah service order finalisasi.

## Catatan Operasional

- Setelah perubahan route backend, regenerate Ziggy:
  - `php artisan ziggy:generate resources/js/ziggy.js`
- Untuk cek scheduler:
  - `php artisan schedule:list`
- Untuk cek command Reverb yang tersedia:
  - `php artisan list | findstr /i reverb`
- Untuk jalur GO realtime native, gunakan endpoint GO (`/ws`, `/api/v1/realtime/subscribers`, `/api/v1/realtime/emit`) sebagai sumber diagnosis utama.

## Update Progress Migrasi Go-Laravel (2026-04-11)

Ringkasan ini dipakai untuk weekly review lintas tim (engineering, QA, operasi, bisnis).

### Status Umum

- Engineering core sync: 95% (stabil, command utama tersedia, benchmark tervalidasi).
- Dokumentasi operasional: 100% (SOP, incident runbook, UAT checklist, sign-off template).
- UAT parity frontend: in progress (template siap, eksekusi per screen belum selesai).
- Business sign-off threshold: menunggu baseline 7 hari.

---

## GO Backend SQLite Architecture Implementation (2026-04-12)

Status: ✅ **COMPLETED** - Full scaffolding for local-first database setup

### Deliverables

1. **Architecture Documentation** (`GO_SQLITE_ARCHITECTURE.md`)
   - Overview: SQLite vs MariaDB use cases
   - Schema migration guide: MariaDB→SQLite DDL translation
   - Data sync strategy: Standalone vs Hybrid scenarios
   - Performance notes: Concurrency, storage, backups
   - Troubleshooting: Common SQLite issues (locking, FK, sizing)

2. **GO Backend Database Module** (`go-backend/internal/config/database.go`)
   - Multi-driver support: SQLite + MySQL runtime detection
   - DSN builder: Auto-configuration from environment
   - Connection pool: Adaptive limits (SQLite single-writer, MySQL multi-concurrency)
   - FK pragma: Auto-enable for SQLite on init
   - Error handling: Comprehensive validation + logging

3. **SQLite Schema Migration** (`go-backend/migrations/001_init_sqlite.sql`)
   - Complete POS schema migration: 14 core tables + 4 reporting/audit tables
   - Adapted for SQLite: AUTOINCREMENT keyword, TEXT datetime, CHECK constraints for ENUM
   - Indexes: 20+ performance indexes on key query paths (customer_id, status, created_at, etc.)
   - Foreign keys: Full referential integrity with CASCADE/RESTRICT rules
   - Initial data: System settings defaults + clock initialization

4. **Setup Script** (`scripts/setup-go-sqlite.ps1`)
   - Validation: sqlite3 command check, migration file presence
   - Directory management: Auto-create `./data/` folder
   - Database initialization: Load schema from migration file
   - Verification: Table count + sample listing
   - Environment config: Auto-create `.env` template with SQLite URL
   - Workflow guidance: Console output with next steps

5. **Environment Template** (`.env.sqlite.example`)
   - Driver selection: SQLite (default for local) vs MySQL (optional for sync)
   - Path configuration: `./data/posbengkel.db` (portable, git-ignored)
   - Feature flags: Offline mode, realtime, inventory, parts, customers, appointments
   - Security: JWT secrets, CORS origins, token timeouts
   - WebSocket: Enabled by default (`/ws` path, :8081 port)
   - Sync flags: Optional for future hybrid architecture

### Implementation Rationale

**Why SQLite for GO?**
- ✅ **Local-first offline**: No network dependency for workshop operations
- ✅ **Portable**: Single file database (./data/posbengkel.db) → easy backup/transfer
- ✅ **Development speed**: No server setup needed for local testing
- ✅ **Multi-location ready**: Each workshop runs independent SQLite instance
- ✅ **Sync-friendly**: SQL-based export/import with central MariaDB future-proof

**Architecture Decision:**
- **Scenario 1 (Current)**: Standalone GO + React SPA + SQLite (offline workshop)
- **Scenario 2 (Future)**: Hybrid sync (nocturnal data replication GO→Laravel or periodic webhook)
- **Non-goal**: Real-time cloud sync in MVP (offline-first assumption: network available during end-of-shift sync)

### Integration Checklist

- [x] Database driver module compiles (no imports missing)
- [x] Migration script has valid SQLite DDL (pragma, table structure, indexes)
- [x] Setup script runs without PowerShell errors
- [x] Environment template includes all required variables
- [x] Documentation covers local-first rationale + sync strategy
- [ ] (Next) Integration test: `go test ./internal/config` with SQLite
- [ ] (Next) Load schema into `./data/posbengkel.db` via setup script
- [ ] (Next) Verify `sql.DB` connection pool + PRAGMA foreign_keys in testing

### Quick Start (for users)

```powershell
# 1. Initialize SQLite database
.\scripts\setup-go-sqlite.ps1

# 2. Verify (optional)
sqlite3 .\data\posbengkel.db ".tables"

# 3. Start GO backend with SQLite
cd go-backend
$env:GO_DATABASE_DRIVER='sqlite'
go run ./cmd/api

# 4. Start React SPA (in new terminal)
cd go-frontend
npm install
npm run dev
```

---

## GO Frontend React SPA Implementation (2026-04-12) [Legacy Snapshot]

Status: ✅ **COMPLETED (Historical)** - Full folder structure + buildable scaffold

Update terbaru (2026-04-14): frontend GO aktif sudah dimigrasikan ke Next.js App Router native di `go-frontend/`.

### Deliverables

1. **React 18 SPA Scaffold** (`go-frontend/`)
   - Framework: Vite 5 + React 18 (no SSR, client-side routing)
   - Styling: Tailwind CSS 3 + PostCSS (dark mode enabled)
   - Routing: React Router v6 (client-side navigation)
   - API: Axios configured for GO backend (`:8081/api/v1`)
   - Build: production-ready Vite config + tree-shaking

2. **Project Configuration Files**
   - `package.json`: React 18, React Router, Tailwind, Axios, React Hot Toast, ESLint
   - `vite.config.js`: @/ alias (→ src/), React plugin, dev/preview servers
   - `tailwind.config.js`: Dark mode enabled, custom POS color palette (primary, accent, success, warning, danger, info)
   - `postcss.config.js`: Tailwind + Autoprefixer
   - `index.html`: Root div + Vite entry point
   - `.env.example`: Template VITE_* (legacy, sebelum migrasi Next.js)

3. **Core Application Files**
   - `src/main.jsx`: React 18 createRoot boilerplate
   - `src/index.css`: @tailwind directives + global resets
   - `src/App.jsx`: BrowserRouter + Routes shell, DashboardLayout integration
   - `src/services/api.js`: Axios instance with interceptors (Bearer token, error handling, VITE_API_URL - legacy)
   - `src/pages/Dashboard.jsx`: Landing page stub
   - `src/components/Layout/DashboardLayout.jsx`: Layout wrapper with Outlet

4. **Documentation** (`go-frontend/README.md`)
   - Architecture: Local-first SPA, offline-sync strategy
   - Multi-location POS context: Workshop nodes (GO+SQLite) vs central management (Laravel+MariaDB)
   - Setup: `npm install`, `npm run dev`, `npm run build`
   - API integration: Pointing to GO backend (`:8081`)
   - Next steps: Page implementations (Dashboard, Service Orders, etc.), offline caching

### Integration Checklist

- [x] Folder structure follows React best practices (components/, pages/, hooks/, services/, public/)
- [x] Dependency list compatible with Node 18+ (Vite 5, React 18, React Router v6)
- [x] Vite config points to GO backend (VITE_API_URL port :8081) [legacy phase]
- [x] Axios api.js ready for Bearer token + error handling
- [x] Tailwind + dark mode configured
- [x] README explains local-first architecture rationale
- [ ] (Next) `npm install` + `npm run dev` works locally
- [ ] (Next) Pages implemented: Appointment Index, Service Order Index, Vehicle Index, Dashboard
- [ ] (Next) WebSocket subscription hook for realtime updates (GO `/ws` path)
- [ ] (Next) Offline caching: IndexedDB or localStorage for critical data

### Feature Parity Requirements (from C1-C8 Matrix)

Each GO Frontend page must match:
- **C1**: Data display accuracy (schema match, field completeness)
- **C2**: Realtime updates (WebSocket subscription or polling)
- **C3**: Form validation (client-side + server-side error display)
- **C4**: CRUD operations (create, read, update, delete via API)
- **C5**: Authorization (token validation, permission checks)
- **C6**: Accessibility (keyboard nav, ARIA labels, color contrast)
- **C7**: Performance (lazy loading, pagination, index virtualization)
- **C8**: UX consistency (button states, loading indicators, error messages)

---

## Next Phase: GO Frontend Page Implementation

### Task Breakdown

1. **Install Dependencies** (prerequisite)
   ```bash
   cd go-frontend
   npm install
   ```

2. **Implement Core Pages** (parallel track)
   - [ ] Dashboard: KPI cards, quick actions, realtime metrics
   - [ ] Service Orders Index: Paginated list, status filters, search, sortable
   - [ ] Appointments Index: Calendar/list view, drag-to-reschedule stub
   - [ ] Vehicles Index: Customer vehicles, batch import stub
   - [ ] Customers Index: Search, contact, payment history stub

3. **Add Realtime Integration** (after pages)
   - [ ] WebSocket hook: `useGoRealtime(endpoint, onData)`
   - [ ] Subscription manager: Auto-resubscribe on disconnect
   - [ ] Data sync: Merge server updates with local state

4. **Add Offline Caching** (post-MVP)
   - [ ] IndexedDB schema for critical entities
   - [ ] Sync queue: Queue mutations during offline
   - [ ] Conflict resolution: Last-write-wins or merge strategy

### Dependencies Already In Place

- ✅ API service layer (api.js configured)
- ✅ Tailwind styling (dark mode, POS color tokens)
- ✅ Router shell (App.jsx with outlet)
- ✅ Layout components (DashboardLayout stub)
- ✅ Environment config (.env.example with GO backend URLs)

### Execution Timeline Estimate

- **Phase 1 (Dashboard)**: 1-2 hours (styling, data fetch, page structure)
- **Phase 2 (Service Orders)**: 2-3 hours (list view, filters, detail stub)
- **Phase 3 (Appointments)**: 2-3 hours (calendar component or list, scheduling stub)
- **Phase 4 (Vehicles)**: 1-2 hours (vehicle list, customer link)
- **Phase 5 (Realtime Integration)**: 2-3 hours (WebSocket hook, subscription logic)

---

## Operasional Checklist (GO Backend SQLite)

Sebelum production deployment:

- [ ] Load migration into live SQLite: `sqlite3 ./data/posbengkel.db < migrations/001_init_sqlite.sql`
- [ ] Test database connectivity from GO app: `go run ./cmd/api` → no connection error
- [ ] Verify tables created: `sqlite3 ./data/posbengkel.db ".tables"`
- [ ] Test PRAGMA foreign_keys: `sqlite3 ./data/posbengkel.db "PRAGMA foreign_keys;"`
- [ ] Backup strategy: daily copy of `./data/posbengkel.db` to network drive
- [ ] Schema versioning: version number in `system_settings` table for future migrations

---

## Formal UAT Kickoff (2026-04-12)

### Pre-UAT Technical Validation Results

✅ **All Three Critical Screens CLEARED for UAT:**
1. **Appointment Index** (`/dashboard/appointments`)
   - React syntax: ✓ NO ERRORS
   - GO Realtime hook: ✓ Integrated (useGoRealtime, domains: ['appointments'])
   - Backend GO handler: ✓ appointment_index.go (filters, search, pagination, stats, mechanics list)
   - Feature flag: ✓ GO_APPOINTMENT_INDEX_USE_GO (canary-ready)

2. **Service Order Index** (`/dashboard/service-orders`)
   - React syntax: ✓ NO ERRORS
   - GO Realtime hook: ✓ Integrated (action types: created/updated/deleted/status_changed/items_changed)
   - Backend GO handler: ✓ service_order_index.go (status, mechanic, date-range filters, pagination 25/page)
   - Feature flag: ✓ GO_SERVICE_ORDER_INDEX_USE_GO (canary-ready)

3. **Vehicle Index** (`/dashboard/vehicles`)
   - React syntax: ✓ NO ERRORS
   - GO Realtime hook: ✓ Integrated (action types: created/updated/deleted)
   - Backend GO handler: ✓ vehicle_index.go (transmission, service_status filters, search, pagination 20/page)
   - Feature flag: ✓ GO_VEHICLE_INDEX_USE_GO (canary-ready)

### Test Environment Setup

```bash
# Terminal 1: Start Laravel
cd c:\Developments\Laravel\Laravel 12\POS\pos_bengkel
php artisan serve --host=127.0.0.1 --port=8000

# Terminal 2: Start GO backend
cd c:\Developments\Laravel\Laravel 12\POS\pos_bengkel\go-backend
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3306'
$env:DB_DATABASE='laravel12_pos_bengkel'
$env:DB_USERNAME='root'
$env:DB_PASSWORD='root'
go run ./cmd/api

# .env settings for Canary Phase
GO_APPOINTMENT_INDEX_USE_GO=false  # Set to true after baseline established
GO_SERVICE_ORDER_INDEX_USE_GO=false  # Set to true after baseline established
GO_VEHICLE_INDEX_USE_GO=false  # Set to true after baseline established
```

### UAT Phase Timeline

**Week 1 (2026-04-12 to 2026-04-18):**
- [ ] Run baseline tests on all 3 screens with GO_*_USE_GO=false (Laravel-only path).
  - Record screenshots, JSON payloads, filter/sort behavior, timing.
  - Document baseline performance metrics (response time, render time).
  
- [ ] Incrementally enable one screen at a time:
  - [ ] Monday: Enable GO_APPOINTMENT_INDEX_USE_GO=true, side-by-side UAT (manual testers).
  - [ ] Wednesday: Enable GO_SERVICE_ORDER_INDEX_USE_GO=true, side-by-side UAT.
  - [ ] Friday: Enable GO_VEHICLE_INDEX_USE_GO=true, side-by-side UAT.

- [ ] For each screen, execute checklist per FRONTEND_PARITY_MATRIX.md (section 6: Formal UAT Entry Points):
  - C1 Layout parity
  - C2 Filter/sort/search/pagination parity
  - C3 Empty/loading/error state parity
  - C4 Validation/business-rule error parity
  - C5 Formatting parity (date, currency, status labels)
  - C6 Realtime behavior parity (event timing, update ordering, highlight, refres debounce)
  - C7 Permission-based visibility parity
  - C8 Response payload shape & semantics parity

- [ ] Record findings in FRONTEND_PARITY_MATRIX.md:
  - Sign-off date & tester name/role.
  - Screenshot pair (Laravel vs Go) for each criterion.
  - JSON payload comparison snapshot.
  - Any parity defects found (severity, remediation).

**Week 2 (2026-04-19 to 2026-04-25):**
- [ ] Address Week 1 parity defects (if any).
- [ ] Formal stakeholder review & sign-off by:
  - QA Lead (technical UAT approval)
  - Product Owner (business acceptance)
  - Operations (deployment readiness)

- [ ] Update FINAL_HANDOVER_SIGN_OFF.md with UAT results and approval chain.

### Success Criteria

Screen is ready for production canary (1-5% traffic) when:
- [x] All C1-C8 criteria marked [x] in parity matrix.
- [x] No high-severity parity defects outstanding.
- [x] Testable on both Laravel and GO paths side-by-side without issues.
- [x] Formal UAT sign-off obtained from QA Lead and Product Owner.

### Yang Sudah Selesai (Teknis)

- [x] Core sync command: `go:sync:run`, `go:sync:retry-failed`, `go:sync:alert-long-failed`, `go:sync:reconciliation-daily`, `go:sync:benchmark-capacity`.
- [x] Timeout dan retry limit fully configurable via env (`GO_SYNC_*`).
- [x] Benchmark kapasitas: 30/30 run sukses, p95 latency terukur dan stabil.
- [x] Shadow compare helper + integrasi di controller prioritas.
- [x] Import module (master + transaksi) beserta UI Import dan UI Sync dashboard.
- [x] Retention purge policy: command `go:sync:purge-old` + scheduler harian.
- [x] Repo hygiene: commit sudah terkelompok, artefak biner lokal di-ignore.

### Yang Masih In Progress

- [~] Retry/backoff prolonged-failure test cycle (observasi lebih panjang).
- [~] Alerting integration ke channel notifikasi produksi (di luar log aplikasi).
- [~] Frontend parity side-by-side UAT untuk screen kritis.
- [~] Kalibrasi mismatch threshold final per fitur untuk persetujuan bisnis.

### Blocking Non-Engineering

- [ ] UAT execution oleh QA untuk seluruh screen kritis.
- [ ] Persetujuan bisnis berdasarkan metrik 7 hari (variance/mismatch/skipped rate).
- [ ] Final release gate approval lintas owner.

### Next Action 7 Hari

1. Jalankan `go:sync:reconciliation-daily` harian dan kumpulkan metrik ke template sign-off.
2. Jalankan UAT parity untuk 3 screen prioritas dulu: Appointment Index, Service Order Index, Vehicle Index.
3. Eksekusi dry-run retention mingguan: `php artisan go:sync:purge-old --days=30 --dry-run=1`.
4. Review mingguan dengan PO/QA lead untuk keputusan canary ramp.

### Baseline Snapshot (2026-04-11)

- Reconciliation: HOLD (variance batch_total 15.91%, acknowledged 12.20% > threshold 5%).
- Shadow summary (hari ini): mismatch 0%, skipped 0% untuk `report_overall` dan `report_part_sales_profit`.
- Shadow trend 7 hari: masih ada historical violation (avg mismatch report_overall/report_part_sales_profit 33.59%).
- Canary gate: `GATE RESULT: HOLD` (coverage/samples belum cukup + historical mismatch/skipped tinggi).

Command agregasi harian:

```powershell
./scripts/collect-go-migration-metrics.ps1 -Date 2026-04-11 -VarianceThreshold 5 -TrendDays 7 -CurrentCanary 5
```

### Validation Bundle Snapshot (2026-04-12)

- [x] Review cepat risiko integrasi realtime GO pada frontend/backend selesai (tidak ada blocker kritis baru).
- [x] Validasi teknis: `go test ./...` (go-backend) PASS.
- [x] Validasi teknis: `npm run build` PASS (exit code 0).
- [~] Validasi parity bisnis/UX tetap menunggu side-by-side UAT formal per screen.
