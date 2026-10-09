# Search frontend: Find page and results page (Phase 5B-1): plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and
checks that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (US-01, US-05, FR-01, FR-03 to FR-06, FR-08, NFR-01, NFR-04,
NFR-07, NFR-10) in every commit and test. Tick a box with its commit hash only when the step is really done. Check
`git branch --show-current` before every commit and push, and never push to `main` (CLAUDE.md).

**Order constraint:** start only after the [GET /meta feature](../2026-10-09-meta-endpoint/plan.md) (5B-0, with the
services list) and the Node 24 chore (roadmap, between 5B-0 and 5B-1) are merged and deployed. Nothing under `backend/` changes here, so `Backend CI` must not run on this pull request (checked in
Task 7).

## Files

| File | Change |
| --- | --- |
| `specs/frontend/ui-spec.md` | Task 0: section 1, the results list is a client component; 2.2, the "near you" section, the location prompt and the Blood stub; 2.3, loading and waking-up states, location never in the address, the distance control needs a position, the service field |
| `specs/tech-stack.md` | Task 1: the five dev-only test packages with exact versions and the reason |
| `frontend/package.json`, `package-lock.json`, `vitest.config.ts` | Task 1: test packages; `.tsx` test files, the `@/` alias, `esbuild.jsx = "automatic"`, a setup file |
| `frontend/tests/setup.ts` | Task 1: jest-dom matchers and cleanup after each test |
| `frontend/src/types/api.ts` | `ListingSummary`, `CategorySummary`, `SearchResponse`, `MetaResponse` |
| `frontend/src/lib/api/request.ts` | New: `requestJson` with the 5 s notice, the 45 s limit and the three errors |
| `frontend/src/lib/api/search.ts`, `meta.ts` | New: `searchListings`, `getMeta` (the only code that calls these endpoints) |
| `frontend/src/lib/search/searchQuery.ts` | New: filters to and from a query string (plain functions) |
| `frontend/src/lib/location/locationStore.ts` | New: the `sessionStorage` wrapper (position rounded to 3 decimals, area, refusal) |
| `frontend/src/lib/formatters/distance.ts`, `dates.ts` | New: "1.4 km away", "Verified 3 days ago" |
| `frontend/src/hooks/useLocation.ts`, `useSearchResults.ts`, `useMeta.ts` | New: ask for the position; load results with the states and Load more; load the lists |
| `frontend/src/config/search.ts` | New: the five shortcuts (label and slug), the distance choices, the time limits |
| `frontend/src/components/listings/` | `ListingCard`, `CallButton`, `DirectionsButton`, `OpenNowBadge`, `VerifiedDate` |
| `frontend/src/components/search/` | `SearchBox`, `CategoryShortcuts`, `LocationPrompt`, `NearbySuggestions`, `FiltersDialog`, `ResultsList`, `SearchStatus` |
| `frontend/src/app/(public)/find/page.tsx`, `search/page.tsx`, `blood/page.tsx` | The two pages and the Blood stub |
| `frontend/tests/unit/*.test.ts`, `*.test.tsx` | New (names in [validation.md](validation.md)) |
| `specs/roadmap.md`, `LOG.md` | Phase 5B-1 status; the day's entry |

## Tasks

### Task 0: Spec (done, this commit)
- [x] Update the UI spec as listed in the Files table (spec first), then commit:
  `docs(specs): UI spec for the Find page, the near-you section and the results states (FR-01, FR-03, FR-05)`.
  (The feature folders themselves were committed with the 5B-0 spec.)

### Task 1: Test tooling (done, this commit)
- [x] Choose the five versions for Node 24 by the rule in decision 10 (check each with `npm view`), install them with
  exact versions (`npm install --save-exact --save-dev` inside the frontend container), update `vitest.config.ts` and add `tests/setup.ts`. Write one small component test first (a heading
  renders) and watch it fail without the config, then pass with it.
  (Before the packages and the config, the new `.tsx` test was not even picked up: the old config only collected
  `*.test.ts`, so its 4 tests did not run. After the config: 16 of 16 tests pass.)
- [x] Add the packages and the reason to [tech-stack.md](../tech-stack.md).
- [x] Run lint, typecheck and tests, then commit: `chore(web): component test tooling, exact versions (NFR-10)`.

### Task 2: Types and the API layer (tests first, with fake timers) (done, this commit)
- [x] Write the tests for `request.ts`, `search.ts`, `meta.ts` and `searchQuery.ts` first; they fail (4 test files
  failed with "Cannot find module"). A fifth file, `api-boundary.test.ts`, guards the layers and passed from the start.
- [x] Write the types, `requestJson` (5 s notice, 45 s limit, cancel), `searchListings`, `getMeta` and the query functions.
- [x] Run lint, typecheck and tests (73 of 73 pass), then commit: `feat(web): search and meta API client with a 45 s limit and a waking-up notice (US-01, FR-04, FR-05)`.

### Task 3: Location (tests first)
- [ ] Write the tests for `locationStore.ts` and `useLocation.ts` first (a fake `navigator.geolocation`).
- [ ] Write the store (rounding, remembered refusal, area) and the hook (idle, asking, granted, denied, unavailable,
  timed out). The browser prompt only runs after a call from a button.
- [ ] Run lint, typecheck and tests, then commit: `feat(web): location in session storage, asked once (FR-03, NFR-07)`.

### Task 4: Cards and small parts (tests first)
- [ ] **Before starting:** the owner shares the Figma Make details (decision 13). List every difference from the UI spec
  in the "Design differences" table of [validation.md](validation.md); the UI spec wins.
- [ ] Write the tests for the formatters, the badge, the date, the two buttons and `ListingCard` first.
- [ ] Write them. Check tap size classes (48 px), text size (16 px), words as well as colour, the link formats.
- [ ] Run lint, typecheck and tests, then commit: `feat(web): ListingCard, call and directions buttons, open and verified labels (FR-06, FR-08, NFR-10)`.

### Task 5: The Find page (tests first)
- [ ] Write the tests for `SearchBox`, `CategoryShortcuts`, `LocationPrompt`, `NearbySuggestions` (two independent cards,
  empty message, error and Retry) and the page first.
- [ ] Write them, the `/find` page and the `/blood` "Coming soon" stub.
- [ ] Run lint, typecheck and tests, then commit: `feat(web): Find page with category shortcuts and near-you suggestions (FR-01, FR-03, US-01)`.

### Task 6: The results page (tests first)
- [ ] Write the tests for `useSearchResults` (loading, the notice at 5 s, the limit at 45 s, Retry, Load more, a new search
  cancels the old one), `FiltersDialog`, `ResultsList`, `SearchStatus` and the page first.
- [ ] Write them and the `/search` page (a server shell with the results in a `Suspense` client part).
- [ ] Run lint, typecheck and tests, then commit: `feat(web): results page with filters, load more and slow-API states (US-01, US-05, FR-04 to FR-06)`.

### Task 7: Wrap-up
- [ ] Run the checks, `npm run build` and the smoke test in [validation.md](validation.md): DevTools (Slow 3G, 320 px, a paused
  backend), then the phone on the Netlify deploy preview (the owner adds the preview address to `CORS_ORIGINS` first).
- [ ] Push the branch and open the draft pull request. Check that `Backend CI` did not start and `Frontend CI` did, and
  write what `gh pr checks` shows in [validation.md](validation.md).
- [ ] Update `LOG.md`, the [roadmap](../roadmap.md), the UI spec if the build changed anything, and tick the boxes in
  this folder with their commit hashes. Give the owner the merge steps and the clean-up (remove the preview address from
  `CORS_ORIGINS`), written for a beginner.
