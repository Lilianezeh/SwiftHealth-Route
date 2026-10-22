# /blood offline: plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, IDs (US-15, FR-27, NFR-03, NFR-07, NFR-10); `git branch --show-current` before every commit and push; draft PR.

## Files

| File | Change |
| --- | --- |
| `frontend/public/sw.js`, `tests/unit/serviceWorker.test.ts` | Task 1: `/blood` is a page the worker keeps |
| `frontend/src/components/offline/RegisterServiceWorker.tsx` (moved from `components/emergency/`), `tests/unit/RegisterServiceWorker.test.tsx`, `app/(public)/emergency/page.tsx`, `app/(public)/blood/page.tsx` | Task 1 |
| `frontend/src/lib/blood/offlineCopy.ts`, `tests/unit/bloodOffline.test.ts` | Task 2: the saved list |
| `frontend/src/hooks/usePagedList.ts`, `components/blood/BloodFinder.tsx`, `OfflineBloodBanks.tsx`, `SavedBloodBankCard.tsx`, `tests/unit/BloodPages.test.tsx` | Task 3: save and show offline |
| `frontend/tests/end-to-end/blood.spec.ts` | Task 4: layout offline at four widths, and the offline test on a production build |
| `specs/frontend/ui-spec.md` (2.6) | Task 0 |

## Tasks

### Task 0: Spec
- [x] This folder and ui-spec 2.6.
### Task 1: the worker keeps `/blood` (tests first)
- [x] `sw.js`, the registration component with a page path.
### Task 2: the saved list (tests first)
- [x] Save, read, no distance, no position, damaged copy, storage that throws.
### Task 3: the page saves and shows it (tests first)
- [x] Network failure with a copy: the notice, the saved banks, the chips, Try again; API error: Retry; no copy: Retry; the extra quiet request when a position or a group is used.
### Task 4: real-browser checks
- [x] 320, 360, 768 and 1024 px (layout offline); the offline test on a production build (passed).
