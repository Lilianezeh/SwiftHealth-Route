# Search frontend: Find page and results page (Phase 5B-1): requirements

What this feature must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it is
done is in [validation.md](validation.md). The map view (5f) is the next feature, phase 5B-2.

## Requirements

- **US-01:** find pharmacies open now near me. **US-05:** search by service.
- **FR-01:** the Find page asks "What do you need?" with two large choices, a search box and category shortcuts.
- **FR-03:** location permission is asked once; if refused, the visitor can pick an area from a list.
- **FR-04:** search by name, category or service, tolerant of misspellings (the API does it; the page sends the text).
- **FR-05:** filters: category, service, open now, open 24 hours, distance.
- **FR-06:** results sort by distance by default; each result shows name, category, distance, open or closed, and Call and
  Directions buttons.
- **FR-08:** overdue listings show a "verification due" label (the API keeps them in the results).
- **NFR-04** (Chrome, Opera Mini, iPhone Safari, 320 px wide), **NFR-10** (48 px targets, 16 px text, contrast, screen
  readers), **NFR-07** (a position is never kept) and **NFR-01** (slow 3G, small pages) shape how it is built.

Source of truth: [prd.md](../prd.md), [ui-spec.md](../frontend/ui-spec.md) sections 1, 2.2 and 2.3,
[api-spec.md](../backend/api-spec.md) (`GET /search`, `GET /meta`). Branch: `feature/search-frontend`. Every commit and
test references these IDs. This is roadmap [phase 5B-1](../roadmap.md) (5d and 5e). It needs the backend
[GET /meta feature](../2026-10-09-meta-endpoint/requirements.md) (5B-0, with the services list) and the small
Node 24 chore merged first, and it changes nothing under
`backend/`, so `Backend CI` must not run on its pull request.

Fit with the project: [mission.md](../mission.md) wants a resident to find an open facility near them and call it in one
tap, on a low-cost phone. [tech-stack.md](../tech-stack.md) fixes Next.js (server components by default), Tailwind and
the layers `app/` to `components/` to `hooks/` to `lib/api/`. The only additions are five dev-only test packages
(decision 10), approved by the owner.

## In scope

- `/find`: heading, the two large buttons, the search box, the five category shortcuts and Blood, "Open now near me",
  the location prompt with an area list when permission is refused, and the "near you" section (decision 5).
- `/search`: the search box, a Filters dialog, the result count, the list of `ListingCard`s, "Load more", and the
  loading, waking-up, empty and error states.
- The API layer in `lib/api/` (search, meta, one request helper with the time limits), the types, the location store and
  hook, and the components in `components/listings/` and `components/search/`.
- A "Coming soon" page for `/blood`, so the Blood shortcut is not a 404.
- Test tooling for components (decision 10) and the tests for all of the above.
- Spec updates first (Task 0): the UI spec lines in the Files table of the plan.

## Out of scope (planned elsewhere)

- The List | Map toggle and the Leaflet map ([FR-07](../prd.md)): roadmap phase 5B-2.
- The listing page behind a card (`/listing/[slug]`), the full phone list, hours and fees: phase 6. The card links to
  it; today that page is a stub.
- The Report a problem link on cards: phase 9. The `/blood` page itself: phase 8.
- The sponsored slot ([FR-45](../prd.md)): phase 12c. The "Sponsored" tag exists on the card but `sponsored` is always
  `false` until then.
- Results that work without JavaScript, for example in Opera Mini extreme mode: after the Render upgrade, see decision 1
  and `LOG.md`.
- A service worker or offline mode for search.

## Decisions

1. **The results page loads its results in the browser, with a 45 second limit.** Chosen by the owner on 2026-10-09
   from three options. The free Render API takes up to a minute to wake after 15 idle minutes, and Netlify gives up on
   a server-rendered page after about 30 seconds (the home page already stops waiting after 8 seconds,
   [phase 4](../2026-10-08-walking-skeleton-production/requirements.md)). So `/search` opens at once with skeleton
   cards; the browser calls the API; after 5 seconds without an answer the page says "The service is waking up. This can
   take up to a minute."; after 45 seconds it stops and shows the error state with a Retry button. Alternatives:
   server first with a browser fallback (works without JavaScript but is about twice the code and two paths to test),
   and server only with an 8 second limit (the first search after a quiet period would always fail). **Known gap:** the
   PRD names Opera Mini in [NFR-04](../prd.md); neither it nor the UI spec says anything about running without
   JavaScript, but Opera Mini's extreme mode runs very little of it, so the results will not show there. The Find page
   search box is a plain HTML form and the category shortcuts are plain links, so a visitor can still get to `/search`.
   After the Render upgrade (roadmap phase 14d) we revisit server rendering for results. This is in `LOG.md`.
   The UI spec rule "only maps, forms and filters are client components" gets an exception for the results list
   (Task 0).
2. **One request helper owns the time limits.** `lib/api/request.ts` calls `fetch` with an `AbortController` and
   `setTimeout`, not `AbortSignal.timeout`, so tests can move time with fake timers. It reports "slow" after 5 000 ms
   (a callback the page uses to show the waking-up message), aborts after 45 000 ms, and gives three clear errors: the
   API answered with an error status, the API did not answer in time, and the network failed. Starting a new search
   cancels the old request. The server-side `getHealth()` keeps its 8 second limit.
3. **The visitor's position lives in `sessionStorage` only, rounded to 3 decimals.** Chosen by the owner. It is saved
   when the browser gives it, gone when the tab closes, never in the page address, never in `localStorage`, never in a
   cookie, never logged, and sent only as the `lat` and `lng` query parameters of `GET /search`. So shared links and
   browser history hold no position, and a shared link opens with the area list instead. Rounding to 3 decimals (about
   110 m) is our addition: nearest-first order stays right and we keep less than the phone gave us (NFR-07). A refusal is
   remembered for the tab too, so the site asks once (FR-03). The browser's prompt is shown only after a tap on a
   button, never on page load. The backend side is the [5B-0 feature](../2026-10-09-meta-endpoint/requirements.md):
   the API access log no longer keeps `lat` and `lng`. **Added after the phone test (owner, 2026-10-10):** a stored
   position is used only while the browser's permission is not `denied` (checked with `navigator.permissions.query`);
   if it is `denied` the position is forgotten and the area list is shown, and if the browser cannot check, the stored
   position is used as before. Reason: a new tab can get a copy of the opener's `sessionStorage`, so a position stored
   before the visitor blocked the site kept being used (NFR-07).
4. **The Find page is a server page with small interactive parts.** The search box is
   `<form action="/search" method="get">`, the shortcuts are links, "Get emergency help" is a link. Only the
   location prompt, the area list and the "near you" section are client components. Category shortcuts use fixed
   slugs: Hospitals `hospital`, Clinics `clinic`, Pharmacies `pharmacy`, Maternity `maternity`, Labs `laboratory`
   (the five of [FR-01](../prd.md); the slugs are the seed's), and Blood goes to `/blood`.
5. **"Near you" on the Find page** (owner's choice): two cards, "Closest open pharmacy"
   (`category=pharmacy&open_now=true&limit=1`) and "Closest open 24-hour place" (`is_24_hours=true&limit=1`), each a
   `ListingCard` with Call and Directions, and a button "See all open places near me" (`/search?open_now=true`). With an
   area instead of a position, the same two calls use `area=` and show no distance. The two cards load independently, so
   a slow or failed call does not block the other. A card that finds nothing shows a short message ("No open pharmacy
   found nearby" or "No 24-hour place found nearby") with a link to search all places, never an empty card; a failed card
   shows its own error and Retry. The section appears once there is a position or an area; before that it shows the
   prompt "Show places near me" with the area list.
6. **The filters.** The Filters button opens a native `<dialog>` (owner's choice; no library, keyboard and screen reader
   support from the browser) with: category (a list from `GET /meta`), service (a pick-from-list of the `services` in
   `GET /meta`, plus "Any service"), area (from `GET /meta`), open now, open 24 hours, and distance (5, 10 or 20 km, only
   usable when there is a position). The page address holds every filter except the position
   (`/search?category=pharmacy&open_now=true`), so results can be shared, and applying filters replaces the address
   without adding history entries. "Load more" is page state, not in the address. The services list was added to
   `GET /meta` in [5B-0](../2026-10-09-meta-endpoint/requirements.md) (owner's decision, 2026-10-09): the `service`
   filter needs the exact name, so the visitor picks it instead of typing it. A `service` value in a shared link that is
   not in the list is still sent to the API and shown as the selected choice. Typing in the main search box also finds
   services, with typo tolerance.
7. **Cards and states follow the UI spec.** `ListingCard` (name, category, area, distance "1.4 km", open badge,
   verified date, Call and Directions, "Sponsored" tag when `sponsored`), `CallButton` (`tel:+234...`),
   `DirectionsButton` (the Google Maps link from the listing's latitude and longitude, opens in a new tab with
   `rel="noopener noreferrer"`), `OpenNowBadge` ("Open now", "Closed", "Open 24 hours": words, not only colour) and
   `VerifiedDate` ("Verified 3 days ago", or an amber "Verification due"). Loading shows skeleton cards, never a blank
   screen; the waking-up and error messages are announced to screen readers (`aria-live`); the empty state says what to
   try next. Listing text is always rendered as text, never as HTML. Phone numbers are shown as they come, `+234...`.
8. **The count line** says "12 places, nearest first" when a position is used and "12 places, A to Z" when not (the API
   sorts by name then), and "No matches. Try removing a filter or widening the distance." when there are none.
9. **Types match the API.** `ListingSummary`, `CategorySummary`, `SearchResponse` and `MetaResponse` are written in
   `types/api.ts` field for field from the api-spec. No `any`.
10. **Test tooling (approved by the owner on 2026-10-09), for Node 24.** Five dev-only packages, pinned to exact
    versions: `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom` and
    `@testing-library/user-event`. The versions are chosen in Task 1 for the Node version the
    [Node 24 chore](../roadmap.md) moves us to, not for Node 20 (Node 20 reached end of life on 2026-04-30, see
    `LOG.md`). Rule: the newest release whose `engines.node` accepts Node 24, whose peers accept React 19.1 and
    `@testing-library/dom` 10, and that runs with the installed vitest 3.2.x; each is checked with `npm view` and by
    running the tests. Candidates on 2026-10-09: `@testing-library/react` 16.3.3 (accepts React 19), `@testing-library/dom`
    10.4.2, `@testing-library/user-event` 14.6.7, `@testing-library/jest-dom` 7.0.1 (needs Node 22 or newer), `jsdom`
    30.1.2 (needs 22.22.2 or 24.15 or newer; a lower 27.x or 26.1.0 is the fallback if vitest 3.2.x does not run with it).
    **Installed in Task 1 (2026-10-09), all five at the candidate versions:** `jsdom` 30.1.2, `@testing-library/react`
    16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1, `@testing-library/user-event` 14.6.7; the
    component test set-up runs with vitest 3.2.7 on Node 24.21, so no fallback was needed.
    Nothing is shipped to a phone. Fake timers (`vi.useFakeTimers`) test the 5 second notice and the 45 second limit
    without waiting. `vitest.config.ts` also gets: test files `*.test.ts` and `*.test.tsx`, the `@/` alias to `src/`, and
    `esbuild: { jsx: "automatic" }` because `tsconfig.json` keeps `jsx: "preserve"` for Next.js. The versions and the
    reason are written in `tech-stack.md` in Task 1.
11. **Smoke test on a real phone before the merge** (owner's choice), on the Netlify deploy preview. A preview has its
    own web address, which is not in the API's `CORS_ORIGINS`, so the browser would block every call. For the test the
    owner adds that one address to `CORS_ORIGINS` in Render by hand, and takes it out after the merge
    ([validation.md](validation.md), "Smoke test on a phone"). Whether the preview gets `NEXT_PUBLIC_API_URL` is checked
    in the same test.
13. **The owner's Figma Make file is a visual reference, not the spec (owner's rule, 2026-10-09).** The owner shares the
    details (frames, colours, spacing, text) before Task 4, when the components start. Where the Figma file and
    [ui-spec.md](../frontend/ui-spec.md) or the design rules differ (the tokens forest, pine, amber, paper, ink and
    emergency; tap targets of 48 px; text of 16 px or more; contrast; the standard states; 320 px wide), **the UI spec
    and the design rules win**. The Figma notes are in `docs/design/figma-find-page-design.md` (committed with Task 4),
    and Figma colours map to our tokens, never to hex values in components (ten role-named tokens were added to the UI
    spec for colours it had none for). Each difference is written down in the "Design differences" table of
    [validation.md](validation.md), with what was built and why, so the owner can decide whether to change the spec.
    Figma elements that the spec does not mention (extra sections, animations, images) are not built until the owner says
    so; they go in that table as "not built". Nothing is copied from Figma that costs weight on a slow phone (large images,
    web fonts) without asking.
12. **No new runtime package, no Leaflet on these pages.** The weight of `/find` and `/search` is read from the build
    output and recorded. Components are in `components/listings/` and `components/search/`, hooks in `hooks/`, the
    location store in `lib/location/`, and no component calls `fetch` (CLAUDE.md).
