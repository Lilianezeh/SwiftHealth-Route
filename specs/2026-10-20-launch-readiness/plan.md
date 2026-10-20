# Launch readiness (Phase 14): plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, one commit per task, IDs (FR-39, FR-40, NFR-09,
NFR-06, NFR-07) in every commit and test; `git branch --show-current` before every commit and push; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `backend/app/services/csv_import_service.py`, `csv_export_service.py`, `core/csv_cells.py`, `schemas/csv_io.py`, `api/routes/admin.py`, repositories | Tasks 1 and 2 |
| `frontend/src/app/(dashboards)/admin/import-export/page.tsx`, `components/admin/ImportExport.tsx`, `lib/api/staff.ts`, `StaffBar.tsx`, `lib/staff/roles.ts` | Task 3 |
| `scripts/backup-db.sh`, `restore-db.sh`, `test-backup-restore.sh`, `.gitignore`, `runbook-backups.md` | Task 4 |
| `analytics-proposal.md`, `release-checklist.md` | Tasks 5 and 6 |
| `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md` | Task 0 and Task 7 |

## Tasks

### Task 0: Spec
- [ ] This folder, api-spec section 11 and ui-spec 3.9.
### Task 1: `POST /admin/import` (tests first)
- [ ] Parse, validate, create drafts, report rows.
### Task 2: `GET /admin/export` (tests first)
- [ ] Both types, formula protection.
### Task 3: the import and export screen (tests first)
- [ ] File, result, downloads.
### Task 4: backups and the tested restore
- [ ] Scripts, the restore test run, the runbook.
### Task 5: the analytics proposal
- [ ] The three options and a recommendation.
### Task 6: the release checklist
- [ ] Every criterion with evidence, the owner's actions, the merge order.
### Task 7: Wrap-up
- [ ] Suites, docs, draft PR (base `feature/info-pages`).
