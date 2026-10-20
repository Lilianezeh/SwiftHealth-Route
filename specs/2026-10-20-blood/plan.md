# Blood (Phase 8): plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, one commit per task, IDs (US-15, US-16, FR-27 to FR-29,
FR-19, FR-20, NFR-07, NFR-10) in every commit and test; `git branch --show-current` before every commit and push; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `backend/app/schemas/blood.py`, `repositories/blood_repository.py`, `services/blood_service.py`, `api/routes/blood.py` | Tasks 1 and 2 |
| `backend/seed/seed_data.py` | Task 2: "Blood donation" on two local demo banks |
| `frontend/src/types/api.ts`, `lib/api/blood.ts`, `hooks/useBloodList.ts`, `components/blood/*`, `app/(public)/blood/**` | Tasks 3 and 4 |
| `frontend/src/config/donorGuidance.ts` | Task 4 |
| `frontend/tests/unit/*`, `tests/end-to-end/blood.spec.ts` | each task |
| `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md` | Task 0 and Task 6 |

## Tasks

### Task 0: Spec
- [ ] This folder, api-spec and ui-spec 2.6 and 2.7.
### Task 1: `GET /blood/banks` (tests first)
- [ ] Rules F1, F2, F5.
### Task 2: `GET /blood/donation-centres` (tests first)
- [ ] Rules F4, F5, F8.
### Task 3: the Find blood page (tests first)
- [ ] Chips, list, notice, states, position.
### Task 4: the Donate blood page and the tab links (tests first)
- [ ] Centres, hours, the guidance rule F3.
### Task 5: real-browser checks at 320, 360, 768 and 1024 px
- [ ] Layout and flow.
### Task 6: Wrap-up
- [ ] Suites, docs, draft PR (base `feature/launch-readiness`).
