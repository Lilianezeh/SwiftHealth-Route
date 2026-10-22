# /blood works offline after one visit: validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results (2026-10-22, branch `feature/blood-offline`, from `main`)

- Frontend: `vitest` **1481 passed** (105 files); `tsc --noEmit` and `next lint` clean. Written first and red: the worker keeps `/blood` (3 failed), the saved list (a new test file), and the page saves and shows it
  (23 new tests in `BloodPages.test.tsx`). Backend: **not touched** (no API change, so previews and production behave the same).
- Real browser at 320, 360, 768 and 1024 px (development server): `blood.spec.ts` **20 passed, 1 skipped**. The new check at each width: a saved copy plus an unreachable API gives the notice with the date,
  the saved banks, no near-me button, no distance, 48 px targets, text 16 px or more, nothing wider than the screen, and the group chips filter the saved list.
- **The real offline test on a production build** (`next build`, `next start -p 3100`, `OFFLINE_CHECK=1 BASE_URL=http://localhost:3100`): **2 passed** (12.6 s): `/blood` (after one visit the worker has kept the page and the
  page has saved the banks; with the network off the reload shows "Offline — showing saved blood banks from <date>", the same bank names as online, Call as `tel:` links and Try again) and
  `/emergency` (still works with the shared worker). The server was stopped afterwards.

## Checklist
- [x] The saved list holds no distance and no position (tests read the stored text; the position used in the test is not in it)
- [x] The saved copy is used only after a network failure or timeout, never for an error answer of the API
- [x] An empty list never replaces a good copy; a damaged copy or a storage that throws is the standard error with Retry
- [x] The worker keeps only `/emergency`, `/blood` and `/_next/static/`, never a query, never an API answer; `/blood/donate` is not kept (N1)
- [x] 112 / SwiftRescue offline still works with the shared worker (production-build test)
- [ ] The pull request stays a draft until the owner has tried it on a phone: open `/blood` online once, then switch on airplane mode and reload.
