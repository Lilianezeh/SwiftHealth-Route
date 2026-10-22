# SwiftRescue order: validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results (2026-10-22, branch `feature/swiftrescue-order`)

- Backend: `pytest -q -W error` **1388 passed**; `ruff check .` clean. `GET /emergency` has no `pharmacies_24h` key and no pharmacy anywhere in the answer (new test, red first;
  the three old pharmacy tests were removed with the feature).
- Frontend: `vitest` **1458 passed** (104 files); `tsc --noEmit` and `next lint` clean. 13 tests for the new order and the blood card were red first (13 failed), then the
  pharmacy tests: the page, the saved copy and the share text ignore a pharmacy list that an old API or an old saved copy still holds.
- Real browser at 320, 360, 768 and 1024 px (development server): `swiftrescue.spec.ts` **24 passed, 1 skipped**.
- **Offline check on a production build** (the one that was skipped): built a copy of `frontend/` with `next build`, served it with `next start -p 3100`, and ran
  `OFFLINE_CHECK=1 BASE_URL=http://localhost:3100 npx playwright test swiftrescue -g offline`: **1 passed** (8.8 s). After one visit the page, the saved contacts and the
  blood card open with the network off, and no pharmacy appears. The server was stopped afterwards.

## Checklist
- [x] 112 is still the first thing on the page, and the sentence of FR-26 is unchanged (the existing tests still pass)
- [x] Nothing says "Sponsored" or "Featured" (FR-19: the existing test scans the whole page, with the new card on it); the blood card has no cross symbol and no red
- [x] All text is 16 px or more and every link is 48 px or more high (NFR-10)
- [x] Lint, typecheck, tests clean; real-browser checks at 320, 360, 768 and 1024 px pass; the offline check passes on a production build
- [x] No pharmacy in the page, the API answer, the saved copy or the shared list; pharmacies are still found with `/search` (its tests are unchanged and pass)
- [ ] The pull request stays a draft until the owner has looked at `/emergency` on a phone.
- [ ] **The API changed:** the production API answers without `pharmacies_24h` only after this is merged and Render has redeployed. The new page works with both the old and the new answer.
