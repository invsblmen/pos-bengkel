# Frontend Parity Matrix (Laravel vs Go)

Last updated: 2026-04-11
Owner: Migration Team
Purpose: Track visual and UX parity so Go-backed screens are indistinguishable from Laravel-backed screens.
This matrix measures parity of user-facing behavior and presentation, not shared component source code.

Legend:
- [x] Pass
- [~] Partial / in progress
- [ ] Not started
- [!] Blocked

## 1) Parity Criteria (Applied to Every Screen)

- C1 Layout and visual hierarchy are identical (spacing, typography, cards, tables, badges, actions).
- C2 Filters/sort/search/pagination behavior are identical.
- C3 Empty/loading/error states are identical.
- C4 Validation messages and business-rule errors are identical.
- C5 Formatting parity (date, currency, number, status labels) is identical.
- C6 Realtime behavior parity (event trigger timing, update ordering, state refresh) is identical.
- C7 Permission-based visibility and action availability are identical.
- C8 Response payload shape and field semantics are identical.

Pass rule per screen:
- A screen is considered "Parity Pass" only when C1-C8 are all [x] and side-by-side UAT is signed.

## 2) Master Screen Matrix

| Domain | Screen | Laravel Route/Page | Go Feature Key | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | UAT | Overall |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Appointment | Appointment Index | /dashboard/appointments | appointment_index | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Appointment | Appointment Calendar | /dashboard/appointments/calendar | appointment_calendar | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Appointment | Available Slots API UX | /dashboard/appointments/get-available-slots | appointment_slots | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Service Order | Service Order Index | /dashboard/service-orders | service_order_index | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Vehicle | Vehicle Index | /dashboard/vehicles | vehicle_index | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Vehicle | Maintenance Insights | /dashboard/vehicles/{id}/maintenance-insights | vehicle_insights | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Vehicle | Service History | /dashboard/vehicles/{id}/service-history | vehicle_service_history | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Recommendation | Vehicle Recommendations | /dashboard/vehicles/{id}/recommendations | vehicle_recommendations | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Recommendation | Maintenance Schedule | /dashboard/vehicles/{id}/maintenance-schedule | vehicle_maintenance_schedule | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Reports | Part Sales Profit | /dashboard/reports/part-sales-profit | report_part_sales_profit | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Reports | Part Sales Profit by Supplier | /dashboard/reports/part-sales-profit/by-supplier | report_part_sales_profit_by_supplier | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Reports | Overall Report | /dashboard/reports/overall | report_overall | [~] | [~] | [ ] | [ ] | [~] | [ ] | [ ] | [~] | [ ] | [~] |
| Sync Ops | Sync Dashboard | /dashboard/sync | n/a | [~] | [~] | [~] | [~] | [~] | [ ] | [~] | [~] | [ ] | [~] |
| Import Ops | Import Dashboard | /dashboard/imports | n/a | [~] | [~] | [~] | [~] | [~] | [ ] | [~] | [~] | [ ] | [~] |

## 3) Critical Flow Checklist (Cross-Screen)

- [ ] Login -> dashboard -> navigate all migrated pages without visual jump/regression.
- [ ] Filter + sort + pagination returns identical row counts and ordering between Laravel and Go.
- [ ] Empty search results show identical state and wording.
- [ ] Business-rule failures show identical UI-friendly errors (no debug page leak).
- [ ] Currency/date formatting consistency verified in all report and transaction pages.
- [ ] Realtime updates (where enabled) have same trigger timing and no duplicate render.
- [ ] Permission matrix check: hidden/disabled actions match exactly for each role.

## 4) Evidence Required per Screen

For each screen marked pass, attach:
- Screenshot A: Laravel-backed view.
- Screenshot B: Go-backed view.
- JSON sample A/B payload snapshot.
- Test note for filter/sort/pagination parity.
- Test note for empty/loading/error state parity.
- UAT sign-off (name/date).

## 5) Weekly Gate

Week considered "frontend parity green" only when:
- 0 critical screens with [!] blocked.
- At least 3 critical screens moved to full [x] C1-C8 + UAT.
- No unresolved high-severity parity defect older than 7 days.

## 6) Notes

- Start with critical screens: Appointment Index, Service Order Index, Vehicle Index, Overall Report.
- Keep user-facing behavior identical; the GO path may use its own dedicated frontend implementation as long as parity stays aligned.
- Treat payload contract drift as parity bug, not enhancement.

### Technical Validation Snapshot (2026-04-12)

- Frontend production build: PASS (`npm run build`, exit code 0).
- Go backend test/build validation: PASS (`go test ./...` pada `go-backend`).
- Realtime GO instrumentation tersedia lintas layar prioritas (status bar/toggle/hook), namun status parity C6 tetap [ ]/[~] sampai side-by-side UAT selesai.

### Formal UAT Entry Points & Readiness (2026-04-12)

#### Screen 1: Appointment Index (`/dashboard/appointments`)

**Pre-UAT Checklist (Automated/Code-level Validations):**
- [x] React component syntax: NO ERRORS (lint free).
- [x] useGoRealtime hook integrated: ✓ (`domains: ['appointments']`, event handlers implemented).
- [x] Realtime toggle button visible: ✓ (RealtimeToggleButton component present).
- [x] Highlight/refresh behavior hardened: ✓ (Inertia reload with preserveScroll/preserveState, 6s highlight timer).
- [x] Event metadata logging: ✓ (action + timestamp displayed in UI).
- [x] Backend GO handler available: ✓ (appointment_index.go, appointment_index_params, full query support).
- [x] Feature flag configured: ✓ (.env setting `GO_APPOINTMENT_INDEX_USE_GO`=false by default, legacy migration reference only).

**UAT Manual Tests Required (Side-by-side Laravel vs Go):**
- [ ] C1 Layout parity: Card grid view, list view, header, filters, action buttons.
- [ ] C2 Filter/sort parity: Status filter (scheduled/confirmed/completed/cancelled) + search + pagination (20 per page).
- [ ] C3 Empty state: No appointments present, rendering identical message.
- [ ] C4 Validation: Confirm/cancel appointment triggers identical validation/toast.
- [ ] C5 Formatting: Date/time display in "16 April 2026 14:30" format, mechanic name display.
- [ ] C6 Realtime: Create appointment in separate tab, verify update appears in <1s with highlight, verify refresh debouncing (300ms) works.
- [ ] C7 Permissions: Check role visibility (Admin vs Service Advisor action buttons).
- [ ] C8 Payload: Compare Laravel vs Go JSON structure (appointments array, stats sub-object, mechanics list).

**Entry Point:** Set `GO_APPOINTMENT_INDEX_USE_GO=true` in `.env`, then `php artisan serve` + `go run ./cmd/api` on port 8081, navigate to `/dashboard/appointments`.

---

#### Screen 2: Service Order Index (`/dashboard/service-orders`)

**Pre-UAT Checklist:**
- [x] React component syntax: NO ERRORS (lint free).
- [x] useGoRealtime hook integrated: ✓ (`domains: ['service_orders']`, action types: created/updated/deleted/status_changed/items_changed).
- [x] Realtime toggle button visible: ✓ (RealtimeToggleButton + RealtimeControlBanner).
- [x] Highlight/refresh behavior hardened: ✓ (Inertia reload, individual order highlighting, 6s timer).
- [x] Event metadata logging: ✓ (action, orderId, timestamp, added/removed/changed part IDs tracked).
- [x] Backend GO handler available: ✓ (service_order_index.go fully implemented).
- [x] Feature flag configured: ✓ (.env setting `GO_SERVICE_ORDER_INDEX_USE_GO`=false by default).

**UAT Manual Tests Required:**
- [ ] C1 Layout parity: Table/card view, compact header, filters, action buttons, status badges.
- [ ] C2 Filter/sort parity: Status filter (pending/in_progress/completed/paid/cancelled) + mechanic filter + date range + pagination (25 per page).
- [ ] C3 Empty state: No orders present message format identical.
- [ ] C4 Validation: Status change (e.g., pending -> in_progress) triggers identical response.
- [ ] C5 Formatting: Order number format (ORDER-###), date format, cost display in IDR, status label.
- [ ] C6 Realtime: Add part to order in separate tab, verify items_changed event triggers update with highlight, verify no duplicate renders.
- [ ] C7 Permissions: Check admin-only actions vs mechanic-view-only states.
- [ ] C8 Payload: Compare Laravel vs Go JSON (orders array with nested details, stats object, mechanic list).

**Entry Point:** Set `GO_SERVICE_ORDER_INDEX_USE_GO=true` in `.env`, navigate to `/dashboard/service-orders`.

---

#### Screen 3: Vehicle Index (`/dashboard/vehicles`)

**Pre-UAT Checklist:**
- [x] React component syntax: NO ERRORS (lint free).
- [x] useGoRealtime hook integrated: ✓ (`domains: ['vehicles']`, action types: created/updated/deleted).
- [x] Realtime toggle button visible: ✓ (RealtimeToggleButton in header).
- [x] Highlight/refresh behavior hardened: ✓ (Inertia reload, 6s vehicle highlight, debounced 300ms refresh).
- [x] Event metadata logging: ✓ (action, vehicleId, timestamp).
- [x] Backend GO handler available: ✓ (vehicle_index.go fully implemented with filters, search, pagination).
- [x] Feature flag configured: ✓ (.env setting `GO_VEHICLE_INDEX_USE_GO`=false by default).

**UAT Manual Tests Required:**
- [ ] C1 Layout parity: Grid card view (brand/model, plate number, year, KM, service status), list view (table), header.
- [ ] C2 Filter/sort parity: Transmission filter + service_status filter + sort by column + search (plate/brand/model) + pagination (20 per page).
- [ ] C3 Empty state: No vehicles available message identical.
- [ ] C4 Validation: Create/edit vehicle triggers identical validation errors.
- [ ] C5 Formatting: Plate number uppercase, KM display with comma separator, year as 4-digit, color label.
- [ ] C6 Realtime: Create vehicle in separate tab, verify update in index within 1s, verify highlight 6s, verify no jitter.
- [ ] C7 Permissions: Check service advisor vs owner view restrictions on edit/detail buttons.
- [ ] C8 Payload: Compare Laravel vs Go JSON (vehicles array with nested customer, stats object).

**Entry Point:** Set `GO_VEHICLE_INDEX_USE_GO=true` in `.env`, navigate to `/dashboard/vehicles`.

---

## 7) UAT Execution Checklist (Per Screen)

Gunakan checklist ini untuk setiap screen yang diuji side-by-side Laravel vs Go.

Pre-check:
- [ ] User role penguji ditetapkan (Admin/Kasir/Service Advisor/Owner).
- [ ] Toggle fitur dicatat (legacy migration reference, feature key, source backend aktif).
- [ ] Data sample pengujian disiapkan (normal, empty-case, error-case).

Step uji inti:
- [ ] Buka screen Laravel dan Go dengan filter default yang sama.
- [ ] Bandingkan C1 (layout/visual hierarchy) termasuk tabel, badge, action button.
- [ ] Uji C2 (filter/sort/search/pagination) pada minimal 3 variasi query.
- [ ] Uji C3 (empty/loading/error states) dengan skenario tanpa data dan request lambat.
- [ ] Uji C4 (validation/business-rule errors) dan pastikan pesan setara.
- [ ] Uji C5 (date/currency/number formatting) pada data yang sama.
- [ ] Uji C6 (realtime behavior) untuk urutan update dan no duplicate render.
- [ ] Uji C7 (permission visibility) pada minimal 2 role berbeda.
- [ ] Uji C8 (payload shape) dari network response snapshot A/B.

Evidence wajib:
- [ ] Screenshot Laravel (A) dan Go (B).
- [ ] JSON payload A/B (disamarkan jika berisi data sensitif).
- [ ] Catatan hasil per C1-C8.
- [ ] Keputusan UAT: Pass / Partial / Fail.

## 8) Business Sign-off Template

Gunakan template ini saat review mingguan parity.

Metadata:
- Tanggal review:
- Fitur/Screen yang dibahas:
- Reviewer bisnis:
- Reviewer teknis:

Ringkasan metrik 7 hari terakhir:
- Reconciliation variance batch_total (%):
- Reconciliation variance acknowledged_total (%):
- Legacy mismatch_rate (%):
- Legacy skipped_rate (%):
- Jumlah incident parity severity tinggi:

Keputusan:
- [ ] Sign-off diberikan
- [ ] Sign-off ditunda

Alasan keputusan:
-

Action item jika ditunda:
- Owner:
- Target date:
- Kriteria selesai:
