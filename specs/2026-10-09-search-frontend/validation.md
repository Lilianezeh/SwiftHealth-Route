# Search frontend: Find page and results page (Phase 5B-1): validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves US-01, US-05, FR-01, FR-03 to FR-06, FR-08, NFR-04, NFR-07 or NFR-10.
Tick a box only after the test exists and passes.

## How to run

The host has no Node, so the commands run in the frontend container:
- Lint: `docker compose exec frontend npm run lint`
- Types: `docker compose exec frontend npm run typecheck`
- Tests: `docker compose exec frontend npm test`
- Build and page weight: `docker compose exec frontend npm run build` (read "First Load JS" for `/find` and `/search`)

## Tests per task

### Task 1: `tests/unit/setup.test.tsx`
- [ ] `renders a heading in a jsdom page` (proves the config: `.tsx`, the `@/` alias, JSX, jest-dom matchers)

### Task 2: `request.test.ts`, `search.test.ts`, `meta.test.ts`, `searchQuery.test.ts`
All timing tests use `vi.useFakeTimers()`: no test waits for real time.
- [ ] `requestJson returns the parsed answer for a fast API`
- [ ] `requestJson calls onSlow once after 5 seconds and still returns the answer that comes later`
- [ ] `requestJson does not call onSlow when the answer comes before 5 seconds`
- [ ] `requestJson gives up after 45 seconds with an ApiTimeoutError` (checked at 44 999 ms and 45 000 ms)
- [ ] `requestJson throws ApiError with the status for a 4xx or 5xx answer` (404, 422, 500)
- [ ] `requestJson throws ApiNetworkError when fetch itself fails`
- [ ] `requestJson stops waiting when the caller cancels` (a new search cancels the old one; no timer is left running)
- [ ] `searchListings sends only the filters that are set` (no empty `q`, no `lat` without `lng`)
- [ ] `searchListings sends lat and lng together as plain numbers`
- [ ] `searchListings returns items and total typed as in the api-spec`
- [ ] `getMeta returns the five lists (areas, categories, services, blood groups, report reasons)` and
  `getMeta is fetched once and kept in memory`
- [ ] `filtersToQuery and queryToFilters round-trip every filter` (`q`, `category`, `service`, `area`, `open_now`,
  `is_24_hours`, `radius_km`)
- [ ] `queryToFilters ignores unknown, empty or invalid values` (`radius_km=abc`, `open_now=maybe`)
- [ ] `filtersToQuery never writes lat or lng` (NFR-07: no position in the address)
- [ ] `no code outside lib/api calls fetch` (a test that scans `src/` for `fetch(`)

### Task 3: `locationStore.test.ts`, `useLocation.test.tsx`
- [ ] `saves the position rounded to 3 decimals` (6.451234 becomes 6.451; 7.509876 becomes 7.51)
- [ ] `keeps the position in sessionStorage and never in localStorage or a cookie`
- [ ] `remembers a refusal for the tab and does not ask again`
- [ ] `saves and reads the chosen area; a position clears nothing it should not`
- [ ] `survives a sessionStorage that throws` (private mode: the page still works, nothing is saved)
- [ ] `useLocation does not ask the browser until a button calls ask()` (no prompt on page load)
- [ ] `useLocation moves from idle to asking to granted with a rounded position`
- [ ] `useLocation reports denied, unavailable and timed out as separate states`
- [ ] `useLocation reads a saved position without asking again`
- [ ] `nothing logs or puts the position in the address` (console spies stay empty; `location.search` stays unchanged)

### Task 4: `distance.test.ts`, `dates.test.ts`, `OpenNowBadge.test.tsx`, `VerifiedDate.test.tsx`, `CallButton.test.tsx`, `DirectionsButton.test.tsx`, `ListingCard.test.tsx`
- [ ] `formats the distance in kilometres as the API sends it` (1.4 is "1.4 km away", 0.3 is "0.3 km away", 12.5 is "12.5 km away",
  0 is "Under 0.1 km away"; there are no metres)
- [ ] `verified today, 1 day ago, 3 days ago, 45 days ago` (the current time is passed in)
- [ ] `OpenNowBadge says Open now, Closed or Open 24 hours in words` (24 hours wins over closed)
- [ ] `VerifiedDate shows the amber "Verification due" when verification_due is true`
- [ ] `CallButton is a tel: link with the +234 number and is at least 48 px high`
- [ ] `DirectionsButton opens the Google Maps directions link for the listing's latitude and longitude in a new tab with noopener`
- [ ] `ListingCard shows name, category, area, distance, badge, verified date, Call and Directions`
- [ ] `ListingCard hides the distance when it is null and shows a Sponsored tag only when sponsored`
- [ ] `ListingCard renders HTML in a name as text` (an XSS string stays text)
- [ ] `ListingCard without a primary phone shows no Call button` (the Directions button stays)

### Task 5: `SearchBox.test.tsx`, `CategoryShortcuts.test.tsx`, `LocationPrompt.test.tsx`, `NearbySuggestions.test.tsx`, `FindPage.test.tsx`
- [ ] `SearchBox is a GET form to /search with the field named q`
- [ ] `CategoryShortcuts has the five shortcuts as links with the right slugs, and Blood goes to /blood`
- [ ] `FindPage has the heading "What do you need?" and the emergency button links to /emergency`
- [ ] `LocationPrompt does not ask the browser on load, and asks after the button`
- [ ] `LocationPrompt shows the area list when the visitor refuses` (areas from `getMeta`)
- [ ] `Open now near me goes to /search?open_now=true with the position kept in session storage, not in the address`
- [ ] `NearbySuggestions loads the two cards independently` (one slow, one fast: the fast one shows first)
- [ ] `NearbySuggestions: one failing card shows its own error and Retry; the other card is unaffected`
- [ ] `NearbySuggestions: an empty card shows "No open pharmacy found nearby" with a link to search all places`
- [ ] `NearbySuggestions: with an area and no position, it asks for area=... and shows no distance`
- [ ] `NearbySuggestions has the button "See all open places near me"`
- [ ] `NearbySuggestions is hidden until there is a position or an area`

### Task 6: `useSearchResults.test.tsx`, `FiltersDialog.test.tsx`, `ResultsList.test.tsx`, `SearchStatus.test.tsx`, `SearchPage.test.tsx`
- [ ] `shows skeleton cards while loading, never a blank screen`
- [ ] `shows "The service is waking up. This can take up to a minute." after 5 seconds` (fake timers; announced politely)
- [ ] `shows the error state with Retry after 45 seconds, and Retry searches again`
- [ ] `shows the error state with Retry for a server error`
- [ ] `shows the count line: "12 places, nearest first" with a position and "12 places, A to Z" without`
- [ ] `shows the empty state "No matches. Try removing a filter or widening the distance."`
- [ ] `Load more asks for the next 20 and adds them; the button goes when everything is shown`
- [ ] `a new filter cancels the request in flight and starts a new one` (no old answer replaces the new one)
- [ ] `FiltersDialog opens with the button, shows the choices from /meta, closes with Esc and gives focus back`
- [ ] `FiltersDialog service is a pick-from-list of the services from /meta, with "Any service" first`
- [ ] `FiltersDialog keeps a service from a shared link that is not in the list, as the selected choice`
- [ ] `FiltersDialog Apply writes the filters into the address without lat or lng, and replaces the history entry`
- [ ] `FiltersDialog distance is disabled with a hint when there is no position`
- [ ] `FiltersDialog Clear filters empties every filter`
- [ ] `the page reads its filters from the address (a shared link)`
- [ ] `the page sends lat and lng from the session store to the API and not into the address`
- [ ] `a verification-due listing in the results shows the amber label` (FR-08)
- [ ] `the main search box is pre-filled from q`

## Review-focus edge cases

- [ ] **Cold start.** With the backend paused for 10 seconds: the notice appears at 5 s, the results arrive when it wakes,
  and no error is shown. With it paused for over 45 s: the error and Retry appear, and Retry works after unpausing.
- [ ] **Permission refused, and a refusal remembered.** The area list appears, the tab does not ask again, and a new tab
  asks again.
- [ ] **No position and no area.** `/search` works (sorted A to Z), the distance control is disabled with a hint.
- [ ] **A shared link.** Copy `/search?category=pharmacy&open_now=true`; it holds no position and opens with filters set.
- [ ] **Location privacy.** The address bar, the browser history, `localStorage`, cookies and the console never hold the
  position. In the Network tab the position appears only as `lat` and `lng` of `GET /search`.
- [ ] **Layers.** Pages are thin; components do not call `fetch`; `lib/api/` is the only caller of the API (a test scans
  for it); no `any`; client components only where needed (`"use client"`).
- [ ] **Overdue listings** show "Verification due" and still show their Call button.
- [ ] **Slow 3G.** The Find page is usable before the API answers; skeletons show; nothing jumps when results arrive.
- [ ] **320 px wide.** No sideways scrolling on `/find` or `/search`, the dialog fits, buttons are at least 48 px.
- [ ] **Keyboard and screen reader.** Tab order is sensible, the focus ring is visible, the dialog traps focus, status
  messages are read out, buttons have names.
- [ ] **Page weight.** `/find` and `/search` First Load JS from `npm run build` is written here: _not measured yet_. No
  Leaflet on these pages.

## Security checklist

- [ ] Listing text (names, areas, addresses) is rendered as text only; no `dangerouslySetInnerHTML`.
- [ ] External links (`DirectionsButton`) use `rel="noopener noreferrer"`; `tel:` links hold only the `+234...` number.
- [ ] The position goes to one place only (`GET /search` as `lat` and `lng`); no analytics, no third party, no
  `localStorage`, no cookie, no console output. `git grep -n "console\." frontend/src` finds nothing.
- [ ] No secrets, no `.env` change; the only configuration is the existing public `NEXT_PUBLIC_API_URL`.
- [ ] The new packages are dev-only, pinned to exact versions (no `^` or `~`), chosen for Node 24, and `npm audit` shows no
  new high issue from them.
- [ ] Nothing under `backend/` changed (`git diff --stat origin/main -- backend` is empty).

## Smoke test in DevTools

- [ ] `docker compose up`, open <http://localhost:3000/find>, Chrome DevTools, device **320 px**, network **Slow 3G**, CPU
  4x slowdown. The page is usable, the search box and shortcuts work, the shortcuts open `/search?category=...`.
- [ ] Tap **Open now near me**: allow location (DevTools can fake a position near 6.45, 7.50). Results are nearest first.
- [ ] Refuse location: the area list appears and works. Reload: the tab does not ask again.
- [ ] `docker compose pause backend`, search, wait 6 seconds: the waking-up message. `docker compose unpause backend`:
  results appear. Pause for over 45 s: the error and Retry.
- [ ] Filters: category, open now, 24 hours, distance 5 km, service `X-ray`; the address updates; Load more works.
- [ ] `/find` "near you": two cards load on their own; with a position far from any pharmacy a card says nothing was found.

## Smoke test on a phone (Netlify deploy preview)

The preview has its own address, `https://deploy-preview-<number>--swifthealth-ng.netlify.app`, which the API's CORS
list does not contain. Do these steps in order and report what you see.
- [ ] In Render, open `swifthealth-api`, **Environment**, find `CORS_ORIGINS` and add the preview address to the end,
  separated by a comma, with no space and no trailing slash. Click **Save and deploy**, wait for **Live**.
- [ ] On your Android phone open the preview address. It shows `/find`. (If the page says the service is not reachable
  at once, the preview may not have `NEXT_PUBLIC_API_URL`: tell the developer.)
- [ ] Type a misspelled name and search; use **Open now near me** and allow location; try refusing in a second tab.
- [ ] Note how long the first search takes if the API was asleep, and whether the waking-up message appeared.
- [ ] Report anything that was too small to tap, too small to read, or confusing. This box is the "real phone on 3G" check
  of the PRD release criteria for this feature only; the full check stays in roadmap phase 14d.

## Design differences (Figma Make reference against the UI spec; decision 13)

Filled in while building the components (Task 4 onward). The UI spec and the design rules win; each row says what was
built and why. _The owner has not shared the Figma details yet._

| Screen / part | Figma | UI spec or design rule | Built | Why |
| --- | --- | --- | --- | --- |
| _(none yet)_ | | | | |

## Merge checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` are clean.
- [ ] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run (the paths filter). Write
  what `gh pr checks` showed here: _not checked yet_.
- [ ] The UI spec, `tech-stack.md`, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The preview address is removed from `CORS_ORIGINS` in Render after the merge.
- [ ] The pull request stays a draft until every box above is ticked.
