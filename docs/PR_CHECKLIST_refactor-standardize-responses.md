PR Checklist — refactor/standardize-responses

Purpose: verification steps for the controller response standardization PR.

Build
- [ ] Run `npm run build` and confirm `public/build` assets are created.

Run tests (MySQL)
- [ ] Run test suite using a MySQL/MariaDB connection (SQLite in-memory is incompatible with ALTER MODIFY used in some migrations).

Example (adjust credentials as needed):
```
DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 DB_DATABASE=pos_test DB_USERNAME=root DB_PASSWORD=secret php artisan test
```

Smoke test flows (manual)
- [ ] Part sales: create/update/cancel flows
- [ ] Part purchase order: create + receive flow
- [ ] Service order: create, start, complete, cancel lifecycle
- [ ] Part stock: stock in / stock out

Auth flows
- [ ] Register/login/password reset/email verification end-to-end

AJAX / Inertia verification
- [ ] Confirm modal/AJAX endpoints return JSON (200/201) for AJAX callers
- [ ] Confirm web flows still redirect+flash for non-AJAX requests
- [ ] Verify frontend mutation handlers use `onSuccess` + `router.reload()` where appropriate (no stale views)

Validation errors
- [ ] Confirm `ValidationException::withMessages` shows validation feedback in forms/modals

Known issues
- [ ] SQLite in-memory used by default in tests is incompatible with `ALTER TABLE ... MODIFY COLUMN` statements. Prefer running tests with MySQL/MariaDB for full suite.

Docs
- [ ] Add a short note in CHANGELOG or PR description describing behavioral change: controllers now return JSON for AJAX and redirect+flash for web flows via `RespondsWithJsonOrRedirect`.

Review & merge
- [ ] Assign reviewers
- [ ] Ensure CI / test matrix passes
- [ ] Choose merge strategy (squash/merge) and merge when green
