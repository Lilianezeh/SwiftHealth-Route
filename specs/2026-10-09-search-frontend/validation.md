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
- [ ] `design-tokens.test.ts`: every token of the UI spec table exists in `globals.css`; every text and background pair is at
  least 4.5:1; no component or page writes a hex or `rgb(a)` colour; a pending test for the focus ring (see Design differences)
- [ ] `distance.test.ts`: the distance in kilometres as the API sends it (1.4 is "1.4 km", 12.5 is "12.5 km", 1 is "1 km",
  0 is "Under 0.1 km", null is nothing; there are no metres)
- [ ] `dates.test.ts`: "Verified today", "1 day ago", "3 days ago", "45 days ago" (the current time is passed in); a future
  date counts as today; no date is "Not yet verified"
- [ ] `OpenNowBadge says Open now, Closed or Open 24 hours in words` (24 hours wins over closed; the dot is hidden from screen readers)
- [ ] `VerifiedDate shows "Verified 3 days ago", and the amber "Verification due" with the date next to it when verification_due is true`
- [ ] `CallButton is a tel: link with the +234 number, labelled for screen readers with the facility name, and at least 50 px high`
- [ ] `CallButton shows nothing for a number that is not +234 and ten digits`
- [ ] `DirectionsButton opens the Google Maps directions link for the listing's latitude and longitude in a new tab with noopener`
- [ ] `ListingCard shows name, category, area, address, distance, both labels, Call and Directions`
- [ ] `ListingCard hides the distance when it is null and shows a Sponsored tag only when sponsored`
- [ ] `ListingCard renders HTML in a name as text` (an XSS string stays text)
- [ ] `ListingCard without a primary phone shows no Call button` (the Directions button stays)
- [ ] `ListingCard links the name to /listing/[slug]` and `has no text under 16 px` (no `text-xs` or `text-sm`)

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

The Figma details are in [docs/design/figma-find-page-design.md](../../docs/design/figma-find-page-design.md) (read
2026-10-09). The UI spec and the design rules win; each row says what was built and why. "Task 4" rows are built now, the
others when that task comes. Colours are never copied as hex into components: they map to the tokens of the UI spec
(section "Design tokens"), and ten new role-named tokens were added to the UI spec first.

| Screen / part | Figma | UI spec or design rule | Built | Why |
| --- | --- | --- | --- | --- |
| Colours: dark teal | teal-950 `#073d3b` (hero, brand text, active chip) | `forest` `#12302a` | `forest` | Spec token wins (Task 4 tokens, Task 5 hero) |
| Colours: primary | teal-700 `#08766f` (primary button, brand mark) | `pine` `#2f7d6b` | `pine` (white on it: 4.9:1) | Spec token wins |
| Colours: page background | canvas `#f5f8f7` (cool white) | `paper` `#f6f3ec` (warm) | `paper` | Spec token wins |
| Colours: text, red | ink `#172321`, red `#b4232c` | `ink` `#1d2421`, `emergency` `#b3261e` | the spec tokens | Spec token wins; red is for SwiftRescue only |
| Colours: link and secondary-button text | teal-800 `#0b5c57` | no such token | `forest` for button text; links `forest` underlined | `pine` on `paper` is 4.4:1, under the 4.5:1 minimum, so `pine` is not used for small text on `paper` |
| Colours: tints, lines, secondary text | teal-100, teal-50, line, ink-soft, muted text (`#61706d`/`#647471`) | only six tokens | new tokens `pine-100`, `pine-50`, `line`, `ink-soft` (Figma values); "muted" folded into `ink-soft` | The spec had no tokens for them; added to the UI spec first. One secondary colour is enough and `ink-soft` is the stronger (6.4:1) |
| Colours: status | green/green-bg, grey-bg/closed text, amber `#8b5c00`/`#fff4d6` | green and grey named in the spec without a value; amber token too light for small text | new tokens `open`/`open-bg`, `closed`/`closed-bg`, `amber-ink`/`amber-wash` (Figma values; 4.8, 7.0 and 5.3:1) | The plain `amber` `#e8913a` on white is 2.5:1, too low for text; it stays for the "Sponsored" tag background, highlights and the focus ring |
| Focus ring | `#82cfc3`, 3 px, 2 px offset | `amber` ring (spec), visible | `amber`, 3 px, 2 px offset (as in `globals.css`) | Spec wins. **Finding for the owner:** amber on white or `paper` is 2.2 to 2.5:1, under the 3:1 that WCAG 2.2 asks of a focus indicator (Figma's teal is worse, 1.9:1). On `forest` it is 5.8:1. A forest ring (14:1) would pass everywhere; this is the owner's call and is recorded as a pending test in `design-tokens.test.ts` |
| Text sizes | 14 px secondary text, 13 px badges, "Last checked", eyebrows, chips, filter and location buttons, a 12 px note | 16 px or larger for all text (NFR-10, CLAUDE.md) | 16 px everywhere (Task 4: badges, area line, verified line, eyebrow); card title 18 px | Spec wins. Headings may be larger |
| Tap targets | buttons 50 px, location 52 px, search box 56 px, chips 48 px | at least 48 px | 50 px minimum for buttons and links (Task 4); 56/52 px in Task 5 | Within the rule |
| Radii and spacing | button radius 11 px, search box 14 px, card padding 18/16 px, gap 14 px | no values | rounded to the Tailwind scale: 12 px buttons, 16 px cards, 16 px padding, 12 px gaps | Use the scale, not odd values; the look is the same |
| Card shadow | `0 2px 12px rgba(7,61,59,.07)` | no value | token `shadow-card` made from `forest` at 7% | No hex or rgba in components |
| Font | system stack, no web font | system stack | Tailwind's default `font-sans` (a system stack) | Same |
| Icons (pin, clock, shield, phone, route, search, the facility tile) | an icon on most things | no icon library in the stack (`components.json` names lucide, not installed) | **not built**: text and a coloured dot only | `lucide-react` would be a new runtime dependency on a slow-3G page; hand-drawn icons I cannot see would risk broken glyphs. Owner decides whether to add it |
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
| Loading | a message card with a spinner and the waking-up sentence at once | skeletons; the sentence after 5 s | Task 6: skeletons first, the sentence after 5 s | Spec wins; a spinner may be added if it respects reduced motion |
| Error | "We could not load places", "Try again" | "We couldn't load this. Check your connection and try again." + Retry | Task 6: the spec's words | Spec wins |
| Empty | "No places found", "Clear search" | "No matches. Try removing a filter or widening the distance." | Task 6: the spec's words | Spec wins |
| Near-you cards | eyebrow, title, "1.2 km · New Haven", badge, hours, Call, Directions | `ListingCard` in the near-you section | Task 5: the same `ListingCard` with the eyebrow "Closest open pharmacy" above it | One card component, no hours line (see above) |

## Merge checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` are clean.
- [ ] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run (the paths filter). Write
  what `gh pr checks` showed here: _not checked yet_.
- [ ] The UI spec, `tech-stack.md`, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The preview address is removed from `CORS_ORIGINS` in Render after the merge.
- [ ] The pull request stays a draft until every box above is ticked.
