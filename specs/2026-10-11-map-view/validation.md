# Map view (Phase 5B-2): validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-07, US-01, US-03, NFR-01, NFR-04, NFR-07 or NFR-10. Tick a box only after the
test exists and passes.

## How to run

The commands run in the frontend container:
- Lint: `docker compose exec frontend npm run lint`
- Types: `docker compose exec frontend npm run typecheck`
- Tests: `docker compose exec frontend npm test`
- Build and page weight: `docker compose exec frontend npm run build` (read "First Load JS" for `/search`, and the size of
  the map chunk), then `rm -rf .next` in the container and restart it

## Tests per task

### Task 1: `package-pins.test.ts`, `searchView.test.ts`, `mapCoordinates.test.ts`, `mapConfig.test.ts`
- [ ] `package.json pins leaflet and @types/leaflet to exact versions, with no ^ or ~`
- [ ] `package.json does not have react-leaflet, and neither does the lock file`
- [ ] `readView gives "map" only for view=map, and "list" for no view, view=list, view=MAP, view=maps or an empty value`
- [ ] `withView adds view=map to a query, keeps every other part, and removes view for the list`
- [ ] `withView never adds lat, lng, a centre or a zoom` (NFR-07)
- [ ] `hasRealCoordinates accepts real positions and rejects NaN, Infinity, latitude over 90 and longitude over 180`
- [ ] `mapPoints keeps the results with a real position and tells how many were left out`
- [ ] `the tile address is the OpenStreetMap one, holds only {z}, {x} and {y}, and the credit text names OpenStreetMap contributors`

### Task 2: `mapIcons.test.ts`, `MapPopup.test.tsx`, `ResultsMap.test.tsx`, `design-tokens.test.ts`
- [ ] `the pin is an inline SVG with no image file, and uses forest and white from the tokens`
- [ ] `no map style or icon uses red, the emergency token, or a hand-written hex or rgb colour`
- [ ] `the position dot is a different shape and a different colour from the pin`
- [ ] `MapPopup shows the name as a link to the listing, the category with the distance, the open badge, Call and Directions`
- [ ] `MapPopup shows the Sponsored tag only for a sponsored result, and no Call button without a phone number`
- [ ] `MapPopup shows a name with HTML in it as text, never as markup`
- [ ] `ResultsMap puts one pin on the map for each result with a real position`
- [ ] `ResultsMap skips a result with no real position and says how many places are missing, and to switch to List`
- [ ] `ResultsMap shows the visitor's position as a dot only when it is given, and the line "Your position"`
- [ ] `ResultsMap shows the OpenStreetMap credit as a link to the OpenStreetMap copyright page`
- [ ] `ResultsMap has an accessible name, and each pin has the name and the category as its accessible name`
- [ ] `a pin is reachable with Tab, and Enter opens its popup`
- [ ] `when a popup opens, focus moves into it; Escape closes it and focus goes back to the pin`
- [ ] `ResultsMap adds pins when more results are given, and removes the ones that are gone`
- [ ] `ResultsMap removes the map and the popup content when it is unmounted` (no leftover listeners or roots)
- [ ] `ResultsMap does not write to sessionStorage, localStorage, cookies or the address, and does not call fetch` (tiles are images)
- [ ] `map.css makes the popup close button and the zoom buttons at least 48 px, and the credit 16 px`

### Task 3: `ViewToggle.test.tsx`, `SearchPage.test.tsx`, `SearchBox.test.tsx`, `FiltersDialog.test.tsx`
- [ ] `ViewToggle has a List and a Map button in a group, marks the current one with aria-pressed, and each is 48 px high`
- [ ] `the /search page shows the list by default, with no map and no Leaflet loaded`
- [ ] `the /search page with view=map shows the map and not the list`
- [ ] `tapping Map pushes the address with view=map and keeps the filters; tapping List pushes it without view` (push, not replace)
- [ ] `tapping the view that is already shown changes nothing and adds no history entry`
- [ ] `Apply and Clear filters in map view still replace the address, and keep view=map` (replace, not push)
- [ ] `switching between List and Map does not call the API again`
- [ ] `the list view has the same cards, in the same order, whether or not the map was shown before` (the list stays complete)
- [ ] `the count line, the loading, waking-up, error and empty states are the same in the map view, and no map shows without results`
- [ ] `Load more in the map view adds pins and keeps the Load more button`
- [ ] `searching again from the search box keeps view=map` (a hidden field)
- [ ] `Apply and Clear filters in the Filters sheet keep view=map`
- [ ] `the address never contains lat, lng, a centre or a zoom in either view`, with a stored position
- [ ] `a shared link with view=map and a lat and lng in it ignores the position`
- [ ] The existing tests of the search page, search box and Filters sheet still pass.

## Review-focus edge cases

- [ ] **One result, no result, same place.** One pin gives a close zoom (no error from fitting a single point); two results at
  the same position both have a pin; no results shows the empty message and no map.
- [ ] **A result with no real position.** Not on the map, still in the list, and the map says how many are missing.
- [ ] **Position dot only with a position.** An area with no position shows pins only. The dot is not a tab stop.
- [ ] **Back and forward.** Each tap on the toggle that changes the view adds a history entry. List, Map, Back shows the list
  again with its filters; Forward shows the map. After a filter is applied on the map, Back goes to the list.
- [ ] **Slow 3G.** The list view loads no Leaflet. The map chunk loads only on the tap (or with `view=map`), with the skeleton
  while it loads.
- [ ] **A facility name with `<script>` or `&` in it** is text in the pin's accessible name and in the popup.
- [ ] **Leaflet in jsdom.** Any check that jsdom cannot run (real tiles, pinch zoom, popup placement) is listed here and done in
  the smoke test: _(fill in during Task 2)_.

## Security checklist

- [ ] No `dangerouslySetInnerHTML`, no `innerHTML` and no HTML string for a popup or a pin that holds API text:
  `git grep -n "dangerouslySetInnerHTML\|innerHTML\|bindPopup\|setContent" frontend/src` is checked by hand. The only HTML
  string is the fixed SVG of the pin.
- [ ] The visitor's position is used only to draw the dot in the browser. It is not in the address, not stored by the map, not
  sent anywhere by the map code; tile requests carry only `{z}/{x}/{y}` (an area of the map, no position of the visitor).
- [ ] The tile address is `https` and written only in `config/map.ts`.
- [ ] No new package except the pins; `react-leaflet` and `@react-leaflet/core` are gone from the lock file; no `.env` change,
  no secret.
- [ ] Links in popups: Directions opens in a new tab with `rel="noopener noreferrer"` (the existing component), and the
  OpenStreetMap credit link has the same.

## Smoke test (owner, after the pull request has a preview)

- [ ] DevTools at 320 px: `/search?category=pharmacy` shows the list; tap **Map**; the address gets `view=map` and nothing else
  changed; the map, pins and credit fit; no sideways scrolling.
- [ ] Tap a pin: the popup shows the name, category and distance, Call and Directions; Directions opens Google Maps with the
  place; Call starts a call on a phone.
- [ ] Allow the location: the dark dot appears with "Your position" under the map; the pins stay blue; nothing is red.
- [ ] Keyboard only: Tab reaches the toggle, then the map, the pins, the popup's name link, Call and Directions; Esc closes the
  popup and focus returns to the pin; arrow keys and + / − move and zoom the map.
- [ ] Open `/search?view=map&open_now=true` in a new tab and from a shared link: the map opens fitted to the results, with no
  position. Reload: same.
- [ ] Apply a filter and search again from the box in map view: still the map.
- [ ] On a real phone on mobile data: the list loads as before; the map loads after the tap; tiles show; pinch zoom works.

## Merge checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` are clean. Record the first-load weight of `/search`
  (it was 115 kB) and the map chunk here: _(fill in)_.
- [ ] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run. Write what `gh pr checks`
  shows: _(fill in)_.
- [ ] `git diff --stat origin/main -- backend` is empty.
- [ ] The UI spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date, including the three reminders.
- [ ] The smoke test above is done on the preview or the live site.
- [ ] The pull request stays a draft until every box above is ticked.
