# SwiftRescue order: plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, IDs (FR-14, FR-15, FR-19, FR-25, NFR-10) in the commit and the tests;
`git branch --show-current` before every commit and push; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `frontend/tests/unit/EmergencyPage.test.tsx` | Task 1: the new tests, and one changed (Fire is no longer hidden) |
| `frontend/src/components/emergency/EmergencyGroups.tsx`, `BloodLinkCard.tsx` | Task 1 |
| `frontend/tests/end-to-end/swiftrescue.spec.ts` | Task 2: the empty groups and the card at 320, 360, 768 and 1024 px |
| `specs/frontend/ui-spec.md` (2.5), `specs/2026-10-17-swiftrescue/requirements.md` (A1 note) | Task 1 |

## Tasks

### Task 1: the page (tests first)
- [x] Ambulance and Fire always shown, with the text; other empty groups hidden; the card after the groups; the pharmacies last.
### Task 2: real-browser checks at 320, 360, 768 and 1024 px
- [x] Layout of the empty groups and the card.
