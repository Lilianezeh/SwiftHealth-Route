# SwiftRescue (Phase 7): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## How to run

- Backend: `docker compose exec backend pytest -q -W error` and `docker compose exec backend ruff check .`
- Frontend: `cd frontend && npm run lint && npm run typecheck && npm test`; the build: `npm run build`
- Real browser (the site and API running): `cd frontend && npx playwright test swiftrescue`

## Tests per task

Filled in at the end of the feature, with the real names and results.

## Security and privacy checklist

- [ ] The visitor's position is in no address, no log, no `localStorage`, no `sessionStorage` and no request to our API by Share my location (NFR-07, FR-24)
- [ ] The saved offline copy holds no distance and no position
- [ ] No `sponsored: true` and no word "Sponsored" or "Featured" anywhere on the page or in the answer (FR-19)
- [ ] No medical advice in the page text (CLAUDE.md)
- [ ] The service worker never keeps an answer of any other API address than `/emergency`, and never a request with `lat` or `lng`

## Smoke test (owner, on a phone, on the preview)

See the end of [requirements.md](requirements.md).

## Merge checklist

- [ ] Lint, typecheck, unit tests, build clean; numbers written here
- [ ] Both CIs green
- [ ] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] The owner checked the preview on a phone, including airplane mode
- [ ] The pull request stays a draft until every box above is ticked.
