# Plan: SwiftRescue (/emergency) tidy-up

Tests were written first, then the code. Tick each task with its commit hash at the end of the feature.

- [ ] 1. Tests: `EmergencyBanner.test.tsx` (replaces `GroupPhoto.test.tsx`), `VerificationLine.test.tsx`, `EmergencyShare.test.tsx`,
  `EmergencyPage.test.tsx`, `SiteHeader.test.tsx`, `homePerformance.test.tsx`; browser: `swiftrescue.spec.ts`.
- [ ] 2. Code: `EmergencyBanner.tsx` (new; `GroupPhoto.tsx` removed), `EmergencyGroups.tsx`, `ShareMyLocation.tsx`, `ShareEmergencyList.tsx`,
  `EmergencyContent.tsx`, `VerificationLine.tsx` (new), `EmergencyContactCard.tsx`, `EmergencyButton.tsx` (new), `HeaderNavigation.tsx`,
  `sitePhotos.ts`, the emergency page.
- [ ] 3. UI spec 2.5, this folder, LOG.md; full frontend suite, lint, typecheck; draft pull request with screenshots at 360 and 768 px in Light and Dark.
