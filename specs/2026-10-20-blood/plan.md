# Blood (Phase 8): plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, one commit per task, IDs (US-15, US-16, FR-27 to FR-29,
FR-19, FR-20, NFR-07, NFR-10) in every commit and test; `git branch --show-current` before every commit and push; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `backend/app/schemas/blood.py`, `repositories/blood_repository.py`, `services/blood_service.py`, `api/routes/blood.py` | Tasks 1 and 2 |
| `frontend/src/types/api.ts`, `lib/api/blood.ts`, `hooks/usePagedList.ts`, `components/blood/*`, `app/(public)/blood/**` | Tasks 3 and 4 |
| `frontend/src/config/donorGuidance.ts` | Task 4 |
| `frontend/src/app/sitemap.ts` | Task 4: the two pages are listed |
| `frontend/tests/unit/*`, `tests/end-to-end/blood.spec.ts` | each task |
| `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md` | Task 0 and Task 6 |

No seed change (F8): the local demo banks already have the "Blood donation" service and their groups.

## Tasks

### Task 0: Spec
- [x] This folder, api-spec and ui-spec 2.6 and 2.7. (`5d426ec`)
### Task 1: `GET /blood/banks` (tests first)
- [x] Rules F1, F2, F5. (`4077025`)
### Task 2: `GET /blood/donation-centres` (tests first)
- [x] Rules F4, F5. (`4077025`, both endpoints share one repository and service, so one commit)
### Task 3: the Find blood page (tests first)
- [x] Chips, list, notice, states, position. (`33ccad6`)
### Task 4: the Donate blood page and the tab links (tests first)
- [x] Centres, hours, the guidance rule F3. (`33ccad6`, same files as Task 3: one list hook and one set of card parts)
### Task 5: real-browser checks at 320, 360, 768 and 1024 px
- [x] Layout and flow: 16 checks passed. (`132018e`)
### Task 6: Wrap-up
- [x] Suites, docs, draft PR (base `feature/launch-readiness`).
