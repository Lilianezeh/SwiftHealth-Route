# Blood banks only on /blood: validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results (2026-10-22, branch `feature/blood-only-on-blood-page`, stacked on #37)

- Backend: `pytest -q -W error` **1389 passed**; `ruff check .` clean. `GET /emergency` has six groups; a published blood bank is nowhere in the answer and is still listed by `/blood/banks` (new test, red first).
- Frontend: `vitest` **1463 passed** (104 files); `tsc --noEmit` and `next lint` clean. 5 new tests were red first: the page, the saved copy and the shared list ignore a `blood-bank` group
  (and the pharmacy list) that an older API still sends, and an older saved copy still opens.
- Real browser at 320, 360, 768 and 1024 px (development server): `swiftrescue.spec.ts` **24 passed, 1 skipped** (the offline check needs a production build; run in the next pull request, `/blood` offline).
  The fake answer still holds the old blood bank group and the old pharmacy list, and the page shows neither.

## Checklist
- [x] SwiftRescue keeps only the "Need blood urgently?" card for blood; no "Blood banks" heading, no blood bank card
- [x] 112 first, the sentence of FR-26, Ambulance and Fire always shown: unchanged
- [x] No pharmacy, no blood bank in the saved copy or the shared list
- [x] The `blood-bank` category and `/blood` are untouched
- [ ] **The API changed:** the production API drops the group only after this is merged and Render has redeployed. The page works with the old and the new answer.
- [ ] Merge #37 first; then change the base of this pull request to `main`.
- [ ] The pull request stays a draft until the owner has looked at `/emergency` on a phone.
