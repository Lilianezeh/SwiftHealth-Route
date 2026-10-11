# Map view (Phase 5B-2): plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and checks
that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (FR-07, US-01, US-03, NFR-01, NFR-07, NFR-10) in every commit and
test. Tick a box with its commit hash only when the step is really done. Check `git branch --show-current` before every
commit and push, and never push to `main` (CLAUDE.md). The pull request stays a draft until the merge checklist in
[validation.md](validation.md) is ticked.

## Files

| File | Change |
| --- | --- |
| `specs/frontend/ui-spec.md` | `ResultsMap`, `MapPopup`, `ViewToggle` rows; 2.3 toggle, address and "Map view" (Task 0) |
| `specs/2026-10-11-map-view/` | This folder (Task 0) |
| `specs/roadmap.md`, `LOG.md` | Status; the three reminders (Task 0) |
| `frontend/package.json`, `package-lock.json` | Task 1: exact pins for `leaflet` and `@types/leaflet`; `react-leaflet` removed |
| `frontend/src/config/map.ts` | Task 1: tile address, credit text, default centre and zoom, limits |
| `frontend/src/lib/search/searchView.ts` | Task 1: `readView`, `withView` (the `view` part of the address) |
| `frontend/src/lib/map/coordinates.ts` | Task 1: which results have a real position |
| `frontend/src/lib/map/mapIcons.ts` | Task 2: the pin and the position dot (`divIcon`) |
| `frontend/src/styles/map.css` | Task 2: pin and dot styles, 48 px buttons, 16 px credit (tokens only); imported by `ResultsMap` |
| `frontend/src/components/search/MapPopup.tsx` | Task 2: the popup content |
| `frontend/src/components/search/ResultsMap.tsx` | Task 2: the Leaflet map (client component) |
| `frontend/src/components/search/ViewToggle.tsx` | Task 3: the `List \| Map` buttons |
| `frontend/src/components/search/SearchResults.tsx` | Task 3: reads the view, loads `ResultsMap` on demand, shows list or map |
| `frontend/src/components/search/SearchBox.tsx`, `FiltersDialog.tsx` | Task 3: keep `view=map` when searching or applying filters |
| `frontend/tests/unit/` | New: `package-pins`, `searchView`, `mapCoordinates`, `mapIcons`, `MapPopup`, `ResultsMap`, `ViewToggle`; changed: `SearchPage`, `SearchBox`, `FiltersDialog`, `design-tokens` |

No backend change, no new table, no new package beyond the pins. If Leaflet cannot be tested in jsdom for one of the checks
below, test the pure helper in a test and keep that check in the smoke test of [validation.md](validation.md); say so there.

## Tasks

### Task 0: Spec
- [ ] Write this folder, the UI spec ("Map view", the three component rows, the toggle line, the address sentence), the roadmap
  status and the three `LOG.md` reminders (Search this area, tile provider review, tiles on the Privacy page). Commit:
  `docs(specs): map view, spec (FR-07, US-01, US-03, NFR-10)`.

### Task 1: Packages and the small pure parts (tests first)
- [ ] Write the tests (names in [validation.md](validation.md)): the package pins, `readView` and `withView`,
  `hasRealCoordinates` and `mapPoints`, and the map constants. They fail: the files do not exist and `package.json` has `^`
  ranges and `react-leaflet`.
- [ ] In the frontend container: `npm uninstall react-leaflet`, then `npm install --save-exact leaflet@1.9.4` and
  `npm install --save-dev --save-exact @types/leaflet@1.9.22`. Check with `git diff package.json` that only these three
  lines changed. Write `config/map.ts`, `searchView.ts` and `coordinates.ts`.
- [ ] Run `npm run lint`, `npm run typecheck` and `npm test`, then commit:
  `feat(web): exact Leaflet pins and the view helpers for the map (FR-07, NFR-07)`.

### Task 2: The map itself (tests first)
- [ ] Write the tests for `mapIcons`, `MapPopup` and `ResultsMap` (real Leaflet in jsdom: markers, popups, focus, attribution)
  and the token checks in `design-tokens.test.ts` for `map.css`. They fail.
- [ ] Write `mapIcons.ts`, `map.css`, `MapPopup.tsx` and `ResultsMap.tsx`. The popup content is rendered with React into the
  popup element and removed when the popup closes, so no component is left mounted.
- [ ] Run `npm run lint`, `npm run typecheck` and `npm test`, then commit:
  `feat(web): the results map with pins, popups and the position dot (FR-07, US-03, NFR-10)`.

### Task 3: The toggle and the page (tests first)
- [ ] Write the tests for `ViewToggle` and the changes of `SearchPage`, `SearchBox` and `FiltersDialog`: the list is the default,
  `view=map` shows the map, the toggle adds a history entry, searching and applying filters keep `view=map`, no second request,
  and the address never holds a position, centre or zoom. They fail.
- [ ] Write `ViewToggle`, load `ResultsMap` with a dynamic import in `SearchResults`, and keep `view` in `SearchBox` and
  `FiltersDialog`.
- [ ] Run `npm run lint`, `npm run typecheck` and `npm test`, then commit:
  `feat(web): List and Map toggle on the results page (FR-07, US-01, NFR-01)`.

### Task 4: Wrap-up
- [ ] Run `npm run build` and write the first-load weight of `/search` and the map chunk in [validation.md](validation.md)
  (the list view must stay at about 115 kB). Push the branch and open the draft pull request. Check that `Frontend CI` ran and
  `Backend CI` did not; write what `gh pr checks` shows.
- [ ] The owner does the smoke test (DevTools at 320 px, a real phone, keyboard only). Then update the roadmap and `LOG.md`
  once, and tick the boxes with their commit hashes.
