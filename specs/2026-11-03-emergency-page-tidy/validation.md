# Validation: SwiftRescue (/emergency) tidy-up

## Automatic

- [ ] `npm run lint`, `npm run typecheck` and `npx vitest run --maxWorkers=2` pass (backend untouched).
- [ ] Browser: `swiftrescue.spec.ts` (banner below the 112 card, side by side, CLS 0, the current-page button, the two location buttons), `signup.spec.ts` and
  `home-layout.spec.ts` (the header) pass.
- [ ] Faces: the whole face of each photo is at least 8 px inside the 5:3 phone box (maths in `EmergencyBanner.test.tsx`).

## By eye (Light and Dark, 360 and 768 px)

- [ ] 112 card first, then the banner, then the share buttons; the first contacts are not far below.
- [ ] The header's SwiftRescue is red and is not a link on this page; on another page it is a link again.
- [ ] No heading "Share my location" or "Share emergency list"; "Send my location to someone" and "Sort by distance from me" are clearly apart.
- [ ] Each card has one verification line, amber with "check due" when due.
- [ ] No red cross anywhere; 112 and Call 112 look as before.

## Offline (production build or the preview)

- [ ] After one visit, airplane mode: `/emergency` opens with the banner (the worker keeps both photos).
