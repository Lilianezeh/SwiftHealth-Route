# SwiftRescue order: validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results (2026-10-22, branch `feature/swiftrescue-order`)

- Frontend: `vitest` **1455 passed** (104 files); `tsc --noEmit` and `next lint` clean. 13 new tests in `EmergencyPage.test.tsx` (written first and red:
  13 failed before the change), none removed.
- Real browser at 320, 360, 768 and 1024 px: `swiftrescue.spec.ts` **24 passed, 1 skipped** (the offline check needs a production build and was not run here).
  The new check uses a fake API with every group empty: Ambulance and Fire first with the text twice, the other empty groups hidden, the blood card below the groups,
  the pharmacies below the card, the card 48 px or more high with 16 px text, no icon, and not the red of 112.
- Backend: not touched.

## Checklist
- [x] 112 is still the first thing on the page, and the sentence of FR-26 is unchanged (the existing tests still pass)
- [x] Nothing says "Sponsored" or "Featured" (FR-19: the existing test scans the whole page, with the new card on it); the blood card has no cross symbol and no red
- [x] All text is 16 px or more and every link is 48 px or more high (NFR-10)
- [x] Lint, typecheck, tests clean; real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] The pull request stays a draft until the owner has looked at `/emergency` on a phone.
