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
| `frontend/tests/unit/`, `tests/helpers/map.ts` | New: `package-pins`, `searchView`, `mapCoordinates`, `mapConfig`, `mapIcons` (with the `map.css` checks), `MapPopup`, `ResultsMap`, `ViewToggle`, `SearchMapView`; changed: `SearchBox`, `FiltersDialog` |

No backend change, no new table, no new package beyond the pins. If Leaflet cannot be tested in jsdom for one of the checks
below, test the pure helper in a test and keep that check in the smoke test of [validation.md](validation.md); say so there.

## Tasks

### Task 0: Spec (done, `65fb82e`)
- [x] Write this folder, the UI spec ("Map view", the three component rows, the toggle line, the address sentence), the roadmap
  status and the three `LOG.md` reminders (Search this area, tile provider review, tiles on the Privacy page). Commit:
  `docs(specs): map view, spec (FR-07, US-01, US-03, NFR-10)`. The same commit changed the toggle to add a history entry
  (owner's decision, 2026-10-11).

### Task 1: Packages and the small pure parts (tests first) (done, `70412e7`)
- [x] Write the tests (names in [validation.md](validation.md)): the package pins, `readView` and `withView`,
  `hasRealCoordinates` and `mapPoints`, and the map constants. They fail: the files do not exist and `package.json` has `^`
  ranges and `react-leaflet`.
- [x] In the frontend container: `npm uninstall react-leaflet`, then `npm install --save-exact leaflet@1.9.4` and
  `npm install --save-dev --save-exact @types/leaflet@1.9.22`. Check with `git diff package.json` that only these three
  lines changed. Write `config/map.ts`, `searchView.ts` and `coordinates.ts`.
- [x] Run `npm run lint`, `npm run typecheck` and `npm test`, then commit:
  `feat(web): exact Leaflet pins and the view helpers for the map (FR-07, NFR-07)`.
- [x] The owner moved the default centre to the Holy Ghost Cathedral (6.4361, 7.4881): `8cfc39f`,
  `fix(web): default map centre at the Holy Ghost Cathedral, Enugu (FR-07)`.

### Task 2: The map itself (tests first) (done, `8722137`)
- [x] Write the tests for `mapIcons`, `MapPopup` and `ResultsMap` (real Leaflet in jsdom: markers, popups, focus, attribution)
  and the checks of `map.css` (in `mapIcons.test.ts`, as rule text). They fail.
- [x] Write `mapIcons.ts`, `map.css`, `MapPopup.tsx` and `ResultsMap.tsx`. The popup content is rendered by React into one
  element per pin (a portal); Leaflet puts that element in the popup when it opens, and everything is removed with the map.
  Enter and Space are handled on `keydown` (Leaflet's own Enter check reads the deprecated `keyCode`, which the test tool does
  not send, and a second handler would toggle the popup closed again).
- [x] Run `npm run lint`, `npm run typecheck` and `npm test`, then commit:
  `feat(web): the results map with pins, popups and the position dot (FR-07, US-03, NFR-10)`.

### Task 3: The toggle and the page (tests first) (done, `12f918c`)
- [x] Write the tests for `ViewToggle` and the page (`SearchMapView.test.tsx`, a new file) and the changes of `SearchBox` and
  `FiltersDialog`: the list is the default, `view=map` shows the map, the toggle adds a history entry, searching and applying
  filters keep `view=map`, no second request, and the address never holds a position, centre or zoom. They fail.
- [x] Write `ViewToggle`, load `ResultsMap` with a dynamic import in `SearchResults`, and keep `view` in `SearchBox` and
  `FiltersDialog`.
- [x] Run `npm run lint`, `npm run typecheck` and `npm test`, then commit:
  `feat(web): List and Map toggle on the results page (FR-07, US-01, NFR-01)`.

### Task 4: Wrap-up
- [x] Run `npm run build` and write the first-load weight of `/search` and the map chunk in [validation.md](validation.md)
  (118 kB, accepted by the owner; the list view was 115 kB).
- [x] Push the branch and open the draft pull request (#19, `d2df649`). `Frontend CI` ran and passed, `Backend CI` did not run;
  `gh pr checks` and the link of the Netlify preview are in [validation.md](validation.md).
- [x] The owner did the smoke test on the preview (laptop, 320 px, keyboard only, and an Honor phone): all passed. The boxes of
  [validation.md](validation.md) are ticked, and the roadmap and `LOG.md` say so.
- [ ] Merge by the owner. Then the roadmap and `LOG.md` change from "in progress" to "done (merged, PR #19)".
