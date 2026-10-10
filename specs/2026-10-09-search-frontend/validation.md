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
- [x] `renders a heading in a jsdom page` (proves the config: `.tsx`, the `@/` alias, JSX, jest-dom matchers)

### Task 2: `request.test.ts`, `search.test.ts`, `meta.test.ts`, `searchQuery.test.ts`
All timing tests use `vi.useFakeTimers()`: no test waits for real time.
- [x] `requestJson returns the parsed answer for a fast API`
- [x] `requestJson calls onSlow once after 5 seconds and still returns the answer that comes later`
- [x] `requestJson does not call onSlow when the answer comes before 5 seconds`
- [x] `requestJson gives up after 45 seconds with an ApiTimeoutError` (checked at 44 999 ms and 45 000 ms)
- [x] `requestJson throws ApiError with the status for a 4xx or 5xx answer` (404, 422, 500, 503)
- [x] `requestJson throws ApiNetworkError when fetch itself fails`
- [x] `requestJson stops waiting when the caller cancels` (a new search cancels the old one; no timer is left running)
- [x] `searchListings sends only the filters that are set` (no empty `q`, no `lat` without `lng`)
- [x] `searchListings sends lat and lng together as plain numbers`
- [x] `searchListings returns items and total typed as in the api-spec`
- [x] `getMeta returns the five lists (areas, categories, services, blood groups, report reasons)` and
  `getMeta is fetched once and kept in memory`
- [x] `filtersToQuery and queryToFilters round-trip every filter` (`q`, `category`, `service`, `area`, `open_now`,
  `is_24_hours`, `radius_km`)
- [x] `queryToFilters ignores unknown, empty or invalid values` (`radius_km=abc`, `open_now=maybe`)
- [x] `filtersToQuery never writes lat or lng` (NFR-07: no position in the address)
- [x] `no code outside lib/api calls fetch` (a test that scans `src/` for `fetch(`)

### Task 3: `locationStore.test.ts`, `useLocation.test.tsx`
- [x] `saves the position rounded to 3 decimals` (6.451234 becomes 6.451; 7.509876 becomes 7.51)
- [x] `keeps the position in sessionStorage and never in localStorage or a cookie`
- [x] `remembers a refusal for the tab and does not ask again`
- [x] `saves and reads the chosen area; a position clears nothing it should not`
- [x] `survives a sessionStorage that throws` (private mode: the page still works, nothing is saved)
- [x] `useLocation does not ask the browser until a button calls ask()` (no prompt on page load)
- [x] `useLocation moves from idle to asking to granted with a rounded position`
- [x] `useLocation reports denied, unavailable and timed out as separate states`
- [x] `useLocation reads a saved position without asking again`
- [x] `nothing logs or puts the position in the address` (console spies stay empty; `location.search` stays unchanged)
- [x] Added after the phone test (`b43effe`): `permission.test.ts` (the browser's answer is read, never a prompt; unsupported, throwing,
  rejecting or unknown answers mean "unknown"), `useLocation` with a stored position (denied deletes it and keeps the area;
  granted, prompt and "cannot check" keep it; not ready until the browser answers), `NearYou` and `SearchPage` with a blocked
  site (no lat or lng, one search, no way to the results without asking)

### Task 4: `distance.test.ts`, `dates.test.ts`, `OpenNowBadge.test.tsx`, `VerifiedDate.test.tsx`, `CallButton.test.tsx`, `DirectionsButton.test.tsx`, `ListingCard.test.tsx`
- [x] `design-tokens.test.ts`: every token of the UI spec table exists in `globals.css`; every text and background pair is at
  least 4.5:1; no component or page writes a hex or `rgb(a)` colour; the focus ring is real (forest, paper inside `.on-dark`,
  3 px); after the colour change of 2026-10-10 the accent is never a background or text colour
- [x] `distance.test.ts`: the distance in kilometres as the API sends it (1.4 is "1.4 km", 12.5 is "12.5 km", 1 is "1 km",
  0 is "Under 0.1 km", null is nothing; there are no metres)
- [x] `dates.test.ts`: "Verified today", "1 day ago", "3 days ago", "45 days ago" (the current time is passed in); a future
  date counts as today; no date is "Not yet verified"
- [x] `OpenNowBadge says Open now, Closed or Open 24 hours in words` (24 hours wins over closed; the dot is hidden from screen readers)
- [x] `VerifiedDate shows "Verified 3 days ago", and the amber "Verification due" with the date next to it when verification_due is true`
- [x] `CallButton is a tel: link with the +234 number, labelled for screen readers with the facility name, and at least 50 px high`
- [x] `CallButton shows nothing for a number that is not +234 and ten digits`
- [x] `DirectionsButton opens the Google Maps directions link for the listing's latitude and longitude in a new tab with noopener`
- [x] `ListingCard shows name, category, area, address, distance, both labels, Call and Directions`
- [x] `ListingCard hides the distance when it is null and shows a Sponsored tag only when sponsored`
- [x] `ListingCard renders HTML in a name as text` (an XSS string stays text)
- [x] `ListingCard without a primary phone shows no Call button` (the Directions button stays)
- [x] `ListingCard links the name to /listing/[slug]` and `has no text under 16 px` (no `text-xs` or `text-sm`)
- [x] `icons.test.ts`, `icons-in-components.test.tsx`, `DecorativeIcon.test.tsx` (added with the icons decision): the version is
  pinned, icons are imported one by one, hidden from screen readers, and always beside text

### Task 5: `SearchBox.test.tsx`, `CategoryShortcuts.test.tsx`, `AreaSelect.test.tsx`, `NearbySuggestions.test.tsx`, `NearYou.test.tsx`, `FindPage.test.tsx`
(The plan named a `LocationPrompt` test; the prompt is tested through `NearYou`, which owns it.)
- [x] `SearchBox is a plain GET form to /search, so it works without JavaScript` and `sends the text as q` (not a client component)
- [x] `CategoryShortcuts has the five shortcuts of FR-01 as plain links to a search by category, and Blood last` (to `/blood`)
- [x] `FindPage has one h1, "What do you need?"` and `has the two large buttons` (the emergency one links to `/emergency`)
- [x] `NearYou does not ask the browser for the position when the page loads, and makes no search`, and `asks only after the tap`
- [x] `NearYou: when the visitor refuses, says so and keeps the area list; the choice of an area shows the cards`
  (`AreaSelect` lists the areas of `GET /meta`, with an error and Retry)
- [x] `the Open now near me button goes to /search?open_now=true` with a position (kept in session storage, not in the address),
  asks first when there is none, and does not leave the page when the visitor refuses
- [x] `NearbySuggestions loads the two cards independently` (one error does not stop the other; the waking-up notice at 5 s and
  the error at 45 s are per card)
- [x] `NearbySuggestions: one failing card shows its own error and Retry; Retry asks again for that card only`
- [x] `NearbySuggestions: an empty card shows "No open pharmacy found nearby" with a link to search all places` (never an empty card)
- [x] `NearbySuggestions: with an area and no position, it asks by area, sends no lat or lng and shows no distance`
- [x] `NearbySuggestions has the button "See all open places near me"` (with the area in the link when there is no position)
- [x] `NearbySuggestions makes no request without a position or an area`; `NearYou` with a saved position shows the two cards at
  once and no "Show places near me" button
- [x] `/blood says "Coming soon" and links back to /find`

### Task 6: `useSearchResults.test.tsx`, `FiltersDialog.test.tsx`, `ResultsList.test.tsx`, `SearchStatus.test.tsx`, `SearchPage.test.tsx`
- [x] `shows skeleton cards while loading, never a blank screen` (`SearchStatus`, and the page)
- [x] `shows "The service is waking up. This can take up to a minute." after 5 seconds` (fake timers; a polite live region)
- [x] `shows the error state with Retry after 45 seconds` (`useSearchResults`), and Retry searches again
- [x] `shows the error state with Retry for a server error` (page and hook)
- [x] `shows the count line: "12 places, nearest first" with a position and "12 places, A to Z" without` (and "1 place")
- [x] `shows the empty state "No matches. Try removing a filter or widening the distance."`
- [x] `Load more asks for the next 20 and adds them; the button goes when everything is shown` (also: no duplicates, and a
  failed Load more keeps the list and says so)
- [x] `a new filter cancels the request in flight and starts a new one` (no old answer replaces the new one)
- [x] `FiltersDialog opens with the button, shows the choices from /meta, and gives focus back when it closes` (the `close`
  event is what Esc sends; the real Esc key and the backdrop are checked by hand, see the smoke test)
- [x] `FiltersDialog service is a pick-from-list of the services from /meta, with "Any service" first`
- [x] `FiltersDialog keeps a service from a shared link that is not in the list, as the selected choice`
- [x] `FiltersDialog Apply writes the filters into the address without lat or lng, and replaces the history entry`
- [x] `FiltersDialog distance is disabled with a hint when there is no position` (and Apply leaves it out)
- [x] `FiltersDialog Clear filters empties every filter` (the search text stays)
- [x] `the page reads its filters from the address (a shared link)` (and ignores `lat` and `lng` in it)
- [x] `the page sends lat and lng from the session store to the API and not into the address`
- [x] `a verification-due listing in the results shows the amber label` (FR-08)
- [x] `the main search box is pre-filled from q` (and keeps the other filters as hidden fields)
- [x] `FiltersDialog closes when the backdrop is tapped` (added after the phone test, `55e2cae`): focus returns, taps inside
  the sheet and a press that starts inside do not close it, a stray click does not close a reopened sheet, Esc still works

## Review-focus edge cases

- [ ] **Cold start.** With the backend paused for 10 seconds: the notice appears at 5 s, the results arrive when it wakes,
  and no error is shown. With it paused for over 45 s: the error and Retry appear, and Retry works after unpausing.
- [ ] **Permission refused, and a refusal remembered.** The area list appears, the tab does not ask again, and a new tab
  asks again.
- [x] **No position and no area.** `/search` works (sorted A to Z), the distance control is disabled with a hint. (Tests:
  `the page without a position shows 'A to Z'`, `FiltersDialog distance is disabled with a hint`; still to look at by hand.)
- [x] **A shared link.** `/search?category=pharmacy&open_now=true` holds no position and opens with filters set. (Tests:
  `the page reads its filters from the address`, `ignores lat and lng in the address`.)
- [ ] **Location privacy.** The address bar, the browser history, `localStorage`, cookies and the console never hold the
  position. In the Network tab the position appears only as `lat` and `lng` of `GET /search`.
- [x] **Layers.** Pages are thin; components do not call `fetch`; `lib/api/` is the only caller of the API (a test scans
  for it); no `any` (`git grep` finds none); client components only where needed (`"use client"`: the ten files that use
  state, effects or click handlers; `/find` and `/search` pages, `SearchBox`, `CategoryShortcuts` and `ResultsList` are server-safe).
- [x] **Overdue listings** show "Verification due" and still show their Call button (`ListingCard.test.tsx`).
- [x] **Slow 3G.** The Find page is usable before the API answers; skeletons show; nothing jumps when results arrive.
  (Owner, DevTools, 2026-10-10: "slow 3g ok".)
- [x] **320 px wide.** No sideways scrolling on `/find` or `/search`, the dialog fits, buttons are at least 48 px.
  (Owner, DevTools, 2026-10-10: "320px ok".)
- [ ] **Keyboard and screen reader.** Tab order is sensible, the focus ring is visible, the dialog traps focus, status
  messages are read out, buttons have names.
- [x] **Page weight.** First Load JS from `npm run build` (2026-10-10, Next.js 15.5, after Task 6): `/find` **114 kB**,
  `/search` **115 kB**, of which **103 kB** is shared by every page (the framework). The pages themselves add 4.55 kB and
  5.84 kB. No Leaflet on these pages (it is not imported).

## Security checklist

- [x] Listing text (names, areas, addresses) is rendered as text only; no `dangerouslySetInnerHTML` (`git grep` finds none;
  `ListingCard` and `ResultsList` tests render a `<img onerror>` name as text).
- [x] External links (`DirectionsButton`) use `rel="noopener noreferrer"`; `tel:` links hold only the `+234...` number.
- [x] The position goes to one place only (`GET /search` as `lat` and `lng`); no analytics, no third party, no
  `localStorage`, no cookie, no console output. `git grep -n "console\." frontend/src` finds nothing (checked 2026-10-10).
  The page tests check the position is not in the page or the address.
- [x] No secrets, no `.env` change; the only configuration is the existing public `NEXT_PUBLIC_API_URL`.
- [x] The five test packages are dev-only and pinned to exact versions (no `^` or `~`), chosen for Node 24. `lucide-react`
  1.47.0 is a runtime dependency (owner-approved, exact version). `npm audit` shows the same 11 findings as before
  (recorded in `LOG.md`).
- [x] Nothing under `backend/` changed (`git diff --stat origin/main -- backend` is empty, checked 2026-10-10).

## Smoke test in DevTools

Reported by the owner on 2026-10-10: "320px ok, slow 3g ok, esc ok, backdrop tap does not close the dialog" (the backdrop bug
is fixed in `55e2cae`, with tests). Only what the owner reported is ticked; the rest was not reported.
- [x] `docker compose up`, open <http://localhost:3000/find>, Chrome DevTools, device **320 px**, network **Slow 3G**. The
  page is usable and skeletons show (owner: "320px ok, slow 3g ok"). The 4x CPU slowdown was not mentioned.
- [ ] Tap **Open now near me**: allow location (DevTools can fake a position near 6.45, 7.50). Results are nearest first.
  (Not reported for DevTools. Allow was confirmed on the phone, below.)
- [ ] Refuse location: the area list appears and works. Reload: the tab does not ask again. (**Not confirmed, and the first
  phone try failed**: see "Found in the phone test" below.)
- [ ] `docker compose pause backend`, search, wait 6 seconds: the waking-up message. `docker compose unpause backend`:
  results appear. Pause for over 45 s: the error and Retry. (Not tested yet: the owner corrected an earlier note on
  2026-10-10.)
- [ ] Filters: category, open now, 24 hours, distance 5 km, service `X-ray`; the address updates; Load more works. (Filters
  worked on the phone; the list was not reported item by item. **Esc closes the sheet: confirmed.** The backdrop tap did
  not close it: fixed in `55e2cae`, to be looked at again on the preview.)
- [ ] `/find` "near you": two cards load on their own; with a position far from any pharmacy a card says nothing was found.
  (Not reported.)

## Smoke test on a phone (Netlify deploy preview)

The preview has its own address, `https://deploy-preview-<number>--swifthealth-ng.netlify.app`, which the API's CORS
list does not contain. Do these steps in order and report what you see.
Phone: Honor X6B, mobile data, reported by the owner on 2026-10-10.
- [x] In Render, open `swifthealth-api`, **Environment**, find `CORS_ORIGINS` and add the preview address to the end,
  separated by a comma, with no space and no trailing slash. Click **Save and deploy**, wait for **Live**. (Done by the
  owner; the preview then loaded data. **Still to do after the merge: remove the preview address again.**)
- [x] On your Android phone open the preview address. It shows `/find`. (It worked.)
- [ ] Type a misspelled name and search; use **Open now near me** and allow location; try refusing in a second tab.
  (Owner: allow worked. **Block did not work as it should**: see below. The misspelled-name search was not reported.)
- [ ] Note how long the first search takes if the API was asleep, and whether the waking-up message appeared. (Not tested yet;
  the owner corrected an earlier note on 2026-10-10.)
- [x] Report anything that was too small to tap, too small to read, or confusing. (Owner: Call, Directions and Filters
  worked; two issues found: the backdrop tap, fixed in `55e2cae`, and the short category list, see below.) This box is the
  "real phone on 3G" check of the PRD release criteria for this feature only; the full check stays in roadmap phase 14d.

**Found in the phone test, 2026-10-10:**
- **Backdrop tap did not close the Filters sheet.** Fixed in this pull request (`55e2cae`), with tests; Esc and focus return still work.
- **Blocked location still gave "nearest first" with distances (owner's correction, 2026-10-10).** On the Honor X6B, Chrome,
  the owner blocked location for the preview site, opened a new tab, tapped **Open now near me**, and the results were
  nearest first with distances, with no question asked. **Investigation (2026-10-10, no fix made yet):**
  - In the code a position has only two sources: the browser's `getCurrentPosition` (success), or the key
    `swifthealth.position` in `sessionStorage`. There is no IP lookup, no server-side location and no `localStorage`.
    The distances came from one of these two.
  - By design a stored position wins: `Open now near me` goes straight to `/search` when a position is stored, and the
    app does not ask again. So if a position was in the tab's `sessionStorage`, a block set afterwards in Chrome has no
    effect on that tab. A browser that was really blocked would have answered `getCurrentPosition` with an error, and the
    app would have shown "We could not use your location. Choose an area instead."
  - So the most likely cause is a stored position that was **copied into the new tab**: browsers copy `sessionStorage`
    into a tab opened from a page (a link, `window.open`, "Duplicate tab"), and Chrome restores it for a tab it brings
    back. This is a documented browser behaviour, not yet seen on the phone; it is not proven.
  - **Not reproduced.** A real-browser test was tried (Playwright Chromium) but the container lacks system libraries
    (`libnspr4`), and adding them needs `sudo apt`, which was not done. Unit tests cannot show browser tab behaviour.
  - The owner's answers (2026-10-10): the first tab had allowed location; the owner does not remember how the new tab was
    opened; and after closing all tabs and typing the address fresh, the page refused correctly ("We could not use your
    location. Choose an area instead." with the area list). That fits the cause: a fresh tab has no stored position and
    the block works; a tab with a copied or kept position skipped the browser. Still not proven in a browser.
  - **Fix (owner approved, 2026-10-10; commit `b43effe`):** before a stored position is used, the app reads the browser's
    permission with `navigator.permissions.query({ name: "geolocation" })` (it never prompts). `denied`: the position is
    deleted, the refusal is remembered, the area list is shown, the chosen area stays. `granted` or `prompt`: unchanged.
    A browser with no such check, or a check that fails: unchanged (the old behaviour), as the owner asked. Spec first
    (UI spec 2.2, requirements decision 3), 25 tests first, mutation check on this privacy code (5 and 1 tests fail).
  - **To check again on the phone** (new preview): allow location in a tab, block the site in Chrome, open a new tab from
    that tab (any way), tap **Open now near me**. Expected: the refusal message and the area list, no distances.
- **The category list in production shows only Clinic, Pharmacy and Laboratory.** Production has only the categories the demo
  listings needed. Not a frontend bug: categories are reference data. It is a small backend PR after this one (an
  idempotent Alembic data migration; see "To do later" in `LOG.md`), and it does not block this merge. Until then the
  Filters sheet in production offers three categories.

## Design differences (Figma Make reference against the UI spec; decision 13)

The Figma details are in [docs/design/figma-find-page-design.md](../../docs/design/figma-find-page-design.md) (read
2026-10-09). The UI spec and the design rules win; each row says what was built and why. "Task 4" rows are built now, the
others when that task comes. Colours are never copied as hex into components: they map to the tokens of the UI spec
(section "Design tokens"), and ten new role-named tokens were added to the UI spec first.

| Screen / part | Figma | UI spec or design rule | Built | Why |
| --- | --- | --- | --- | --- |
| Colours: dark teal | teal-950 `#073d3b` (hero, brand text, active chip) | `forest` `#1B6F93` (blue since the owner's colour change of 2026-10-10; was green `#12302a`) | `forest` | Spec token wins (Task 4 tokens, Task 5 hero) |
| Colours: primary | teal-700 `#08766f` (primary button, brand mark) | `pine` `#1B6F93` (was green `#2f7d6b`) | `pine` (white on it: 5.6:1), `pine-dark` `#134F6A` on hover and press | Spec token wins |
| Colours: page background | canvas `#f5f8f7` (cool white) | `paper` `#f6f3ec` (warm) | `paper` | Spec token wins |
| Colours: text, red | ink `#172321`, red `#b4232c` | `ink` `#1d2421`, `emergency` `#b3261e` | the spec tokens | Spec token wins; red is for SwiftRescue only |
| Colours: link and secondary-button text | teal-800 `#0b5c57` | no such token | `forest` for button text; links `forest` underlined | The old green `pine` on `paper` was 4.4:1, so links used `forest`; both are now the main blue (5.1:1 on `paper`), and `forest` is kept for links |
| Colours: tints, lines, secondary text | teal-100, teal-50, line, ink-soft, muted text (`#61706d`/`#647471`) | only six tokens | new tokens `pine-100`, `pine-50`, `line`, `ink-soft` (Figma values); "muted" folded into `ink-soft` | The spec had no tokens for them; added to the UI spec first. One secondary colour is enough and `ink-soft` is the stronger (6.4:1) |
| Colours: status | green/green-bg, grey-bg/closed text, amber `#8b5c00`/`#fff4d6` | green and grey named in the spec without a value; amber token too light for small text | new tokens `open`/`open-bg`, `closed`/`closed-bg`, `amber-ink`/`amber-wash` (Figma values; 4.8, 7.0 and 5.3:1) | The plain `amber` `#e8913a` on white is 2.5:1, too low for text; it stays for the "Sponsored" tag background, highlights and the focus ring |
| Focus ring | `#82cfc3`, 3 px, 2 px offset | was an `amber` ring in the spec; **changed by the owner on 2026-10-09** to `forest` on light backgrounds and `paper` on `forest` (class `on-dark`), 3 px, 2 px offset | as the owner decided; the UI spec was changed first | Amber on white or `paper` is only 2.2 to 2.5:1, under the 3:1 of WCAG 2.2 (Figma's teal is 1.9:1). Forest (blue since 2026-10-10) is 5.6:1 on white and paper on forest is 5.1:1. Checked by `design-tokens.test.ts` |
| Text sizes | 14 px secondary text, 13 px badges, "Last checked", eyebrows, chips, filter and location buttons, a 12 px note | 16 px or larger for all text (NFR-10, CLAUDE.md) | 16 px everywhere (Task 4: badges, area line, verified line, eyebrow); card title 18 px | Spec wins. Headings may be larger |
| Tap targets | buttons 50 px, location 52 px, search box 56 px, chips 48 px | at least 48 px | 50 px minimum for buttons and links (Task 4); 56/52 px in Task 5 | Within the rule |
| Radii and spacing | button radius 11 px, search box 14 px, card padding 18/16 px, gap 14 px | no values | rounded to the Tailwind scale: 12 px buttons, 16 px cards, 16 px padding, 12 px gaps | Use the scale, not odd values; the look is the same |
| Card shadow | `0 2px 12px rgba(7,61,59,.07)` | no value | token `shadow-card` made from `forest` at 7% | No hex or rgba in components |
| Font | system stack, no web font | system stack | Tailwind's default `font-sans` (a system stack) | Same |
| Icons (pin, clock, shield, phone, route, search) | an icon on most things | UI spec (owner's decision, 2026-10-09): `lucide-react`, one icon per import, decorative (`aria-hidden`), always beside a text label | built with `lucide-react` 1.47.0 (exact version) | Approved by the owner |
| Icon: the 48 px facility tile | a tile with a facility icon | not in the spec | **not built** | Not asked for; a category icon set would need its own decision |
| Listing card: hours line | "Open 24 hours", "Closes 9:00 PM", "Opens 7:30 AM tomorrow" | `ListingSummary` has no opening hours (they are in `ListingDetail`, phase 6) | the badge only ("Open now", "Closed", "Open 24 hours"); no hours line | The API summary cannot supply it; adding hours to `ListingSummary` needs an api-spec change |
| Listing card: "Last checked 18 Jun 2026" | an absolute date under the badges | `VerifiedDate`: "Verified 3 days ago" | the relative text in the label; when overdue, "Verification due" plus "Verified 45 days ago" | Spec wins; the date is still always shown (US-07, FR-08) |
| Listing card: "Area, Enugu" | the city name is written in | nothing may be tied to Enugu only (CLAUDE.md, mission) | the area only | The city is not in the API; it could come from `config/site.ts` later |
| Listing card: eyebrow | "Hospital · 1.2 km" | distance on the card | "Hospital · 1.2 km" (the same) | No conflict |
| Listing card: facility icon tile | a 48 px tile with an icon | not in the spec | not built | No icon library (see Icons) |
| Directions | a Google Maps search by address | `destination=lat,lng` from the API | latitude and longitude | Spec wins and is more exact |
| Header | white, sticky, 64 px, brand mark, `backdrop-filter: blur`, rescue icon | forest header, name on the left, red SwiftRescue on the right (already built) | unchanged | Not part of 5B-1; the blur can be slow on low-end phones, so a solid background stays |
| SwiftRescue panel | red panel on the Find screen | SwiftRescue is its own page, `/emergency` (phase 7) | **not built** (owner's instruction) | Phase 7 |
| Bottom navigation (Home, Search, Rescue) | mobile only | not in the UI spec | **not built** (owner's instruction) | Not in the spec |
| Desktop aside "BROWSE CARE" | from 980 px | not in the UI spec | **not built** (owner's instruction) | Not in the spec |
| Hero: "Enugu, Nigeria", "LAUNCH AREA" pill, "Find trusted care near you" | on teal-950 | heading "What do you need?", two large choices (FR-01) | Task 5: the spec's heading and the two choices; no city line | Spec wins; nothing tied to Enugu only |
| Find page: area select always visible | "Or choose an area" + Filters button | area list only when location is refused (FR-03); filters belong to `/search` | Task 5: the spec's behaviour | Spec wins |
| Filters | category chips inline toggles | native `<dialog>` sheet with open now, category, area, service, distance | Task 6: the dialog | Spec wins |
| Category chips | All, Hospital, Pharmacy, Laboratory, Clinic, Blood, More | Hospitals, Clinics, Pharmacies, Maternity, Labs, Blood (FR-01) | Task 5: the spec's six, in Figma's chip style (a scrolling row, 48 px) | Spec wins on the list; the look is kept |
| Loading | a message card with a spinner and the waking-up sentence at once | skeletons; the sentence after 5 s | Task 6: skeletons first, the sentence after 5 s | Spec wins; no spinner was added (see below) |
| Error | "We could not load places", "Try again" | "We couldn't load this. Check your connection and try again." + Retry | Task 6: the spec's words | Spec wins |
| Empty | "No places found", "Clear search" | "No matches. Try removing a filter or widening the distance." | Task 6: the spec's words | Spec wins |
| Near-you cards | eyebrow, title, "1.2 km · New Haven", badge, hours, Call, Directions | `ListingCard` in the near-you section | Task 5: the same `ListingCard` with the eyebrow "Closest open pharmacy" above it | One card component, no hours line (see above) |
| List \| Map toggle | not in the Figma file | UI spec 2.3, item 2: the map is phase 5B-2 | **not built**: only the list shows | Phase 5B-2 |
| Hero on `/find` | one block with the heading, location line, search, chips and filters on teal-950 | heading, two large choices, search box (2.2) | the forest hero holds the heading and the two large choices; the search box, shortcuts and Near you are on `paper` below it | The search box and the primary button sit better on the light background (the focus ring and contrast are checked there) |
| Spinner while loading | a spinner in the message card | skeletons | **not built**; the skeleton pulses, and does not move under `prefers-reduced-motion` | Skeletons are what the spec asks for |
| Filters sheet buttons | none described | **Apply** and **Clear filters** (2.3) | Apply, Clear filters and a Close button; Clear keeps the search text | The Close button gives a way out on a phone without the Esc key |
| Bright blue accent `#1A9FD2` | none | owner's colour change, 2026-10-10: decoration only | a 4 px line under the header; never behind text | White on it is only 3.0:1 |
| Search box on `/search` | none | pre-filled search box (2.3) | pre-filled, and it keeps the other filters as hidden fields | Searching new text should not drop the filters; the position is never one of them |

## Merge checklist

- [x] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` are clean (2026-10-10: 342 tests; build with
  `/find` 114 kB and `/search` 115 kB).
- [x] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run (the paths filter). What
  `gh pr checks 14` showed (2026-10-10, after `1b0dd97`): `frontend` **pass** (1m4s, run 38037797147); the only workflow that ran
  was Frontend CI, no Backend CI run exists for the branch; Netlify `deploy-preview` **pass**
  (<https://deploy-preview-14--swifthealth-ng.netlify.app>); "Header rules" and "Redirect rules" skipping, "Pages changed" skipping.
  Note: the first push did not start any GitHub workflow because the pull request had a merge conflict with `main`
  (`specs/roadmap.md`, from PR #13); merging `main` into the branch fixed it.
- [x] The UI spec, `tech-stack.md`, the [roadmap](../roadmap.md) and `LOG.md` are up to date (checked 2026-10-10 after the
  backdrop fix: the UI spec lists the ways to close the sheet; `LOG.md` has the categories item).
- [ ] The preview address is removed from `CORS_ORIGINS` in Render after the merge.
- [ ] The pull request stays a draft until every box above is ticked.
