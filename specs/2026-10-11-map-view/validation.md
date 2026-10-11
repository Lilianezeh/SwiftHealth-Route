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

Each test failed first (the files did not exist, or `package.json` had `^` ranges) and passes now. 507 tests in total, 100 of
them new in this feature (407 before).

### Task 1: `package-pins.test.ts`, `searchView.test.ts`, `mapCoordinates.test.ts`, `mapConfig.test.ts` (done, `70412e7`; centre `8cfc39f`)
- [x] `pin leaflet to one exact 1.x version, with no ^ or ~`, and `pin @types/leaflet to one exact version, with no ^ or ~`
- [x] `do not include react-leaflet, in package.json or in the lock file`
- [x] `readView gives map only for view=map`, `gives list for no view, view=list, view=MAP, view=maps or an empty value`, and
  `gives list when view is given twice and the first is not map`
- [x] `withView adds view=map to a query and keeps every other part in its order`, `removes view for the list and keeps the other
  parts`, `does not add view twice`, and `accepts a query that starts with a question mark, and gives one without it`
- [x] `withView never adds lat, lng, a centre or a zoom (NFR-07)`
- [x] `hasRealCoordinates accepts a real position, the edges of the world and zero`; `rejects NaN and Infinity`; `rejects a
  latitude over 90 and a longitude over 180, in both directions`; `rejects a value that is not a number, such as null`
- [x] `mapPoints keeps the results with a real position, in the same order`; `leaves out the results with no real position and
  tells how many`; `keeps two results at the same position`; `gives nothing and no missing results for an empty list`
- [x] `the tile address is the https OpenStreetMap tile server` and `holds only the {z}, {x} and {y} of a tile`
- [x] `the credit names OpenStreetMap contributors and links to the OpenStreetMap copyright page`, and `opens the link safely`
- [x] `the default centre is the Holy Ghost Cathedral in Enugu city` (6.4361, 7.4881, owner's choice), and `the zooms stay in the
  range the OpenStreetMap tiles have`

### Task 2: `mapIcons.test.ts`, `MapPopup.test.tsx`, `ResultsMap.test.tsx` (done, `8722137`)
The map styles are checked in `mapIcons.test.ts` (as rule text: jsdom draws no CSS).
- [x] `the pin is an inline SVG with no image file`, `is hidden from screen readers`, `is at least 48 px wide and high, with its
  tip on the place`, and `takes its colours from classes, so the stylesheet decides them (tokens only)`
- [x] `the position dot is a different shape from the pin: no SVG, a plain round element`, and `is hidden from screen readers`
- [x] `the map styles paint the pin forest blue with a white plus, and the dot ink with a white ring`
- [x] `the map styles never use red, the emergency colour, or a hand-written hex, rgb or hsl colour`
- [x] `the map styles make the popup close button and the zoom buttons 48 px wide and high`, `make the credit and the popup text
  16 px`, and `let the buttons in a popup keep their own colours`
- [x] `MapPopup shows the name as a link to the listing, and the category with the distance`, `shows the open badge in words`,
  `has a Call button with the number and a Directions button with the place`, and `has no Call button without a phone number,
  but still has Directions`
- [x] `MapPopup shows the Sponsored tag only for a sponsored result`
- [x] `MapPopup shows a name with HTML in it as text, never as markup`
- [x] `ResultsMap puts one pin on the map for each result with a real position`, and `puts two results at the same position on the
  map, both with a pin`
- [x] `a result with no real position gets no pin, and the map says how many places are missing and to switch to List`, `says it
  in the plural for two or more`, `says nothing when every result has a position`, and `still shows a map, at the default
  place, when no result has a position`
- [x] `the visitor's position is a dot with the line Your position under the map, when there is a position`, `is not shown, and
  not mentioned, when there is no position`, and `is not a tab stop and not a button, and is not counted as a pin`
- [x] `the map and its tiles: shows the OpenStreetMap credit as a link to the copyright page, and no Leaflet prefix`
- [x] `the map has an accessible name and can be reached with the keyboard`, and `each pin has the name and the category as its
  accessible name`, also for a name with HTML in it
- [x] `reaches a pin with Tab from the map`, `opens the popup of a pin with Enter, with Call and Directions in it`, `with
  Space`, and `with a tap or a click`
- [x] `moves focus to the name link when a popup opens, so Call and Directions are one Tab away`
- [x] `closes the popup with Escape and puts focus back on its pin`, and `shows only one popup at a time`
- [x] `shows no popup content, and no Call or Directions button, until a pin is opened`
- [x] `adds pins when more results are given, and removes the ones that are gone`
- [x] `removes the map when it is unmounted, without errors`
- [x] `does not write to the storage, the cookies or the address, and does not call fetch (NFR-07)`
- [x] `opens close up on one pin, with tiles only from the OpenStreetMap address`

### Task 3: `ViewToggle.test.tsx`, `SearchMapView.test.tsx`, `SearchBox.test.tsx`, `FiltersDialog.test.tsx` (done, `12f918c`)
In `SearchMapView.test.tsx` the map is a stand-in that lists its pins; the real Leaflet is tested in `ResultsMap.test.tsx`.
- [x] `ViewToggle has a List and a Map button in one named group`, `marks the current view with aria-pressed`, `makes each
  button at least 48 px high, with text of 16 px or more`
- [x] `ViewToggle tells the page which view was chosen when the other button is tapped`, and `does nothing when the view that is
  already shown is tapped`
- [x] `the list is the default: shows the cards and no map when the address has no view`, and `shows the list for view=list,
  view=MAP and any other value`
- [x] `loads the map code only when it is needed (a dynamic import, no server rendering)`
- [x] `the map view shows the map with the same results, and not the cards, for view=map`
- [x] `the toggle adds view=map to the address and keeps the filters, with a new history entry (push, not replace)`, `removes
  view from the address when List is tapped, with a new history entry`, and `gives /search?view=map, and back to /search, when
  there are no filters`
- [x] `the toggle does nothing when the view that is already shown is tapped` (no push, no replace)
- [x] `the toggle does not ask the API again when the view changes, and the list is the same afterwards`
- [x] `keeps a result without a position in the list (only the map leaves it out)`
- [x] `the map view keeps the count line above the results`, `shows no map while loading, and the same skeleton as the list`,
  `shows the error with Retry, and no map`, and `shows the empty message, and no map, when nothing matches`
- [x] `the map view keeps Load more, and Load more adds pins`
- [x] `SearchBox keeps the map view when searching again: a hidden view=map field, and none for the list`, and the same on the
  page (`has a hidden view=map field in the search box in the map view, and none in the list view`)
- [x] `FiltersDialog: Apply keeps view=map in the address, and still replaces the history entry`; `Clear filters keeps view=map`;
  `Apply and Clear leave the list view without a view field`
- [x] `the toggle never writes the position, a centre or a zoom into the address, with a stored position` (the calls are exactly
  `/search?view=map` and `/search`), and `the map view gives the stored position to the map, but never puts it in the page
  address`
- [x] `the map view ignores a position, a centre or a zoom in a shared link`, and `the toggle drops lat and lng of a shared link
  from the address when the view is changed`
- [x] The existing tests of the search page, search box and Filters sheet still pass.

## Review-focus edge cases

- [x] **One result, no result, same place.** One pin gives a close zoom (`opens close up on one pin`: tiles at zoom 15, no error
  from fitting a single point); two results at the same position both have a pin; no results shows the empty message and no map.
- [x] **A result with no real position.** Not on the map, still in the list, and the map says how many are missing.
- [x] **Position dot only with a position.** An area with no position shows pins only. The dot is not a tab stop.
- [x] **Back and forward.** The tests prove that each tap on the toggle that changes the view pushes an address and a filter
  replaces it. The real browser Back and Forward were checked in the smoke test (owner, laptop and phone: Back and Forward
  switch between List and Map, and Back from the map returns to the list).
- [x] **Slow 3G.** The build shows that Leaflet is not in the first load of `/search` (118 kB; the map is a separate 148 kB, 42.5 kB
  gzip, chunk). The owner checked in the smoke test that the map's JavaScript files load only after tapping Map (cache
  disabled, starting from the list, with Chrome throttled to 3G on a laptop). Not separately recorded: how the skeleton looks
  while the chunk loads.
- [x] **A facility name with `<script>` or `&` in it** is text in the pin's accessible name and in the popup (tests above).
- [x] **Leaflet in jsdom.** jsdom draws no CSS and has no layout, so these are checked only in the smoke test: the 48 px buttons,
  the 16 px credit, the white-on-blue Call button in a popup (`revert-layer`), the focus ring on a pin, the position of a popup
  and the pan that follows it, dragging and pinch zoom, real tiles, the real browser Back and Forward, and that the map's style
  file loads together with the map and not before.

## Security checklist

- [x] No `dangerouslySetInnerHTML`, no `innerHTML`, and no HTML string for a popup or a pin that holds API text. Checked on
  2026-10-11: `git grep -n "dangerouslySetInnerHTML\|innerHTML\|bindPopup\|setContent\|bindTooltip" frontend/src` finds only
  `bindPopup(popupElement, ...)` in `ResultsMap.tsx`, which is given a DOM element that React fills, never a string. The only
  HTML strings are the fixed pin and dot in `mapIcons.ts` and the fixed credit in `config/map.ts`.
- [x] The visitor's position is used only to draw the dot and to fit the map in the browser. It is not in the address, not
  stored by the map, not sent anywhere by the map code (tests: `does not write to the storage, the cookies or the address, and
  does not call fetch`); tile requests carry only `{z}/{x}/{y}`.
- [x] The tile address is `https` and written only in `config/map.ts` (`git grep tile.openstreetmap frontend/src`: one place).
- [x] No new package except the pins: `git diff origin/main -- frontend/package.json` changes `leaflet`, `@types/leaflet` and
  removes `react-leaflet`; the lock file has no `react-leaflet` or `@react-leaflet/core`; no `.env` change, no secret.
- [x] Links: Directions opens in a new tab with `rel="noopener noreferrer"` (the existing component, tested in `MapPopup`), and
  the OpenStreetMap credit link has `target="_blank"` and the same `rel` (tested in `mapConfig.test.ts`).

## Smoke test (owner, after the pull request has a preview)

Done by the owner on the preview of PR #19 (<https://deploy-preview-19--swifthealth-ng.netlify.app>), on a laptop and on an
Honor phone (on mobile data), 2026-10-11. The owner reported that all of the smoke tests passed. What the owner named:
- the map shows both pins framed together; the popups have Call (white on blue) and Directions; the zoom and close buttons are
  large; the OpenStreetMap credit is readable;
- Back and Forward switch between List and Map;
- keyboard Tab, Enter and Esc work on the pins;
- the map's JavaScript files load only after tapping Map (checked with the cache disabled, starting from the list);
- 320 px fits, with no page-level sideways scroll;
- on the phone: pinch zoom works, Call opens the dialler, Directions opens Google Maps, and Back returns to the list.

- [x] DevTools at 320 px: `/search?category=pharmacy` shows the list; tap **Map**; the address gets `view=map` and nothing else
  changed; the map, pins and credit fit; no sideways scrolling.
- [x] Tap a pin: the popup shows the name, category and distance, Call and Directions; Directions opens Google Maps with the
  place; Call starts a call on a phone. The Call button is white on blue (not blue on blue) and the buttons are 48 px high.
- [x] Allow the location: the dark dot appears with "Your position" under the map; the pins stay blue; nothing is red.
- [x] Keyboard only: Tab reaches the toggle, then the map, the pins, the popup's name link, Call and Directions; Esc closes the
  popup and focus returns to the pin; arrow keys and + / − move and zoom the map. The focus ring is visible on a pin.
- [x] Open `/search?view=map&open_now=true` in a new tab and from a shared link: the map opens fitted to the results, with no
  position. Reload: same.
- [x] Apply a filter and search again from the box in map view: still the map. Back from the map returns to the list.
- [x] The OpenStreetMap credit is visible at 16 px, with no sideways scrolling at 320 px, and the zoom and popup close buttons
  are easy to tap.
- [x] The list loads without the Leaflet chunk; it is fetched only when **Map** is tapped. (Owner: checked in the Network
  panel with the cache disabled, starting from the list, on a laptop with Chrome throttled to 3G. The laptop was on Wi-Fi
  through the owner's phone hotspot.)
- [x] On a real phone: the map loads after the tap; pinch zoom works. (Owner, Honor phone, on mobile data.)

## Merge checklist

- [x] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` are clean (2026-10-11, on `12f918c`): 507 tests pass;
  `/search` is 118 kB first load (it was 115 kB: the toggle and the dynamic-import runtime); `/find` is 115 kB. The map is a
  separate chunk of 148 kB (42.5 kB gzip) and its style file 3 kB (gzip), loaded only with the map. The colour variables that
  `map.css` uses (`--color-forest`, `--color-white`, `--color-ink`) are defined in the global style file of the build.
- [x] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run. What `gh pr checks 19` showed
  (2026-10-11, after `d2df649`): `frontend` **pass** (1m6s, run 38122443122); the only workflow run on the branch is Frontend
  CI (no Backend CI run); Netlify `Header rules` and `Redirect rules` pass, `Pages changed` skipping, `deploy-preview` pass:
  <https://deploy-preview-19--swifthealth-ng.netlify.app> (the smoke test link:
  <https://deploy-preview-19--swifthealth-ng.netlify.app/search?category=pharmacy>).
- [x] `git diff --stat origin/main -- backend` is empty (2026-10-11).
- [x] The UI spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date, including the three reminders (Task 0 and Task 4).
- [x] The smoke test above is done on the preview or the live site (owner, 2026-10-11, preview of PR #19).
- [x] The pull request stays a draft until every box above is ticked. (Every box is ticked; the pull request was marked ready
  on the owner's instruction, 2026-10-11.)

Note: this branch also carries `a534a6f` (the live results of the hours line, a docs-only commit that was not yet on `main`),
so the pull request shows it too.
