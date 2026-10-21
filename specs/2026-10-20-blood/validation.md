# Blood (Phase 8): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results (2026-10-20, branch `feature/blood`)

- Backend: `pytest -q -W error` **1198 passed**; `ruff check .` clean. `tests/integration/test_blood.py` has 29 tests (trust rules, the FR-22
  exclusion, groups and the confirmed date, order and paging, the validation of `blood_group`, nothing sponsored, no internal field).
- Frontend: `vitest` **1330 passed** (98 files); `tsc --noEmit` and `next lint` clean. `BloodPages.test.tsx` has 24 tests (tabs, chips, cards,
  states, position only after a tap and never in the address, paging, the guidance rule F3).
- Real browser (`tests/end-to-end/blood.spec.ts`) at 320, 360, 768 and 1024 px: **16 passed** (layout and 48 px targets with a fake API; position
  sent as `lat` and `lng` only after the tap; both pages against the real local API).
- A running pytest and a second one on the same test database fail each other: run the backend suite alone.

## Security and privacy checklist
- [x] A visitor's position is used for the request only and is in no address, storage beyond the tab, or log (NFR-07): tested in the unit and the browser spec
- [x] Nothing sponsored, and no unpublished or flagged listing, in either list (FR-19, trust rules): backend tests and the browser spec
- [x] No medical text was written by me: the donor guidance is empty until the medical advisor supplies reviewed text (a test fails if points are added without the review line and a date)

## Merge checklist
- [x] Lint, typecheck, tests clean; numbers written above
- [ ] Both CIs green (check on the pull request)
- [x] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] **The owner decided who supplies the donor guidance (the medical advisor)**
- [ ] The pull request stays a draft until every box above is ticked.
