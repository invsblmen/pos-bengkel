# Migration Master Checklist

Last updated: 2026-04-10 (morning)
Scope: End-to-end migration from Laravel-only operation to Go-local execution with Laravel-hosted monitoring/fallback.

Legend:
- [x] Completed
- [~] In progress / partially completed
- [ ] Not started

## 0) Final Target (Acceptance)

- [ ] Go local runs as primary daily execution backend without crash loop.
- [ ] Laravel hosting remains active for online monitoring/fallback.
- [ ] Local-to-hosting sync is stable, idempotent, auditable, and scheduled.
- [ ] Business behavior parity (Go vs Laravel) is within approved threshold.
- [ ] Frontend parity achieved: Go-backed pages are visually and interaction-wise identical to Laravel-backed pages.
- [ ] Realtime parity achieved with GO-native realtime on GO path (no Echo/Reverb dependency on GO frontend path).
- [ ] Operational SOP and incident runbook are ready for operator/on-call.

## 1) Direction and Scope Lock

- [x] Migration direction agreed: local-first execution on Go, hosting visibility on Laravel.
- [x] Workshop-only product direction is aligned.
- [x] Legacy non-workshop cleanup direction is defined.
- [~] Final verification that no remaining hidden dependency to legacy flows.

## 2) Baseline Inventory and Audit

- [x] Transactional core table inventory completed.
- [x] Core endpoint inventory for migration candidates completed.
- [x] Existing architecture baseline captured for both stacks.
- [~] Final audit report of uncovered edge-cases across all routes/controllers.

## 3) Sync Architecture and Contract

- [x] Sync batch/outbox pattern designed.
- [x] Idempotency approach (sync_batch_id + payload hash) defined.
- [x] Token-based service-to-service auth concept implemented.
- [x] High-level local-to-hosting sync design documented.
- [~] Contract validation against all operational edge-cases (partial item failure, replay storms, schema drift).

## 4) Database and Schema Readiness

- [x] Local sync tables in Go side bootstrapped by app startup.
- [x] Hosting sync tables migration created in Laravel.
- [x] Batch/outbox/received tracking structures available.
- [x] Retention and purge policy implementation (including automatic cleanup jobs).

## 5) Go Backend Core Migration Work

- [x] Go sync configuration fields and env mapping implemented.
- [x] Sync routes registered.
- [x] Sync handlers implemented: status, list, create, run, send, retry.
- [x] Payload generation and hashing implemented.
- [x] Send flow to Laravel receiver implemented.
- [x] Batch status transitions implemented.
- [x] Go module tests pass (latest run green).
- [~] Runtime stability in local machine needs final confirmation (process observed exiting during repeated manual runs).

## 6) Laravel Receiver and Hosting Layer

- [x] Sync receive endpoint implemented.
- [x] Sync status endpoint implemented.
- [x] Token verification implemented.
- [x] Duplicate batch handling (idempotent receive behavior) implemented.
- [x] Sync UI page scaffolded for monitoring.
- [~] Hosting-side reconciliation and conflict surfacing for operators.

## 7) Feature Rollout Controls (Retired)

- [x] Feature-level Go toggle helper implemented.
- [x] Rollout flow existed for the migration phase.
- [x] Comparator and gate commands are retained only as historical records.
- [~] Threshold calibration history retained for reference only.
- [x] No active rollout ramping remains in the Laravel boundary.

## 8) Data Import Support for Migration

- [x] Import module scaffolded (controller, manager, UI page).
- [x] Spreadsheet dependency added.
- [x] Template generation and dry-run pathways implemented.
- [~] End-to-end QA of all dataset variants and correction workflows.
- [ ] Operator SOP for failed import rollback/correction finalized.

## 9) Route and App Wiring

- [x] API route file for sync created and registered.
- [x] Web routes for sync/import pages added.
- [x] Sidebar/menu entries added for operational access.
- [~] Full routing regression verification across role/permission combinations.

## 10) Runtime and Infra Hardening

- [x] Go server startup updated with degraded mode when DB unavailable.
- [x] Sync schema bootstrap failure handled without hard-crash.
- [x] Root-cause of repeated local process exit verified with reproducible logs (port bind conflict on 8081).
- [ ] Structured startup diagnostics and health probes standardized.
- [ ] Automatic restart policy and watchdog integration documented.

Priority #1 execution progress:

- [x] Port occupancy check completed (`api.exe` listening on 8081).
- [x] Failure reproduced with clear error: `bind: Only one usage of each socket address ... is normally permitted`.
- [x] Add startup preflight/runbook step to detect existing listener before relaunch.
- [x] Verify stable startup/stop cycle using single-instance workflow.

## 11) End-to-End Validation

- [x] Go test suite run from module root succeeded.
- [x] Smoke test: Go startup stable for sustained runtime window.
- [x] Smoke test: GET /api/v1/sync/status returns expected response in normal mode.
- [x] Smoke test: POST /api/v1/sync/run creates and sends batch successfully.
- [x] Verify receiver state in Laravel sync tables and UI.
- [x] Retry scenario test (simulate hosting failure then resend).

Latest evidence:

- [x] Receiver-down simulation produced expected failed send (`dial tcp 127.0.0.1:8000: connectex: No connection could be made`).
- [x] Retry on batch `84145033-939d-416b-b6bb-49272fb06aed` via `/api/v1/sync/batches/{id}/retry` returned HTTP 200 with batch status `acknowledged`.
- [x] Go sync summary currently reports activity with acknowledged and failed counters tracked (`acknowledged_total=6`, `failed_total=3`, `batch_total=9`).
- [x] Laravel receiver persistence check confirms the retried batch exists (`sync_received_batches` count for batch id = 1).
- [x] Runtime observation confirms listener on `:8081` is active with sustained uptime (`api` process uptime ~380 minutes at check time).

## 12) Scheduled Operation and Reliability

- [x] Daily sync scheduling finalized.
- [~] Retry/backoff policy finalized and tested.
- [~] Alerting for prolonged failed batches.
- [x] Audit/report job for daily reconciliation.
- [x] Capacity and timeout tuning for real-world data volume.

Scheduling evidence:

- [x] Artisan commands added: `go:sync:run`, `go:sync:retry-failed`, and `go:sync:reconciliation-daily`.
- [x] Laravel scheduler registration added behind `GO_SYNC_SCHEDULE_ENABLED=true`.
- [x] Schedule wiring validated via `php artisan schedule:list` (daily run + 30-minute retry + 30-minute alert + daily reconciliation jobs).
- [x] Legacy Windows scheduler automation scripts dibersihkan untuk mencegah auto-run tak terkontrol.
- [x] Runtime manual pengganti disediakan melalui `scripts/manual-runtime.ps1` (start/stop/status).
- [~] Retry command now supports exponential backoff gating (`--base-minutes`, `--max-minutes`, `--respect-backoff`), full prolonged-failure test cycle pending.
- [~] Alert command and scheduler hook added (`go:sync:alert-long-failed`) with threshold config, production notification channel integration pending.
- [x] Reconciliation command `go:sync:reconciliation-daily` implemented with variance detection (batch total, acknowledged counts), configurable threshold (default 5%), scheduled daily at 00:15, logs to application log channel.
- [x] Timeout dan limit command kini configurable via env (`GO_SYNC_*_TIMEOUT_SECONDS`, `GO_SYNC_RETRY_DEFAULT_LIMIT`, `GO_SYNC_RETRY_MAX_LIMIT`) dengan cap aman hingga 600 detik.
- [x] Command benchmark kapasitas ditambahkan: `go:sync:benchmark-capacity --timeouts=60,120,180 --iterations=10` untuk uji latency/sukses per timeout.
- [x] Benchmark lanjutan tervalidasi: 30/30 percobaan sukses HTTP 200 acknowledged; p95 latency: 60s=351.94 ms, 120s=313.91 ms, 180s=269.08 ms.
- [x] Retention purge command ditambahkan: `go:sync:purge-old {--days=} {--dry-run=0}` dengan filter status terminal dan jadwal harian otomatis.
- [x] Scheduler retention aktif saat `GO_SYNC_SCHEDULE_ENABLED=true` dan `GO_SYNC_RETENTION_PURGE_ENABLED=true` (default 03:20).

## 13) Business Parity and Reconciliation

- [~] Historical compare was enabled on key migrated read flows during migration.
- [~] Define accepted mismatch thresholds per feature with business sign-off.
- [x] Daily reconciliation report between local and hosting totals.
- [x] Conflict resolution SOP (who acts, how to resolve, SLA).

Reconciliation evidence:

- [x] Command `go:sync:reconciliation-daily` implemented, fetches Go sync status (batch_total, pending, failed, acknowledged) and compares to Laravel sync_received_batches counts (received, acknowledged, duplicate, invalid, failed).
- [x] Variance detection: calculates percentage difference for batch_total and acknowledged_total against configurable threshold (default 5%).
- [x] Scheduler hook added: runs daily at 00:15 when GO_SYNC_RECONCILIATION_ENABLED=true.
- [x] Output includes summary tables (Go summary, Laravel summary, variance comparison) with visual status indicators (✓/✗).
- [x] Logging: all reconciliation results logged to application log channel via Log::info('go_sync_reconciliation_daily', ...).
- [x] Test output verified: command correctly detected 70% variance between Go (10 batches) and Laravel (3 received), returned FAILURE exit code, and logged discrepancies.

## 13.1) Frontend Parity (Visual and UX)

Reference: see FRONTEND_PARITY_MATRIX.md for screen-by-screen tracking and UAT status.

- [ ] Frontend UX and behavior are parity-aligned for both backends, even if the GO path uses a dedicated frontend implementation.
- [ ] Response/payload contracts from Go match Laravel shape for all migrated pages.
- [ ] Pagination, filters, sort, and empty-state behavior match Laravel output.
- [ ] Validation and error message UX match Laravel behavior.
- [ ] Date/number/currency formatting and locale outputs match Laravel.
- [ ] Realtime behavior parity verified (event names, payload shape, ordering).
- [ ] Side-by-side UAT sign-off completed for all critical screens.

## 14) Repo Hygiene and Change Management

- [x] Major migration changes cleaned and isolated into thematic commits.
- [x] Remove local binary artifacts from tracked changes where not required.
- [x] Group and isolate commits by domain (sync core, rollout controls, import, UI).
- [x] Final review pass for accidental unrelated edits.

## 15) Documentation and Handover

- [x] Sync concept and endpoint additions documented in Go README.
- [x] Master project guide alignment with latest migration state.
- [x] Operator playbook for daily sync + manual retry.
- [x] Incident runbook for sync failures and rollback guidance.
- [x] Final handover checklist and sign-off sheet.

## 16) Completion Gate (Definition of Done)

Mark migration as complete only when all below are true:

- [ ] Runtime: Go local runs stably for agreed observation period.
- [ ] E2E: Sync create/send/retry flow passes repeatedly without manual DB fixes.
- [ ] Reliability: Scheduler + alerting + reconciliation jobs are operational.
- [ ] Parity: Mismatch and skipped rates are within approved thresholds.
- [ ] Frontend: visual, interaction, and state behavior parity is signed off.
- [ ] Operations: SOP/runbook available and tested by operator/on-call.
- [ ] Governance: Changes are cleanly grouped, reviewed, and ready for release.

## Execution Priority (Next)

1. Finalize single-instance startup workflow (preflight check + stable start/stop procedure).
2. Run full E2E sync smoke test (status, create/run, receive, retry).
3. Finalize scheduling and alerting for daily operation.
4. Close reconciliation thresholds and retire any remaining rollout policy.
5. Complete operational docs and perform final sign-off.

## 17) Weekly Milestones (Operational Tracking)

### Week 1 - Runtime and Core E2E

- [x] Confirm Go module test baseline is green.
- [x] Capture root-cause for repeated local exit issue.
- [x] Standardize single-instance startup workflow and operator steps.
- [x] Validate Go uptime window (no unexpected exit in agreed observation period).
- [x] Complete sync smoke test: status, create/run, receive, retry.

### Week 2 - Reliability and Reconciliation

- [x] Finalize daily sync scheduling.
- [~] Finalize retry/backoff behavior and test failure recovery.
- [~] Add alerting for long-failed batches.
- [x] Implement and verify daily reconciliation summary.
- [x] Tune payload size/timeouts for realistic data volume.

### Week 3 - Frontend Parity and Sign-off

- [~] Move critical screens to full parity pass in FRONTEND_PARITY_MATRIX.
- [~] Complete side-by-side UAT for critical screens.
- [~] Finalize mismatch thresholds and document that rollout policy is retired.
- [x] Finalize operator SOP and incident runbook.
- [ ] Prepare release-ready governance pass (clean grouping/review checklist).

