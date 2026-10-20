# Reports queue, re-checks and dashboard (Phase 11): plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, one commit per task, IDs (US-11, US-12, FR-33 to FR-36,
FR-38, NFR-06, NFR-07, NFR-10) in every commit and test; `git branch --show-current` before every commit and push; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `backend/app/schemas/report_queue.py`, `repositories/report_repository.py`, `services/report_queue_service.py`, `api/routes/reports.py` | Task 1 |
| `backend/app/schemas/dashboard.py`, `repositories/dashboard_repository.py`, `services/dashboard_service.py`, `api/routes/dashboard.py` | Task 2 |
| `backend/app/repositories/listing_repository.py` | Task 2: `due` counts only published and re-check due listings (H6) |
| `backend/app/services/recheck_service.py`, `services/staff_alert_service.py`, `app/jobs/recheck.py` | Task 3 |
| `frontend/src/types/staff.ts`, `lib/api/staff.ts`, `lib/staff/roles.ts`, `lib/formatters/dates.ts`, `hooks/usePagedList.ts` | Tasks 4 to 6 |
| `frontend/src/components/admin/ReportsQueue.tsx`, `Rechecks.tsx`, `Dashboard.tsx`, `CheckChart.tsx`, `QueueStatus.tsx`, `AdminHome.tsx`, `StaffBar.tsx`; pages `admin/reports`, `admin/recheck`, `admin/listings` (`?status=`) | Tasks 4 to 6 |
| `frontend/tests/unit/*`, `tests/end-to-end/queue.spec.ts` | each task |
| `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md` | Task 0 and Task 8 |

## Tasks

### Task 0: Spec
- [x] This folder, api-spec (sections 6, 10, 12, the `due` rule) and ui-spec 3.2, 3.6, 3.7. (`d45032e`)
### Task 1: `GET /reports` and `PATCH /reports/{id}` (tests first)
- [x] Rules H1, H2, H3, H7: roles, urgent first, masked phone, resolve deletes the phone and the key, audit. (`24ddd23`)
### Task 2: `GET /dashboard/stats` and the `due` filter (tests first)
- [x] Rule H6, equal to the lists. (`c05982d`)
### Task 3: the nightly job (tests first)
- [x] Rule H5: moves, audit, email of names, twice is a no-op, nothing else touched. (`23fbdcc`)
### Task 4: the reports screen (tests first)
- [x] `/admin/reports`: urgent tag, resolve, dismiss, open listing, states. (`6eee6ac`)
### Task 5: the re-checks screen (tests first)
- [x] `/admin/recheck`: two tabs, rows link to the verification log. (`3d4de80`)
### Task 6: the dashboard (tests first)
- [x] `/admin` for editor and admin: cards, Recharts chart and its table; bar links. (`00a7b87`)
### Task 7: real-browser checks at 320, 360, 768 and 1024 px
- [x] Layout and flow of the three screens: 16 checks passed. (`f44a06f`)
### Task 8: Wrap-up
- [x] Suites, docs, draft PR (base `feature/blood`).
