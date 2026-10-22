# Blood banks only on /blood: plan

Requirements: [requirements.md](requirements.md). Rules: tests first, IDs (FR-15, FR-27, US-15, NFR-10); `git branch --show-current` before every commit and push; draft PR (base `feature/swiftrescue-order` until #37 is merged, then `main`).

## Files

| File | Change |
| --- | --- |
| `backend/tests/integration/test_emergency.py`, `backend/app/services/emergency_service.py`, `schemas/emergency.py` | Task 1: six groups |
| `frontend/src/lib/emergency/groups.ts`, `EmergencyGroups.tsx`, `offlineCopy.ts`, `shareText.ts` and their tests, `tests/helpers/api.ts`, `swiftrescue.spec.ts` | Task 2: ignore a blood group |
| `specs/prd.md` (FR-15), `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md` (2.5) | Task 0 |

## Tasks

### Task 0: Spec
- [x] This folder, FR-15, api-spec and ui-spec.
### Task 1: the API (tests first)
- [ ] Six groups; a blood bank is nowhere in `GET /emergency`.
### Task 2: the page, the saved copy and the shared list (tests first)
- [ ] A `blood-bank` group from an older API or saved copy is ignored; the card stays; browser checks at 320, 360, 768 and 1024 px.
