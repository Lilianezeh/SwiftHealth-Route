# Reports queue, re-checks and dashboard (Phase 11): plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, one commit per task, IDs (US-11, US-12, FR-33 to FR-36,
FR-38, NFR-06, NFR-07, NFR-10) in every commit and test; `git branch --show-current` before every commit and push; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `backend/app/schemas/report_queue.py`, `repositories/report_repository.py`, `services/report_queue_service.py`, `api/routes/reports.py` | Task 1 |
| `backend/app/schemas/dashboard.py`, `repositories/dashboard_repository.py`, `services/dashboard_service.py`, `api/routes/dashboard.py` | Task 2 |
| `backend/app/repositories/listing_repository.py`, `services/staff_listing_service.py` | Task 2: `due` counts only published and re-check due listings (H6) |
| `backend/app/services/recheck_service.py`, `app/jobs/recheck.py` | Task 3 |
| `frontend/src/types/staff.ts`, `lib/api/staff.ts`, `lib/staff/roles.ts`, `lib/formatters/*` | Tasks 4 to 6 |
| `frontend/src/components/admin/ReportsQueue.tsx`, `Dashboard.tsx`, `CheckChart.tsx`, `Rechecks.tsx`, `AdminHome.tsx`, `StaffBar.tsx`; pages `admin/reports`, `admin/recheck` | Tasks 4 to 6 |
| `frontend/tests/unit/*`, `tests/end-to-end/queue.spec.ts` | each task |
| `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md`, the Privacy page check | Task 0 and Task 8 |

## Tasks

### Task 0: Spec
- [ ] This folder, api-spec (sections 6, 10, 12, the `due` rule) and ui-spec 3.2, 3.6, 3.7.
### Task 1: `GET /reports` and `PATCH /reports/{id}` (tests first)
- [ ] Rules H1, H2, H3, H7: roles, urgent first, masked phone, resolve deletes the phone and the key, audit.
### Task 2: `GET /dashboard/stats` and the `due` filter (tests first)
- [ ] Rule H6, equal to the lists.
### Task 3: the nightly job (tests first)
- [ ] Rule H5: moves, audit, email of names, twice is a no-op, nothing else touched.
### Task 4: the reports screen (tests first)
- [ ] `/admin/reports`: urgent tag, resolve, dismiss, open listing, states.
### Task 5: the re-checks screen (tests first)
- [ ] `/admin/recheck`: two tabs, rows link to the verification log.
### Task 6: the dashboard (tests first)
- [ ] `/admin` for editor and admin: cards, Recharts chart and its table; bar links.
### Task 7: real-browser checks at 320, 360, 768 and 1024 px
- [ ] Layout and flow of the three screens.
### Task 8: Wrap-up
- [ ] Suites, docs, draft PR (base `feature/blood`).
