# Launch readiness (Phase 14): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md). Documents: [runbook-backups.md](runbook-backups.md),
[analytics-proposal.md](analytics-proposal.md), [release-checklist.md](release-checklist.md).

## Results (2026-10-20)
- Backend: **1169 passed** with `-W error`, `ruff check` clean (new: `test_admin_import_export` 41, `test_csv_cells` 17, `test_bootstrap_admin` 10).
- Frontend: lint and typecheck clean; **1307 unit tests passed** in 97 files (new: `ImportExport` 15, the staff bar link).
- Real browser, 320, 360, 768 and 1024 px: **8 of 8** for the import and export screen (fits, imports a chosen file with the token, lists the skipped rows, downloads a CSV,
  closed to an editor; the API was faked). One run of the 360 px case failed once while the machine was busy with a 9-minute run, and passed on the two reruns.
- **The restore was tested on 2026-10-20** with `scripts/test-backup-restore.sh`: dump of the development database, restore into a throw-away container, the row count of
  every one of the 9 tables equal (users 4, categories 12, listings 31, phone_numbers 35, opening_hours 217, services 47, verification_checks 56, user_reports 2,
  audit_entries 31) and the `pg_trgm` extension back. `scripts/test-backup-scripts.sh` (no Docker) checks the 30-day pruning and the refusals: 18 of 18 passed.
- Found on the way: the production database has **no way to create a first admin** (the seed makes demo users with demo listings, which must not go to production), so
  I added `python -m app.bootstrap_admin` (tests first). The Playwright helper assumed every body is JSON and broke on the CSV body (fixed).
- Not done, on purpose: a Render cron job (paid), any change to Render, a real production backup or restore, the demo cleanup, and the analytics (a proposal for you).
- Not checked by me: opening an exported CSV in a real spreadsheet; a real production import.

## Tests per task
- Tasks 1 and 2 (`6e1235a`): `test_admin_import_export` (roles, drafts owned by the admin, the audit reference, row errors with their numbers, duplicates in the file and in the database,
  column order, byte-order mark, quoted cells with commas and new lines, the 500-row and 1 MB limits, 415 and 422, the export columns, formula protection, no password hash, no reporter data),
  `test_csv_cells`.
- Task 3 (`8b57654`): `ImportExport`, `StaffGate` (the link), `requestStaff`.
- Task 4 (`df75263`): `scripts/test-backup-scripts.sh`, `scripts/test-backup-restore.sh`, `test_bootstrap_admin`.
- Tasks 5 and 6: the two documents.

## Security and privacy checklist
- [x] Import and export need the admin role (403 for others, 401 without a login) (tests)
- [x] A cell that starts with `=`, `+`, `-`, `@` is neutralised on export; a stored phone and a number are left alone (tests)
- [x] The import cannot make more than 500 rows or read more than 1 MB; it creates drafts only (tests)
- [x] No backup file is committed (`backups/` is in `.gitignore`), none is printed, none is written outside the folder given; the restore refuses the live database; an address is read from the environment and never printed (script tests)
- [x] The bootstrap command never prints or stores the password in clear and refuses an existing email (tests)

## Merge checklist
- [x] Lint, typecheck, tests, build clean; numbers written above
- [ ] Both CIs green (checked after the pull request is opened)
- [ ] The owner read the release checklist, the runbook and the analytics proposal
- [ ] The pull request stays a draft until every box above is ticked.
