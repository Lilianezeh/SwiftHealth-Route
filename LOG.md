# LOG.md — SwiftHealth

One entry per day. Keep it short and honest.

## Unattended run (started 2026-10-17): phases, pull requests and what to check

The owner asked for all remaining phases in one run, as stacked draft pull requests, each branching from the one before. Merge them in the order
of the table, from the top; after each merge, change the base of the next one to `main` (GitHub offers it). `Assumed decisions` point to the
"Assumed owner decisions" table of each phase's `requirements.md`: overrule any of them by telling me.

| Order | Phase | PR | Branch (base) | Preview | Check on your phone | Assumed decisions |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Step A: CORS for deploy previews | #24, merged 2026-10-17 | `fix/cors-netlify-previews` (main) | | Previews can call the API | |
| 1 | 7 SwiftRescue | PR_7 | `feature/swiftrescue` (main) | PREVIEW_7 | `/emergency`: 112 first and red; Call 112; Share emergency list opens WhatsApp with the text; Share my location asks, then offers WhatsApp or SMS; after one visit, airplane mode and reload still shows the page and the saved contacts. Production has no real emergency contacts yet, so the preview shows the "still adding" line | A1 to A10 in `specs/2026-10-17-swiftrescue/requirements.md` |

## To do later

Open reminders. Each says when it is due. Remove a line once it is done.

### Pre-launch checklist
Things the owner must do before real visitors use the site.
- [ ] **Read the WhatsApp brand terms (NFR-13)** (owner, 2026-10-15). Not read yet. The WhatsApp button uses the owner's downloaded WhatsApp glyph, only
  scaled (<https://www.whatsappbrand.com/>, which redirects to Meta's brand resource page). Read the live terms, check that the button's look
  (white button, dark green border, the glyph) and the words in `specs/2026-10-13-listing-page/requirements.md` D2 and the comments in
  `frontend/scripts/make-whatsapp-glyph.mjs` and `frontend/tests/unit/whatsappGlyph.test.ts` agree with them, and change the button if they do not.
  Deferred box in `specs/2026-10-13-listing-page/validation.md` (Security and privacy checklist).
- [ ] **Read Magnific's licence and attribution terms, and decide the hospital banner (NFR-13)** (owner, 2026-10-15). The type banners use Magnific photos
  with the credit "Designed by Magnific" (link <https://www.magnific.com>). Magnific's pages answered 403 to my tools, so I could not quote them: read
  <https://www.magnific.com/ai/docs/licenses-attribution> and <https://www.magnific.com/ai/docs/usage-rights-general-rules> in a browser, plus the licence
  file of each photo, especially for people shown in a health setting. Until then the hospital banner is off (`approved: false`,
  `specs/2026-10-15-find-by-type/requirements.md` D6). Also keep the download records (see "keep a record of where the home page photos come from").

- **Render collation provider (before the production `pg_trgm` check):** PostgreSQL 18 release notes say `pg_trgm`
  behaviour can change on clusters whose default collation provider is not libc. Local and CI use the image default
  (libc). Confirm that Render's database also uses libc, or reindex the `pg_trgm` indexes after any change.
- **Render Blueprint is on manual sync:** a new variable in `render.yaml` does NOT reach the service by itself, and
  changing `render.yaml` does not redeploy through the Blueprint. Add every new variable by hand in the dashboard
  (Environment, **+ Add Environment Variable**) and deploy. Seen twice: `CORS_ORIGINS` in phase 4, and
  `REPORTER_KEY_SECRET`, `SEED_DEMO_LISTINGS` and `REMOVE_DEMO_LISTINGS` in phase 5A (all three now in the dashboard).
  Still to add by hand: any variable a later phase adds (Paystack, Resend, Cloudinary, Termii keys). Keep `render.yaml` as
  the written record, and update the dashboard to match whenever it changes.
- **Phase 10b, a controlled list of service names (the real fix for service spellings):** services are free text today,
  so the same service can be saved as `X-ray`, `x-ray`, `Xray` or `X ray`. `GET /meta` and the `service` filter of
  `/search` already treat the first three as one service (phase 5B-0, `core/service_names.py`), and `/meta` shows the
  first spelling in plain alphabetical order (an all-capitals `X-RAY` would win over `X-ray`). `X ray` (with a space) is
  still a different service. The keeper decision (owner, 2026-10-09): keep that simple label rule, and in the phase 10
  listing editor let staff **pick** services from a controlled list of names instead of typing them. That removes
  `X ray` against `Xray`, the label quirk and typos at the source. It needs a place for the list (an admin-managed list,
  or the distinct names in use), which is a data-model question for the owner: the project has exactly 9 tables, so
  adding a table needs approval. The UI spec (3.4, "Services and fees") changes first.
- **Small backend PR after phase 5B-1: the next opening or closing time on the card.** Figma shows "Closes 9:00 PM" and
  "Opens 7:30 AM tomorrow" on each card. `ListingSummary` has no opening hours today (they are in `ListingDetail`, phase 6),
  so the card shows only the badge (owner's decision, 2026-10-09: keep it that way for now). Plan: `GET /search` returns a
  short text for the next change, for example "Closes 9:00 PM" or "Opens 7:30 AM tomorrow", computed in
  `search_service` with `services/hours.py` in Africa/Lagos time (the code that already decides open now), then the card
  shows it. The api-spec (`ListingSummary` gets a new field) and the UI spec change first; tests first, including past
  midnight, 24-hour places, closed days and the week wrapping. Then the frontend shows it in one line under the labels.
  **Backend done 2026-10-10 (PR #17, checked in production):** branch `feature/next-open-close-time`, folder `specs/2026-10-10-next-open-close-time/`. The
  field is `hours_note`, a ready-made text from the server (owner's decision). Owner's wording changes: full day names ("Opens
  Monday 7:30 AM"), "Closes at midnight" and "Opens at midnight" (never "12:00 AM"), and `null` when a listing has no hours
  recorded. The card change is the next small frontend PR: **done 2026-10-10 (PR #18, checked on the live site)**, branch
  `feature/hours-note-on-card`, folder `specs/2026-10-10-hours-note-on-card/` (owner's decisions: a grey `Clock` line under the address, nothing shown when
  `hours_note` is `null`).
- **Idea (owner, 2026-10-10): refresh the results when the tab is reopened after a long time.** The results, the "Open now"
  badge and `hours_note` are fixed at the moment they load, so a page left open overnight can still say "Opens 8:00 AM
  tomorrow" when it is already that morning. Idea: when the tab becomes visible again (the `visibilitychange` event) after,
  say, 30 minutes, load the results again (keep the filters and the page the visitor is on, or at least the first page). Decide
  the time limit, whether to keep "Load more" pages, and whether a small "Updated" notice is needed. A small frontend PR with
  its own spec, tests first; not part of the card change.
- **Idea (owner, 2026-10-11): a "Search this area" button on the map.** After the visitor moves the map, a button searches
  again for the part of the map on screen. Left out of phase 5B-2 on purpose: the API has no search by map area (it has
  `lat`, `lng` and `radius_km`), so it needs an api-spec change first (a bounding box, or the map centre and a radius), and
  the centre of the map must still never go into the address (NFR-07). Its own spec, tests first.
- **Before launch: review the map tile provider (owner, 2026-10-11).** Phase 5B-2 loads tiles from the public OpenStreetMap
  server, `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Read the OpenStreetMap tile usage policy
  (<https://operations.osmfoundation.org/policies/tiles/>) against our expected traffic and decide whether to keep it or move
  to another tile provider, which may have a cost and an API key. The address is in one place, `frontend/src/config/map.ts`,
  and the credit stays visible whichever provider is used (the new provider's own credit text). Due: before the public launch.
- **Before launch: say on the Privacy page that the map loads tiles from OpenStreetMap (owner, 2026-10-11).** When someone
  opens the map, their browser asks OpenStreetMap's servers for map tiles, so that service can see the visitor's IP address
  and which part of the map they look at. SwiftHealth does not send the visitor's position to it, does not put the map
  centre, zoom or position in an address and does not store them. The Privacy page (`/privacy`, "Coming soon") is part of
  NFR-07; write this in it, and have the final wording checked with the rest of the policy (NFR-13). Due: with the Privacy
  page, before launch.
- **After the Render upgrade: server-rendered listing pages for Google (owner's decision, 2026-10-11).** The listing page
  (phase 6b) loads its data in the browser, like `/search`, because the free API can take about a minute to wake and Netlify
  gives up on a server page after about 30 seconds. So Google cannot read the listing text yet (NFR-12, a Should). Once the API
  answers at once, render `/listing/[slug]` on the server, with a title and description per listing, and keep the browser
  load as the fallback. Needs its own spec, tests first.
- **Watch: a frontend test that failed once in a full run (seen 2026-10-11, home redesign branch).**
  `tests/unit/NearbySuggestions.test.tsx`, "asks for one open pharmacy and one 24-hour place, both with the position", failed
  (the output showed about 3.3 s for it) in one run of the whole frontend suite. It passed when run alone, and in every full run
  after it (574, 582 and 584 tests). The error text was not captured, so the cause is not known; the guess is timing under load
  (Docker on a laptop; the test limit is already 20 s). Nothing was changed in that test or in `NearbySuggestions`. If it fails
  again: copy the full error text and which other tests were running, run the file alone and then the full suite twice, and
  look for a timer or a shared state between tests (`vi.useFakeTimers`, `sessionStorage`, the `fetch` stub) before raising a
  limit. Remove this note after about 10 full runs with no failure.
- **Reminder: `hours_note` is English only (owner's decision, 2026-10-10).** "Closes", "Opens", "tomorrow", the day names and
  "midnight" are written in the backend code (`services/hours.py`). If SwiftHealth ever adds another language, this text needs
  translating, and at that point reconsider sending the time as data and formatting it on the frontend. Revisit before any
  second language is planned.
- **Small backend PR after phase 5B-1: all the spec categories in every database (found in the phone test, 2026-10-10).**
  The Filters sheet in production lists only Clinic, Pharmacy and Laboratory, because production has only the categories
  that the demo listings needed (`seed/demo_listings.py` adds just those). Categories are reference data, so every database
  needs all twelve of `seed_data.CATEGORIES` (the five everyday ones and the seven emergency ones), whatever listings it has.
  Plan (owner's idea, accepted): an idempotent Alembic data migration that inserts each missing category with
  `INSERT ... ON CONFLICT (slug) DO NOTHING`, with the same `is_emergency` and `recheck_days` values as the seed (14 days for
  emergency, 45 for the rest, FR-33), and never updates or deletes a row or touches `listings`. Safe to run twice. A seed
  script is not enough, because the production seed is flag-driven and does not run on deploy. Tests first (empty table, a
  table with three categories, a second run changes nothing, a renamed row stays as it is). **In progress (2026-10-10):**
  branch `feature/reference-categories`, folder `specs/2026-10-10-reference-categories/`. The recheck days come from FR-33
  in the PRD (14 and 45); nothing new.
- **Small frontend PR after the categories PR: hide the emergency categories in the Filters sheet (owner's decision,
  2026-10-10).** `GET /meta` keeps returning all 12 categories with `is_emergency` (the phase 10 editor needs them); the
  public Filters sheet (`FiltersDialog`) shows only the 5 everyday ones, because SwiftRescue (`/emergency`) groups the
  emergency categories and Blood has its own page. A shared link such as `/search?category=ambulance` must keep working
  (`/search` still accepts any slug) and keep showing a readable label for it. **Done 2026-10-10 (PR #16, checked on the live
  site):** folder `specs/2026-10-10-hide-emergency-filters/`. Owner's decisions: the list follows the
  Find shortcut order (Hospital, Clinic, Pharmacy, Maternity, Laboratory) with anything else after it, and an emergency
  category stays visible, with its real name, only while it is the one selected from a link.
- **Done 2026-10-10: all spec categories in every database (PR #15).** The migration ran in Render's log, production
  `GET /meta` returns 12 categories, the search total is still 4, and Hospital and Maternity show in Filters.
- **Decided on 2026-10-09 (Figma work, phase 5B-1):** (1) the focus ring is `forest` on light backgrounds and `paper` on a
  `forest` background (class `on-dark`), both well over 3:1; (2) `lucide-react`, exact version, one icon per import,
  decorative and always beside a label; (3) the card has no hours line until the backend PR above; (4) small text and links
  use `forest`, because the old green `pine` on `paper` was 4.4:1.
- **Decided on 2026-10-10 (colour change):** the green palette became blue. `forest` and `pine` are `#1B6F93`, `pine-dark`
  `#134F6A` is for hover and press, `accent` `#1A9FD2` is decoration only (the line under the header; 3:1 on white, so
  never behind text). Open, closed, amber and emergency colours, `paper`, `ink`, `ink-soft` and `line` did not change; the
  two light tints became light blues. The token names `forest` and `pine` were kept so no component had to change. Main
  blue is 5.6:1 on white and 5.1:1 on `paper`, so it now passes for small text on both.
- **`npm audit` in the frontend shows 11 findings (2 critical, 7 high, 2 moderate), the same before and after phase 5B-1's
  test packages (checked 2026-10-09):** the critical ones are `vitest` and `tinypool` (dev-only test runner; the fix is
  vitest 5, a major upgrade); the high ones are the `eslint-config-next` chain (`braces`, `micromatch`, `fast-glob`; dev-only),
  `postcss` inside `next`, and `sharp` (libvips CVEs; used by Next's image optimisation, which we do not use yet); `next`
  itself is moderate (the suggested fix is Next 16, a major upgrade, and `next` is pinned on purpose since React2Shell).
  None blocks the pilot. Review before launch (roadmap 13c or 14d) and plan the vitest 5 and Next upgrades as their own chores.
- **npm 11 install-scripts warning (Node 24 chore):** with Node 24 (npm 11.19) `npm install` warns that the install
  scripts of `esbuild`, `sharp` and `unrs-resolver` are "not yet covered by allowScripts" and suggests
  `npm install-scripts approve <package>`. Nothing is blocked today (lint, typecheck, tests and `next build` all pass).
  Watch for the day npm enforces it; then approve those three packages in `package.json`.
- **Node.js versions (check the schedule each autumn):** Node 20, which we run (frontend Dockerfile, `netlify.toml`, the
  frontend CI), reached end of life on 2026-04-30 (official [release schedule](https://github.com/nodejs/Release/blob/main/schedule.json),
  checked 2026-10-09). A chore moves the frontend to Node 24 (Active LTS until 2026-10-20, Maintenance LTS until
  2028-04-30). Node 22 ends 2027-04-30. Node 26 becomes LTS on 2026-10-28: move to it in 2027, well before 2028-04-30.
  Done after the Node 24 chore (PR #12, 2026-10-09): Netlify's deploy log shows Node 24.x and no `NODE_VERSION`
  override is set in the dashboard.
- **After the Render upgrade (phase 14d), results without JavaScript:** phase 5B-1 loads search results in the browser
  (45 s limit, because the free API takes up to a minute to wake and Netlify gives up on a server page after about
  30 s). That needs JavaScript, and Opera Mini's extreme mode, common in Nigeria, runs very little of it. NFR-04 names
  Opera Mini, while the PRD and the UI spec say nothing about no-JavaScript. When the API no longer sleeps, revisit
  server rendering for `/search` (the Find page search box is already a plain form, so it reaches `/search`).
- **Before the Render upgrade (phase 14d), position in Render's request logs:** the documentation says a Pro
  workspace or higher also keeps HTTP request logs with the "Requested URL", with no setting to redact it, and it does
  not say whether the query string is included ([Render logging](https://render.com/docs/logging)). Our own access log
  redacts `lat` and `lng` (phase 5B-0), but this one is Render's. Check what it holds before upgrading. If it holds the
  position, send it another way (for example in a POST body) and update the api-spec.
- **Phase 14d, release criteria:** the PRD asks for all Must requirements to pass on a low-cost Android phone on 3G.
  Phase 5B-1 gets an early check on the owner's own Android phone (deploy preview); the full check stays here.
- **Phase 5B, the Find page (5d):** offer category buttons (Hospitals, Clinics, Pharmacies, Maternity, Labs, as in
  FR-01) and nearby suggestions (for example the closest open pharmacy and the closest open 24-hour facility, from
  `GET /search` with the visitor's location), so a visitor can start without typing. Typing is hard on a phone and
  the search is tolerant of typos, but not of every typo (see the next item).
- **Search, typos in very short words (decide with real search logs):** a typo in a word of 3 to 5 letters can drop
  below the match line (uwni, hors, nigth; the scores are in the search `requirements.md`). A lower threshold cannot fix
  it without false matches ("pharaoh" scores the same as "nigth"). An edit-distance check per word (`levenshtein()` in
  the PostgreSQL `fuzzystrmatch` extension) would, but it is a new extension, so it needs the owner's approval.
- **Search, if listings grow into the thousands (after launch):** `search_service` computes distance and open-now in
  Python over every published listing that passes the SQL filters, and the `q` match scans the published listings
  with `word_similarity()` (no index). Add a bounding-box pre-filter or move distance into SQL, switch `q` to the `<%`
  operator with GIN `gin_trgm_ops` indexes on `listings.name` and `services.name`, and re-time `GET /search`
  (NFR-02: under 1 second).
- **Phase 9a, reports:** when a report is created, set `reporter_key = hash_reporter_key(phone or client IP)` (built in
  phase 5A). Never store the raw IP.
- **Phase 11a, resolving a report:** clear `reporter_key` as well as `reporter_phone` (NDPA; api-spec `PATCH` resolve rule).
- **Before launch, Render free plans (roadmap phases 14b and 14d):** the free API sleeps after 15 minutes idle (about
  a minute to wake). The free database expires 30 days after creation, about **2026-11-07** (confirm the exact date in
  the Render dashboard; Render allows 14 more days to upgrade, then deletes it) and has no backups. Upgrade both
  before launch. If the database lapses before then, recreate it from `render.yaml` and the data is only demo data.
- **Proxy count, recheck if Render changes:** `TRUSTED_PROXY_COUNT=3` on Render (client, Cloudflare, Render load
  balancer). Measured on 2026-10-08; see decision 5 in the phase 4 requirements. Recount after adding a custom domain
  or if Render changes its proxies, with a temporary endpoint that echoes `X-Forwarded-For`, and remove it afterwards.
- **Before the first real SMS (Termii):** activate the DND route on the account, get the sender ID approved, and set
  `TERMII_BASE_URL` from the dashboard (Settings, API token tab). Termii has no sandbox, so every real send costs
  balance. Also decide at the Render deploy whether to add a startup warning (lifespan) when no key is set; for now
  each no-key send logs a WARNING.
- **Auth, if the risk matters:** a challenge token plus its code can be used again until the token expires (5
  minutes), because the code is never stored (api-spec section 4). A one-time-use rule would need a small store.
  Also: Swagger's Authorize button does not work with our two-step login (`OAuth2PasswordBearer` only reads the
  header); test the API with the `Authorization: Bearer` header.
- **Rate limiter, if traffic grows:** sweep old IPs. An IP that stops calling keeps its list of timestamps in memory
  until it calls again (`core/rate_limit.py`).
- **CI path filters:** seen in PR #5: `Frontend CI` did not run on backend-only commits, so that direction works. Once
  the PR also changed `frontend/`, both workflows ran on every push, because a pull request is judged on its whole
  diff, not one commit. To see `Backend CI` skipped, use a pull request that changes only `frontend/`.
- **Brand renamed to SwiftHealth Route; check the CAC business name search before buying a domain or printing anything.** (Owner,
  2026-10-13.) The name is in one file, `frontend/src/config/brand.ts`; SwiftRescue stays as the emergency name. The repo, the
  folders and the Netlify address keep their old names.
- **Consider the layout check in CI (later).** `frontend/tests/end-to-end/home-layout.spec.ts` (Playwright, `npm run test:e2e`)
  measures the home page in a real browser at 320 to 1100 px. It is not in the pull request check on purpose (owner, 2026-10-13):
  the check has no browser, and adding one means an install step and a built site to open (slower). Revisit when more screens
  have a layout worth guarding; the Alpine container needs `apk add chromium` and `CHROMIUM_PATH=/usr/bin/chromium`.
- **Home page Total Blocking Time is red (1,300 ms): investigate after the listing page.** (Owner, 2026-10-13.) PR #21 is merged. On the
  live site (Incognito, Lighthouse mobile) the scores are Performance 73 (the preview before the speed work: 37), Accessibility 100,
  Best Practices 100, SEO 92; FCP 1.1 s, LCP 1.4 s, CLS 0.004, Speed Index 4.2 s, Total Blocking Time 1,300 ms (red). The record is
  in `specs/2026-10-11-home-redesign/validation.md`. Lighthouse's clues to follow: JavaScript execution 1.9 s; main-thread work
  4.7 s; 15 long tasks; forced reflow; document request latency (about 540 ms of estimated savings); legacy JavaScript 11 KiB; and
  the "Powered by Netlify" badge on the live site. About 101 kB of the JavaScript is the Next.js and React runtime, which cannot be
  removed. Needs its own small spec and a before and after measurement.
- **Later feature: privacy-friendly usage tracking (owner, 2026-10-13).** Three parts. (1) Visit analytics with a cookie-free
  tool: compare Cloudflare Web Analytics, GoatCounter and Umami; no Google Analytics. (2) Our own daily counts of searches and of
  Call, WhatsApp and Directions taps per listing, with no IP address, no location and no personal data. (3) Update the Privacy page
  to explain all of it. What the PRD already says: `specs/prd.md`, section "Analytics", asks for anonymous events only (searches
  with term, category and filters, listing views, Call taps, Directions taps, Emergency page opens, emergency list shares, reports
  submitted) and the roadmap lists it as phase 14c. It does not cover WhatsApp taps (FR-47 came later), a visit analytics tool, daily
  counts per listing, or what the Privacy page must say; and storing a search term can hold personal data, so decide in the spec
  whether to keep the term at all (NFR-07). Needs its own spec, tests first.
- **A new home page photo needs a new file name (owner's performance fix, 2026-10-13).** `netlify.toml` now caches `/images/*` for a
  year (`immutable`), because the photos were revalidated on every visit and Lighthouse scored 37 on mobile. A photo replaced under
  the same name would stay in visitors' caches, so change the `target` in `scripts/optimize-home-images.mjs` and the `src` in
  `src/config/home.ts` together. Check the header on the next deploy preview (`curl -I`).
- **The layout checks depend on the browser's fallback font (seen 2026-10-13).** `tests/end-to-end/home-layout.spec.ts` passes in the
  Alpine container's Chromium, but with Ubuntu's Chromium and DejaVu Sans (a wide font) the header is up to 27 px too wide between
  344 and 370 px and the 320 x 568 first screen needs 21 px more. The old build fails the same way, so it is the font, not a change.
  Real phones use their own system font (narrower). Decide later whether to design for the wider font (for example show the word
  "SwiftHealth" only from 372 px) or to pin a font in the check.
- **Phase 10 idea: photos on the facility owner sign-up and the login page (owner, 2026-10-13).** On the owner sign-up page, show a
  photo that matches the facility type the owner picks: Hospital = `hospital.jpg`, Clinic = `clinic.jpg`, Maternity =
  `maternity.jpg`, Pharmacy = `pharmacy.jpg`, Laboratory = `laboratory.jpg` (originals in
  `/mnt/c/Users/Lilian/Desktop/IMAGES/`). The photo swaps when the type changes and only the chosen photo downloads (one `<img>`
  whose `src` changes, not five loaded and hidden). The login page shows `hero.jpg`. None of these photos appear on the home page,
  and the Magnific credit appears on those pages only. Needs its own spec, tests first, and the licence terms of the Magnific
  photos checked first (NFR-13); WebP files made with `scripts/optimize-home-images.mjs`-style budgets.
- **Next feature after the listing page: "Find by type and home page wording" (owner, 2026-10-13). Not started: it needs its own spec in
  `specs/<date>-find-by-type/`, tests first, and a go-ahead on the plan.** Roadmap entry: "Find by type and home page wording".
  1. Rename the home section "Browse by type" to **"Find by type"**.
  2. A type tile shows **only** that type. Checked on 2026-10-13: the tile goes to `/search?category=<slug>` and the API filters on the exact
     slug, so no other type comes back (live check: hospital 4, clinic 2, maternity 2, pharmacy 6, laboratory 2, each only its own type).
  3. **A type word typed in the search box applies that type's filter.** Proposed words for Nigerian usage (all lower case, plural and
     spacing ignored; the whole query must be the type word, so "pharmacy ogui" stays a text search): *pharmacy*: pharmacy, pharmacies, chemist,
     chemists, chemist shop, drug store, drugstore, patent medicine, PPMV; *hospital*: hospital, hospitals, general hospital, teaching
     hospital, medical centre, medical center; *clinic*: clinic, clinics, health centre, health center, PHC, primary health centre,
     dispensary; *maternity*: maternity, maternity home, maternity centre, maternity center, midwife; *laboratory*: lab, labs, laboratory,
     laboratories, medical lab, diagnostic, diagnostics, diagnostic centre, diagnostic center. Not mapped on purpose: ambulance, police,
     fire and blood (they belong to SwiftRescue and the Blood page). The owner reviews the list; typos stay with the existing fuzzy text search.
  4. **A slim photo banner for the chosen type** at the top of the results, with a heading like "Pharmacies near you". Photos: the owner's
     Magnific files in `/mnt/c/Users/Lilian/Desktop/IMAGES/` (`hospital.jpg`, `clinic.jpg`, `maternity.jpg`, `pharmacy.jpg`,
     `laboratory.jpg`), converted with `scripts/optimize-home-images.mjs` to about 40 KB or less each, with alt text; only the chosen type's photo
     downloads. The required **"Designed by Magnific" credit with its link** shows under the banner, on the search page only, and only while a
     Magnific photo is showing. The photo list and the credit live in **one config file**, so Unsplash photos can replace them later; a replaced
     photo gets a **new file name** (the photos are cached for a year, `netlify.toml`). No readable brand names and no identifiable patients.
  5. **"Why" section:** the heading "Benefits" becomes **"Why SwiftHealth Route"** (the name comes from `config/brand.ts`) and the four cards read:
     "Verified information" / "Our team checks each listing before it goes live and re-checks it regularly."; "See what's open now" / "Find places
     open right now, including late-night and 24-hour services."; "Built for mobile data" / "Light pages built for a weak connection.";
     "Your location stays private" / "Your location is used only to show places near you. We don't store it." (Checked: the position is kept in the
     browser tab and sent to the API for each search; the API does not store it and scrubs `lat` and `lng` from its logs, api-spec "Privacy (NFR-07)".)
  6. **Facility owners section:** heading "Own or manage a healthcare facility?"; text "List your facility on SwiftHealth Route so people nearby can
     find you, call you and get directions. Listing is free during our launch, and every listing is checked by our team before it goes live."; the
     button stays "List your facility" (the page behind it is still "Coming soon", phase 10). "Free during launch" is the owner's decision, now in
     `specs/prd.md` (Open questions).
  7. **Hero and Overview:** hero heading "Find care that's open now, near you."; hero text "Verified hospitals, clinics, pharmacies and labs, with phone
     numbers, opening hours and directions."; the button "Find care near me" and the small line "Free to use · No sign-up needed" stay. Overview
     heading "What is SwiftHealth Route?"; text "SwiftHealth Route is a healthcare directory built for Nigeria. Find hospitals, clinics, maternity homes,
     pharmacies and laboratories near you, see which are open right now, and call or get directions in one tap. Our team checks every listing before it
     goes live and re-checks it regularly." ("Built for Nigeria" stays, the owner's decision.) The page's meta description is updated to match.
  8. **Empty search results (today and proposed).** Today `SearchStatus` says "No matches. Try removing a filter or widening the distance." (and the
     nearby cards say "No open pharmacy found nearby. Try a wider search."). Proposed: keep that first line when a filter is on, say "No places found
     near you yet." when there is no filter, and add a second line in both cases: **"We're starting in Enugu and adding more places soon."** (the search
     page may name the city; the home page does not). The owner confirms the exact words in the spec.
  9. Check that every new headline, line and card fits at **320, 360 and 768 px** without being cut off (the real-browser check).
  10. **The "Near you" section on `/find` must not show the same place twice (owner, 2026-10-13).** Seen on the live site: "DEMO – Always Open
     Pharmacy" was both "Closest open pharmacy" and "Closest open 24-hour place". Today the two cards in `NearbySuggestions` load on their own, each
     asking for `limit=1`, so neither knows what the other shows. Wanted: when both slots would show the same listing, the second slot shows the **next closest
     different 24-hour place** (so that card asks for `limit=2` and takes the first listing that is not the pharmacy card's; or the parent compares the two
     answers); if there is no other 24-hour place, show **one card with both labels** ("Closest open pharmacy" and "Closest open 24-hour place", spanning
     both columns) instead of two identical cards. Tests first: (a) two different answers show two cards; (b) the same listing first in both shows the
     second 24-hour listing in the second slot; (c) the same listing and no second one shows a single card with both labels; (d) the second card never
     shows a listing that the first one shows; (e) a failure or an empty answer in one card does not change the other; no position in any address.
  11. **A chosen type must be clearly visible on the results page (owner, 2026-10-14).** The owner tested the live site: tapping the Pharmacy tile
     correctly showed only the 2 pharmacies, but the page said only "Search results", so it looked unfiltered. Wanted, whenever a type is chosen
     (from a tile or from a typed type word, point 3): (a) the heading changes from "Search results" to the type's own words, e.g. **"Pharmacies near
     you"** (with the photo banner of point 4); (b) a visible **"Pharmacy ✕" chip under the search box** shows the active filter, and one tap on it
     removes the filter (the page then goes back to "Search results" and all types). The chip is at least 48 px high with 16 px text, the ✕ is an
     icon hidden from screen readers and the chip's name says "Remove the Pharmacy filter"; the heading and the chip come from the same category
     in the address, so they never disagree. Tests first: tile -> heading and chip; typed word -> the same; chip tap -> filter gone, heading back
     to "Search results", the other filters (open now, distance, area) kept; no chip and the plain heading when no type is chosen; the chip's
     position is not in any address beyond what the search already sends (NFR-07). Real-browser check at 320, 360 and 768 px.
- **Overview sentence to add back, and one to change (owner, 2026-10-13).** (a) The sentence "If a number doesn't work, you can tell us so we can fix it."
  was taken out of the Overview because the report form is still a "Coming soon" page: add it back when the report form is live (roadmap **Phase 9a**,
  `POST /reports` and the form, FR-20 and FR-21). (b) When the WhatsApp button is live (the listing page), change "call or get directions in one tap" in
  the Overview to "call, chat on WhatsApp or get directions in one tap".
- **Decide pricing (owner, 2026-10-13).** Basic listing free during launch. Paying never buys the verified badge. Featured listings follow FR-44 and FR-45:
  at most one, clearly labelled Sponsored, never in SwiftRescue (FR-19). Possible paid extras later: more photos, a monthly call and visit report. (The
  free-during-launch part is recorded in `specs/prd.md`, Open questions. The featured price is still the open placeholder of ₦5,000.00 per month.)
- **Before public launch: remove or clearly mark the demo listings, so every live "verified" claim is true (owner, 2026-10-13).** Already planned in part:
  roadmap **14d** removes them at the end (`REMOVE_DEMO_LISTINGS=true` on Render, redeploy, confirm `/search?q=DEMO` returns 0, set it back to `false`).
  Not planned: anything before then. The live site shows 4 fictional demo listings today next to the home page's words about verified listings, so
  either remove them earlier or add a visible "Demo" mark to every demo listing (card, page and map popup) until 14d. Decide with the owner.
- **Replace two Magnific photos before the "Find by type" feature (owner, 2026-10-13).** `hospital.jpg` shows a patient in a hospital bed with her face clearly
  visible (and is a tall 9:16 portrait, hard to crop into a slim banner); `maternity.jpg` is a doctor consultation with a pill bottle, not a maternity scene.
  `pharmacy.jpg` is optional to replace (its hands look slightly unnatural, so it may be AI-generated). `clinic.jpg` and `laboratory.jpg` are fine
  (no patients, no readable brand names at preview size). A replacement gets a new file name.
- **Idea: a small WhatsApp button on the search result cards (owner, 2026-10-13).** Not in the listing page phase. It needs the API to say whether a
  card's primary number is a WhatsApp number (`primary_phone_is_whatsapp` on `ListingSummary`, filled by the query that fills `primary_phone`; search, emergency
  and blood results share the shape) and an icon-only 48 px button after Call and Directions (the official glyph, accessible name "WhatsApp <name>").
  The map popups would stay as they are. Needs its own small phase, backend and frontend, tests first.

## Day 1 — 2026-10-04
- **Built:** Repo skeleton, Docker Compose, spike for open-now + nearest search.
- **Broke / fixed:** [ ]
- **Learned:** [ ]
- **AI use:** [ ]
- **Tomorrow:** [ ]

## Day 2 — 2026-10-05
- **Built:** First Alembic migration for all 9 tables (proved with upgrade, downgrade, upgrade).
  Demo seed data: 12 categories, 4 users (one per role), 30 fictional listings across all 10 areas,
  with phones, hours, services, blood groups, verification checks and audit entries. Safe to run twice.
  4 repository files (category, user, listing, audit). 28 tests passing, ruff clean.
- **Specs:** Fixed FR-33 label on publish; set re-check cycles (14 / 45 days); removed "groups needed"
  from donation centres (moved to Phase 3).
- **Broke / fixed:** passlib crashed with bcrypt 5.0.0; fixed by pinning bcrypt 4.0.1.
  Alembic couldn't import the app; fixed with prepend_sys_path in alembic.ini.
- **Learned:** [write this in your own words, e.g. what a migration is, why the seed never overwrites]
- **AI use:** Claude Code planned and wrote the migration, seed, repositories and tests;
  I reviewed the plan, chose the options, and approved each file.
- **Tomorrow:** Auth and roles (login, one-time code, JWT, role and ownership checks).

## Day 5 — 2026-10-08
- **Built:** Phase 3. Passwords are hashed with pwdlib (Argon2id) instead of passlib and bcrypt. Dev database reset
  with Alembic and re-seeded. 212 tests passing with `-W error`, ruff clean, no `crypt` warning.
- **Broke / fixed:** Smoke test first failed with 401 because my script used the test-fixture email domain, not the
  seed one. Not a code bug.
- **Learned:** [write this in your own words, e.g. why pwdlib raises on an unknown hash instead of returning False]
- **AI use:** Claude Code checked the pwdlib behaviour in the container, wrote the tests first, then the change;
  I approved the spec and the go-ahead for all three tasks.
- Tested login myself with curl: login → code from console → verify-code → /auth/me all worked;
  no token, wrong password, unknown email and wrong code all gave 401 as expected.
- **Security (Phase 4):** Netlify blocked the first deploy for CVE-2025-55182 (React2Shell). Upgraded `next` to
  15.5.27 and `react` and `react-dom` to 19.1.9, pinned exactly. 19.1.4 was not enough, because it is incomplete for
  CVE-2025-55183 and CVE-2025-55184. Advisories: [Next.js](https://nextjs.org/blog/CVE-2025-66478),
  [React](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components),
  [Next.js, December 11](https://nextjs.org/blog/security-update-2025-12-11),
  [React, December 11](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components).
  Details are in the Phase 4 `requirements.md`.
- **Phase 4:** API live on Render (https://swifthealth-api.onrender.com), site live on Netlify
  (https://swifthealth-ng.netlify.app), home page says "connected". Added the database address rewrite
  (`postgresql://` to `postgresql+psycopg://`) and `render.yaml` and `netlify.toml`. `TRUSTED_PROXY_COUNT` is 3,
  measured with a temporary endpoint (removed). The login rate limit held in production against forged
  `X-Forwarded-For` headers (10 attempts 401, the 11th 429). Production has no users, so a full login was not tested there.
- **Phase 4, problems:** the free-database limit stopped the first Blueprint run; `CORS_ORIGINS` was then missing
  because Render asks for `sync: false` values only at first creation (now a plain value in `render.yaml`); Netlify
  showed "Runtime: Not set" (now declared in `netlify.toml`; proven by redeploying with the dashboard overrides cleared).
- **Phase 4, cold start:** the first test failed. After 16 idle minutes the first Netlify visit returned an
  "Inactivity Timeout" error page after 31 s, because `getHealth()` had no time limit while the free Render API wakes
  (about a minute). Fixed with an 8-second limit (tests first). Second test after 21+ idle minutes: the first visit took
  11.7 s and showed "not reachable" on a normal page; the next visit showed "connected".
- **Tomorrow:** Phase 5, search (5a: `hours.py`, open now in Africa/Lagos time).

## Day 6 — 2026-10-09
- **Built:** Phase 5A, the search backend (draft PR #7). `hours.py` (open now in Lagos time, hours past midnight, 24-hour
  listings), `search_service` and `search_repository` (nearest first, overdue listings labelled `verification_due`,
  listings reported "not working" by 2 different reporters in 7 days hidden, misspelling-tolerant `q` with `pg_trgm`),
  `GET /search`. Also: `REPORTER_KEY_SECRET` and the keyed `hash_reporter_key` (so we never store a raw IP or phone to
  count reporters), PostgreSQL 18 locally and in CI like Render, flag-driven DEMO listings for production with an
  exact-slug cleanup, capitalised router tags, and a word rule for queries with two typos. 485 tests passing with
  `-W error` (242 before), ruff clean, CI green on `postgres:18`.
- **Timing (NFR-02):** `GET /search` on the 28 seed listings, 20 requests: median 25 ms, slowest 150 ms.
- **Broke / fixed:** my first two DEMO names produced the same slugs as the main seed, so the cleanup would have deleted
  main-seed listings in the dev database (a test caught it; renamed). "Nigt Pharmcy" scored 0.50 and found nothing:
  lowering the threshold added false matches ("banana" 0 to 4 listings), matching each word alone lost queries that
  worked, matching the whole query or every word fixed it with no false matches. One commit went in with a lint error
  and was amended before pushing. Claude edited files with `sed` and a Python script twice, against the rule to use
  the Edit tool; corrected after it was pointed out. Later the same day a small commit (the `search_text` rename,
  `ef9c010`) was pushed straight to `main` instead of a branch, because the working copy had been switched to `main`
  before the commit and the branch was not checked. The change was tested and CI stayed green, so it was left.
  Fixed for the future by a `pre-push` hook that refuses pushes to `main` (`scripts/hooks/pre-push`, install with
  `git config core.hooksPath scripts/hooks`) and a rule to check `git branch --show-current` before every commit and push.
- **Still open:** typos in very short words (3 to 5 letters) are not matched, see "To do later". The owner does the
  Render steps after the merge (`validation.md`, "After the merge").
- **Phase 5B-0 (draft PR, `GET /meta`):** `GET /meta` (areas, categories, services, blood groups, report reasons), the
  access log shows `lat=redacted&lng=redacted` (uvicorn was logging the full position), and one shared rule for "the same
  service" so that picking `X-ray` from `/meta` also finds `Xray` and ` x-ray ` (the old `service` filter missed them; tests
  written first showed it). 627 tests passing. The Node 20 end of life (2026-04-30) is a separate chore before 5B-1.
- **Learned:** [write this in your own words, e.g. what a trigram is and why a score of 0.50 is not enough]
- **AI use:** Claude Code compared the options with real scores, wrote the tests first and the code; I chose the
  options, approved the plan and decided what to keep out of scope.

- To do (after building): rename project to "SwiftHealth Route" and update the tagline (currently "Emergency, Hospital & Pharmacy Finder"). Before renaming, check that the name is free on Play Store and App Store, plus the domain, social handles and CAC business name. Then update app title, README, specs, pitch decks, project docs and the Netlify/Render names.

- To do: lint-on-edit hook uses the wrong ESLint for frontend files (no node_modules on host, so npx fetches ESLint 10, which can't read our config). Real lint (npm run lint in Docker, plus Frontend CI) still works. Fix later, probably by running ESLint inside the frontend container.

- Proposed (not final): product name "SwiftHealth Route", tagline "Hospitals, pharmacies and emergency help, open near you." The rename is pending a CAC business-name check and a trademark check (together with the Play Store, App Store, domain and social handle checks above). Do not rename anything until those checks pass; then apply it in the rename chore after 5B-1.

- **In progress (2026-10-11): the home page redesign with photos**, branch `feature/home-redesign`, folder `specs/2026-10-11-home-redesign/`: the hero, the category tiles, the new header and footer. Simplified on 2026-10-12 after the owner's review of the preview: two photos only (the hero and the owner photo), icon tiles instead of photo cards, no SwiftRescue photo band, no About part, no red button in the hero, and no city named on the page. Still to do, in phase 7: pictures on `/emergency` itself. They must not slow `/emergency`, which has to work offline (NFR-03).
- **Before launch: keep a record of where the home page photos come from (owner, 2026-10-12).** The first photos came from Magnific's free collection (ten were downloaded, two used) and the footer credited Magnific. On 2026-10-12 the owner replaced them with Unsplash photos and removed the credit. After a second round the page uses `hero3.jpg` (hero: stethoscope and blood pressure gauge) and `hero4.jpg` (facility owners: health worker with a blister pack); `owner2.jpg` and the first `hero4` crop are no longer used. The owner removed the credit, because the owner states that these photos need no attribution. Keep the page of each photo (the link, the photographer's name, the date) in one place, and have the licence terms of both sources checked with the rest of the legal review (NFR-13). We do not state here what either licence allows. The Magnific files are no longer on the site.
- **Home page buttons and "Coming soon" pages (2026-10-11; the home page has only the header's red button since 2026-10-12: "Emergency help" and "Open SwiftRescue" were removed).** The red header button goes to `/emergency`. The owner added a minimal page there in the home redesign (a red "Call 112" button and one line), until the full phase 7 page; 112 was checked against NCC pages (see `specs/2026-10-11-home-redesign/requirements.md`, decision 18). "List your facility" goes to `/list-your-facility` (phase 10) and "About" is phase 13b: both still say "Coming soon". The minimal page also carries the sentence of FR-26 ("SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In danger, call 112."), added at the owner's request (2026-10-12).

## Day 7 — 2026-10-10
- **Built:** Phase 5B-1, the Find page (`/find`) and the results page (`/search`), frontend only (branch
  `feature/search-frontend`). Search box, category shortcuts, "Open now near me", two "near you" cards that load on their
  own, `/blood` "Coming soon"; on `/search` the filters sheet (a native `<dialog>`), Load more, and the slow-API states
  (skeleton, "The service is waking up" after 5 s, error and Retry after 45 s). Location is asked only after a tap, once per
  tab, kept in `sessionStorage` rounded to 3 decimals and never put in an address. Also: `lucide-react` icons (decorative,
  beside text), the focus ring (forest, or paper on the forest header), and the blue palette (owner's colour change).
  342 tests passing, lint and typecheck clean. First Load JS: `/find` 114 kB, `/search` 115 kB.
- **Broke / fixed:** a pasted colour-change request arrived inside pasted text twice; Claude did not apply it until the
  owner typed the instruction in plain text. A test that passed alone timed out in the full run (slow laptop in Docker), so
  the test limit is now 20 s. A button test matched `bg-pine` inside `hover:bg-pine-50`; the pattern was made exact.
- **Still open:** the DevTools and phone smoke tests (owner), the small backend PR for "Closes 9:00 PM", the rename to
  "SwiftHealth Route" (pending CAC and trademark checks), the photo refresh of the home page (after 5B-2).
- **Learned:** [write this in your own words]
- **AI use:** Claude Code wrote the tests first and then the code for each task; I chose the design rules, approved the
  plan, the icon package and the colour change, and decided what to keep out of scope.

## Day 8 — 2026-10-11
- **Built:** Phase 5B-2, the map view on `/search` (FR-07), frontend only (branch `feature/map-view`, **done: merged as PR
  #19, `d4c1a94`**). `?view=map` and a
  List | Map toggle that adds a history entry (Back from the map returns to the list); plain Leaflet with OpenStreetMap
  tiles and the credit; a blue pin drawn in code; a dark dot for the visitor's position; popups with Call and Directions;
  pins reachable with the keyboard. The list stays the default and complete, and the address never holds a position,
  centre or zoom (NFR-07). `leaflet` 1.9.4 and `@types/leaflet` 1.9.22 are pinned exactly and `react-leaflet` is removed (it
  was already in `package.json` with `^` ranges, unused). 507 tests passing (100 new), lint and typecheck clean. First Load
  JS: `/search` 118 kB (115 kB before); the map is a separate 148 kB chunk, loaded only when it is shown.
- **Broke / fixed:** the first default map centre Claude picked was not in central Enugu; the owner gave the Holy Ghost
  Cathedral (6.4361, 7.4881) and it is now set, with a test. A test could not open a popup with Enter, because Leaflet reads the
  deprecated `keyCode` and the test tool does not send it, so Enter and Space are handled on `keydown`. Leaflet's own styles
  would turn the white text of the Call button blue and start at 12 px text; `map.css` overrides them (checked as rule text
  only: jsdom draws no CSS, so the smoke test must look at it).
- **Smoke test (owner, preview of PR #19, laptop and Honor phone): all passed.** Both pins framed together, popups with Call
  (white on blue) and Directions, large zoom and close buttons, readable credit, Back and Forward between List and Map, keyboard
  Tab, Enter and Esc on the pins, the map files loaded only after tapping Map (laptop, Chrome throttled to 3G, cache disabled,
  on Wi-Fi through the phone's hotspot), 320 px with no page-level sideways scroll; on the phone (mobile data) pinch zoom, Call
  opens the dialler, Directions opens Google Maps. The backend `CORS_ORIGINS` was changed for this test and is back to the live
  site only.
- **Still open:** the three reminders in "To do later" (Search this area, the tile provider review, tiles on the Privacy
  page); the home page photo refresh is now free to start.
- **Learned:** Never trust a coordinate without checking it: the default map centre was 6 km off, and I caught it by checking it in Google Maps and picking Holy Ghost Cathedral myself. I also learned that a big library like a map can load only when someone taps for it, so people on slow data who just want the list don't pay for it.
- **AI use:** Claude Code wrote the spec first, then the tests and the code for each task; I chose the pin and dot design,
  the keyboard rules, the history entry for the toggle and the default centre, and decided what to keep out of scope.
- **Tomorrow:** phase 6, the listing page (`GET /listings/{slug}` and the Call and Directions page, US-02, US-03, US-06,
  US-07), or the home page photo refresh; the owner chooses.

## Day 8, part 2 — 2026-10-11
- **Built:** Phase 6a, `GET /listings/{slug}` (backend only; branch `feature/listing-detail-api`, **done: merged as PR #20,
  `6fdb5fa`**). A published listing with its phones (the primary first), 7 opening-hours entries (`HH:MM`; a day with no hours
  is closed), services with fees as 2-decimal strings, the fixed disclaimer, `hours_note`, `is_open_now` and
  `verification_due`; anything not published and any unknown slug give the same 404 "Listing not found". New field
  `recently_reported_not_working`: a listing that 2 different reporters called "not working" in 7 days is hidden from search
  but still opens from its link, so the page can warn. New column `phone_numbers.is_whatsapp` (default false, with a migration
  that is safe on filled tables; the seed and demo data never set it), and a new requirement FR-47 (Should), the WhatsApp
  button of phase 6b. One shared `is_verification_due` rule for search and the listing page. 769 backend tests passing, ruff
  clean; Backend CI green.
- **Broke / fixed:** the first full-suite run never started, because I wrote its output to a scratch folder of an old session
  that no longer existed. Two test runs at the same time shared the test database, which caused 2 failures and very slow runs;
  from then on only one test process at a time (the same tests passed alone). Docker Desktop's WSL integration was off for a
  while, so no test could run until the owner turned it back on. WhatsApp was first written into FR-10 and then moved to its own
  FR-47 on the owner's instruction (FR-10 has its original wording). An older test said the categories revision was the only
  migration head; it now checks that the history has one head.
- **Production (owner):** Render ran the migration; `/listings/<slug>` returned the listing with `is_whatsapp` false on every
  phone, 7 `opening_hours` entries, `recently_reported_not_working` false and an `hours_note`; `/listings/does-not-exist`
  returned 404 "Listing not found"; the search total is still 4; `/docs` lists `GET /listings/{slug}`.
- **Still open:** phase 6b, the listing page (the owner's decisions for it are in
  `specs/2026-10-11-listing-detail-api/requirements.md`); the "Search this area", tile provider and Privacy page reminders; the
  `wa.me` link format still has to be checked on WhatsApp's own help page before 6b builds it; server-rendered listing pages
  for Google (after the Render upgrade).
- **Learned:** When tests fail for strange reasons, check the setup first. Docker had switched off, and two test runs at once broke each other, but the code was fine.
- **AI use:** Claude Code wrote the spec first, then the tests and the code for each task; I chose the WhatsApp flag and its
  rules (default false, never set by the seed), FR-47 as its own requirement, that a reported listing stays reachable with a
  warning, the one shared rule for "verification due", and the decisions for the page (12-hour times, fee wording, the
  notice, the new Directions icon).
- **Tomorrow:** phase 6b, the listing page (`feature/listing-page`): spec first, then tests, then the page.

## Day 9 — 2026-10-13 and 2026-10-14
- **Built:**
  - **PR #21 (home page redesign) merged and live.** Lighthouse mobile on the live site, from the owner's own run: Performance 73, Accessibility 100,
    Best Practices 100, SEO 92 (the preview before the speed work: 37).
  - **Rename to SwiftHealth Route, with a new logo.** The name lives in one file, `frontend/src/config/brand.ts`; the repo, the folders and the Netlify
    address keep the old name.
  - **Docker as user 1000 for the frontend and the backend** (`5d907fa`, `95f4380`), so files the containers write belong to the owner, not root. The
    backend setting is in `docker-compose.yml` only, because Render builds the backend Dockerfile.
  - **The listing page, phase 6b (draft PR #22, branch `feature/listing-page`).** Call and WhatsApp (white button, the owner's glyph, only for numbers
    marked as WhatsApp), the Directions road-sign icon at 24 px, 12-hour hours with "Today", fees, the amber "reported" note, entrance photo, Share via
    WhatsApp and Copy link, and a friendly "Listing not found". After the owner's review: Call and WhatsApp the same 56 px height, phone numbers shown
    in local format (0803 123 4567) with the main number as a line under the buttons, the Verified badge fitting its content, "Ask for price" when a
    service has no fee, and the page's own JavaScript target set to 9 kB (8.58 kB built; First Load 115 kB). A local, development-only fictional
    fixture (`python -m seed.whatsapp_fixture`) shows the cases the demo data hides on purpose. 833 frontend and 790 backend tests passing; real-browser
    checks 23 of 23; Frontend CI and Backend CI green.
  - **The "Find by type and home page wording" plan is recorded** (this file, "To do later", items 1 to 11, and the roadmap), not built. The latest
    item: a chosen type must be clearly visible on the results page, with a "Pharmacies near you" heading and a removable "Pharmacy ✕" chip.
- **Broke / fixed:** the owner tested on the laptop with the repo on `main`, so the old code showed and the new work did not; checking the branch
  first fixed it. The browser-test libraries kept in the session scratch folder were gone the next day and had to be downloaded again. `gh pr edit`
  fails on this repo (a Projects classic warning), so the pull request text is changed through `gh api`. Pasted messages are not acted on until the
  owner types "yes, apply it".
- **Owner's checks (all passed, 2026-10-15):** Honor phone on the preview (diamond icon on the cards and the page, the main number line in local
  format, Copy link pastes only `/listing/<slug>`, Share via WhatsApp opens WhatsApp with the link, `/listing/nothing-here` shows "Listing not
  found", demo listings show no WhatsApp button as designed) and the laptop (WhatsApp in Option A beside Call at the same height, "Front desk · 0000
  000 0951", the compact Verified badge, "Ask for price", "Today", fee styles, amber note). The boxes of `specs/2026-10-13-listing-page/validation.md`
  and `plan.md` are ticked, except one box deferred to pre-launch: the WhatsApp brand terms (NFR-13), now in "Pre-launch checklist" at the top.
- **Production (owner, 2026-10-15): PR #22 is merged (`53ab2ca`) and live.** Checked on the live site, all passed: the diamond Directions icon on
  the search cards and listing pages, the main number line in local format, Copy link and Share via WhatsApp, the "SwiftHealth Route" disclaimer
  (after the Render redeploy), and `/listing/nothing-here` showing "Listing not found". The preview address was removed from `CORS_ORIGINS` on
  Render. Results are in `specs/2026-10-13-listing-page/validation.md`.
- **Still open:** the home page Total Blocking Time (1,300 ms); the WhatsApp brand terms (NFR-13) in "Pre-launch checklist".
- **Learned:** Before testing on my laptop, check which branch I'm on, because I was testing old code on main. Demo data can hide features on purpose (no WhatsApp on fake numbers). And always measure first: Lighthouse showed my photos were already small and the code was the slow part.
- **AI use:** Claude Code wrote the specs first, then the tests and the code; I chose the WhatsApp button's look, the local phone format, "Ask for
  price", the 9 kB target, the Find by type wording and the chip, and I checked the preview on my own phone.
- **Tomorrow:** the next feature, "Find by type and home page wording" (spec and plan first; branch `feature/find-by-type`).
