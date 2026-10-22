# SwiftRescue order: plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, IDs (FR-14, FR-15, FR-19, NFR-10) in the commit and the tests;
`git branch --show-current` before every commit and push; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `frontend/tests/unit/EmergencyPage.test.tsx` | Task 1: the new tests; Task 3: the pharmacy tests replaced |
| `frontend/src/components/emergency/EmergencyGroups.tsx`, `BloodLinkCard.tsx` | Tasks 1 and 3 |
| `backend/app/services/emergency_service.py`, `schemas/emergency.py`, `routes/emergency.py`, `tests/integration/test_emergency.py` | Task 3: no pharmacy list (K6) |
| `frontend/src/types/api.ts`, `lib/emergency/offlineCopy.ts`, `tests/unit/emergencyOffline.test.ts`, `emergencyShare.test.ts`, `tests/helpers/api.ts` | Task 3 |
| `frontend/tests/end-to-end/swiftrescue.spec.ts` | Tasks 2 and 3 |
| `specs/frontend/ui-spec.md` (2.5), `specs/backend/api-spec.md` (`GET /emergency`), `specs/prd.md` (FR-25), `specs/2026-10-17-swiftrescue/requirements.md` | Tasks 1 and 3 |

## Tasks

### Task 1: the page (tests first)
- [x] Ambulance and Fire always shown, with the text; other empty groups hidden; the blood card after the groups.
### Task 2: real-browser checks at 320, 360, 768 and 1024 px
- [x] Layout of the empty groups and the card.
### Task 3: remove the 24-hour pharmacies from SwiftRescue (tests first)
- [x] Page, API answer, saved copy and types; an old answer or an old saved copy is still read; the shared list never had them; FR-25 marked removed.
- [x] The offline check run on a production build.
