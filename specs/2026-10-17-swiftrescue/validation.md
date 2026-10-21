# SwiftRescue (Phase 7): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## How to run

- Backend: `docker compose exec backend pytest -q -W error` and `docker compose exec backend ruff check .`
- Frontend: `cd frontend && npm run lint && npm run typecheck && npm test`; the build: `npm run build`
- Real browser (the site and API running): `cd frontend && npx playwright test swiftrescue`; the offline check needs a production build (see the header of `tests/end-to-end/swiftrescue.spec.ts`)

## Results (2026-10-20)

- Backend: **819 passed**, `ruff check` clean (19 of them are the new `tests/integration/test_emergency.py`).
- Frontend: lint and typecheck clean; **1008 unit tests passed** (the new ones: `emergencyShare`, `emergencyOffline`, `useEmergency`, `EmergencyPage`, `EmergencyShare`, `serviceWorker`, `RegisterServiceWorker`, `appIcons`, and 3 in `dates`).
- Build: `/emergency` is static, **6.12 kB own JavaScript, 116 kB first load** (NFR-01: under 500 KB).
- Real browser, 320, 360, 768 and 1024 px: **20 of 20 passed**, no sideways scroll, every control at least 48 px high, text 16 px or more, no "sponsored" or "featured" word, the share links hold 112 first, Share my location keeps the exact position out of storage, the address and every request to our API.
- Offline, on a production build with the real service worker: after one visit, with the network off, the page, 112, the "Offline — showing saved contacts from …" notice and the saved contacts all show (1 of 1 passed).
- Found and fixed on the way: the guard test `homeImages` refused my two PNG app icons (they are now a named exception); the offline test first passed for the wrong reason (a Playwright route answered while "offline"), so it now fails requests itself once the network is off.
- Not checked by me: a real phone, real WhatsApp and SMS apps, real 3G throttling. The owner's phone check is below.

## Tests per task

- Task 1 (`d5042c5`), `tests/integration/test_emergency.py`: 112 and the sentence with an empty database; all seven groups in order and empty ones `[]`; the listing summary shape; nearest first with a location, by name without; other categories left out; each non-published status never returned; overdue stays with `verification_due`; FR-22 flagged left out; nothing sponsored even when featured; 24-hour pharmacies only, nearest first, max 10, no distance limit; half or impossible location is 422; the number of queries does not grow.
- Task 2 (`9a4ea18`): `emergencyShare`, `emergencyOffline` (no distance saved), `useEmergency` (first request without a position, second with it, slow, error, offline copy).
- Task 3 (`fde142a`): `EmergencyPage`.
- Task 4 (`015ec5b`): `EmergencyShare`.
- Task 5 (`d884f5b`): `serviceWorker`, `RegisterServiceWorker`.
- Task 6 (`0e076c2`, `27c80d6`): `appIcons`, `swiftrescue.spec.ts`.

## Security and privacy checklist

- [x] The visitor's position is in no address, no log, no `localStorage`, no `sessionStorage` and no request to our API by Share my location (NFR-07, FR-24): unit tests and the real-browser check
- [x] The saved offline copy holds no distance and no position (it comes from a request without one)
- [x] No `sponsored: true` and no word "Sponsored" or "Featured" anywhere on the page or in the answer (FR-19): API test with a featured listing, unit test with a lying answer, real-browser check
- [x] No medical advice in the page text (unit test)
- [x] The service worker never keeps an answer of another address than the page and `/_next/static/` files, and never a request with `lat` or `lng` (unit tests)
- [x] No new package; no `dangerouslySetInnerHTML`; every text is rendered as text

## Smoke test (owner, on a phone, on the preview)

See the end of [requirements.md](requirements.md). Also: the SwiftRescue page has no real contacts in production yet (only the four non-emergency demo listings), so on the live site it shows "We are still adding verified contacts. In danger, call 112." plus the 24-hour pharmacy if the demo one is 24 hours. The grouped list can be seen locally with the seed.

## Merge checklist

- [x] Lint, typecheck, unit tests, build clean; numbers written above
- [ ] Both CIs green (checked after the pull request is opened)
- [x] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] The owner checked the preview on a phone, including airplane mode
- [ ] The pull request stays a draft until every box above is ticked.
