# SwiftHealth: roadmap

The order we build things in, in very small phases. Each phase is one small slice of work (backend and
frontend together where it has both), takes about a day, and is finished with its tests. If a phase turns out
bigger than that, split it before starting.

Details are not repeated here. Each phase names its requirement IDs from [prd.md](prd.md); the exact contracts
are in [backend/api-spec.md](backend/api-spec.md) and [frontend/ui-spec.md](frontend/ui-spec.md). Open reminders
are in "To do later" in [LOG.md](../LOG.md).

Status: **Done**, **In progress**, **Next**.

## Phases

### Phase 0: Foundations. Done
Repo skeleton, Docker Compose, and the spike for "open now, nearest first" search.

### Phase 1: Database and seed. Done (merged, PR #1)
First migration for all 9 tables, demo seed data, first repositories. FR-15, FR-27, FR-28, FR-31, FR-33, FR-38.

### Phase 2: Auth and roles. Done (merged, PRs #2 and #3)
FR-30, NFR-06. Feature folder: [requirements](2026-10-05-auth-and-roles/requirements.md),
[plan](2026-10-05-auth-and-roles/plan.md), [validation](2026-10-05-auth-and-roles/validation.md).

Pull requests: PR #2 merged Tasks 0 and 1 into `main` early. PR #3 merged the rest (Tasks 2 to 6 and the extra
tasks 2b, 3b, 4a to 4c).

- Task 0, spec, CLAUDE.md and dependency: **done**
- Task 1, `core/security.py` (password check and JWT helpers): **done**
- Task 2, rate limiter: **done**
- Task 2b, database, repositories, seed and tests converted to async: **done**
- Task 3, Termii integration: **done**
- Task 4a, the CI split into `backend.yml` and `frontend.yml` (no `httpx2`, no `TestClient` left): **done**
- Task 3b, JWT secret check at startup (`APP_ENV`): **done**
- Task 4b, async PostgreSQL test database and fixtures: **done**
- Task 4c, schemas, repository, auth service and routes: **done**
- Task 5, `require_role` and listing access rules: **done**
- Task 6, wrap-up and smoke test: **done**. Pull request #3 stays a draft until the merge checklist is complete.

### Phase 3: Move password hashing to pwdlib. Done (merged, PR #4)
Replace passlib and bcrypt with pwdlib, re-seed the demo users, and drop the passlib `crypt` warning.
It sits right after auth because the re-seed is painless while we only have demo data. NFR-06.
Feature folder: [requirements](2026-10-08-pwdlib-password-hashing/requirements.md),
[plan](2026-10-08-pwdlib-password-hashing/plan.md), [validation](2026-10-08-pwdlib-password-hashing/validation.md).

- Task 0, spec and library check: **done**
- Task 1, swap the hashing library (tests first): **done**
- Task 2, re-seed and wrap-up: **done**

### Phase 4: Walking skeleton in production. Done (merged, PR #5)
`/health` on Render, a minimal page on Netlify that calls it through `lib/api/`, HTTPS and environment variables.
NFR-05, NFR-06. Live: API https://swifthealth-api.onrender.com, site https://swifthealth-ng.netlify.app.
Feature folder: [requirements](2026-10-08-walking-skeleton-production/requirements.md),
[plan](2026-10-08-walking-skeleton-production/plan.md), [validation](2026-10-08-walking-skeleton-production/validation.md).

- Task 0, spec and hosting documentation check: **done**
- Task 1, backend ready for Render (`render.yaml`, database address check, CORS tests): **done**
- Task 2, frontend ready for Netlify (`netlify.toml`): **done**
- Task 2b, security upgrade of `next`, `react` and `react-dom` (React2Shell): **done**
- Task 3, deploy by the owner, smoke test and `TRUSTED_PROXY_COUNT` (3): **done**, including the `netlify.toml`-only
  deploy
- Task 3b, cold-start fix (`getHealth()` stops waiting after 8 seconds): **done**
- Task 4, wrap-up: **done**

Phase 5 was bigger than a day, so it is split in two. The phase numbers after it stay the same.

### Phase 5A: Search backend. Done (merged, PR #7)
US-01, US-05. The hard part. FR-04, FR-05, FR-06, FR-08, FR-22, NFR-02, NFR-08.
Feature folder: [requirements](2026-10-09-search-backend/requirements.md),
[plan](2026-10-09-search-backend/plan.md), [validation](2026-10-09-search-backend/validation.md).
- 5a: `hours.py`, open now in Africa/Lagos time, hours that cross midnight, and 24-hour listings always open
- 5b: `search_service`, distance order, and the labelling and exclusion rules: overdue listings are labelled
  `verification_due` and stay visible (FR-08); listings reported "not working" by 2 users in 7 days are excluded (FR-22)
- 5c: `GET /search`

Tasks:
- Task 0, spec and `pg_trgm` check on Render: **done**
- Task 1, `hours.py` (5a): **done**
- Task 1b, `REPORTER_KEY_SECRET` and `hash_reporter_key`: **done**
- Task 1c, PostgreSQL 18 in Docker Compose and backend CI: **done**
- Task 2, `search_service`, repository and migration (`pg_trgm`, `user_reports.reporter_key`) (5b): **done**
- Task 3, `GET /search` (5c): **done**
- Task 3a, router tags with a capital letter: **done**
- Task 3b, flag-driven demo listings for production, with an exact-slug cleanup: **done**
- Task 3c, queries with two typos (each word is matched too): **done**
- Task 4, wrap-up and local smoke test: **done**. After the merge the owner did the four Render steps in
  [validation.md](2026-10-09-search-backend/validation.md), "After the merge": `REPORTER_KEY_SECRET` added, deploy
  Live, `/health` ok, 4 demo listings seeded, live search checked (2026-10-09). The Render Blueprint is on manual sync,
  so the three variables (`REPORTER_KEY_SECRET`, `SEED_DEMO_LISTINGS`, `REMOVE_DEMO_LISTINGS`) were added by hand. Known limit: typos in words of 3 to 5 letters can still be missed (see "To do
  later" in [LOG.md](../LOG.md)).

The spike `spikes/open_now_nearest.py` still hides overdue listings; the real search labels them (FR-08), and
`backend/tests/unit/test_search_service.py` checks that.

### Phase 5B: Search frontend. Done (merged: 5B-0 PR #10, 5B-1 PR #14, small PRs #15 to #18, 5B-2 PR #19)
US-01, US-05. Needs 5A merged. It was bigger than a day and needed `GET /meta`, so it is split in three. The phase
numbers after it stay the same.

#### Phase 5B-0: GET /meta and no position in the logs. Done (merged, PR #10)
FR-03, FR-05, NFR-07. A small backend feature, so that 5B-1 can be frontend-only. Feature folder:
[requirements](2026-10-09-meta-endpoint/requirements.md), [plan](2026-10-09-meta-endpoint/plan.md),
[validation](2026-10-09-meta-endpoint/validation.md).
- Task 0, spec: **done**
- Task 1, `GET /meta` (tests first): **done**
- Task 2, `lat` and `lng` redacted in the API access log (tests first): **done**
- Task 2b, one rule for "the same service" in `/meta` and the `service` filter of `/search` (found and fixed a miss:
  `X-ray` did not find `Xray`): **done**
- Task 3, wrap-up and the owner's after-merge steps (live `/meta`, a live search with a location, and the Render Logs
  check for `lat=redacted`): **done**. On 2026-10-09 the owner reported: deploy Live, `/meta` shows the lists, a live
  search with lat 6.45 and lng 7.5 gave distances, `service=Xray` found the X-ray listing, and Render's Logs show
  `lat=redacted&lng=redacted` with no real numbers. No new Render variable was needed.
- `GET /meta` also returns `services` (owner's decision, 2026-10-09): the distinct names of published listings, without
  the blood groups, for the results page filter.

#### Chore between 5B-0 and 5B-1: Node.js 24 LTS for the frontend. Done (merged, PR #12)
Node 20 reached end of life on 2026-04-30 (official [release schedule](https://github.com/nodejs/Release/blob/main/schedule.json),
checked 2026-10-09). On that date Node 24 is the Active LTS (until 2026-10-20, then Maintenance LTS until 2028-04-30);
Node 22 is Maintenance LTS until 2027-04-30; Node 26 becomes LTS on 2026-10-28. Next.js 15.5.27 accepts any Node 20 or
newer (`engines`), and Netlify takes a major version in `NODE_VERSION`. So one small frontend-only pull request,
`chore/node-24-lts`: `frontend/Dockerfile` (`node:24-alpine`), `netlify.toml` (`NODE_VERSION = "24"`),
`.github/workflows/frontend.yml` (`node-version: "24"`), `@types/node` to the Node 24 line, and a line in
[tech-stack.md](tech-stack.md). Lint, typecheck, tests and `npm run build` must pass on Node 24, and the Netlify
deploy preview must build with it. It is also the first frontend-only pull request, so it doubles as the CI path check:
`Frontend CI` runs and `Backend CI` does not (`gh pr checks` is written in the pull request). Move to Node 26 LTS in
2027, before Node 24 ends on 2028-04-30 (see `LOG.md`).

- Result of the CI path check (pull request #12): `Frontend CI` ran and passed, `Backend CI` did not start. Lint,
  typecheck, 12 tests and `next build` passed on Node 24 (every page 103 kB First Load JS).
- After the merge the owner reported (2026-10-09): Netlify's deploy log shows Node 24.x, no `NODE_VERSION` override is
  set in the Netlify dashboard, and the live site still says "connected".

#### Phase 5B-1: Find page and results page. Done (merged, PR #14)
US-01, US-05, FR-01, FR-03 to FR-06, FR-08. Feature folder: [requirements](2026-10-09-search-frontend/requirements.md),
[plan](2026-10-09-search-frontend/plan.md), [validation](2026-10-09-search-frontend/validation.md). Frontend-only:
`Backend CI` must not run on it either.
- 5d: Find page and location permission (FR-01, FR-03), category buttons and nearby suggestions
- 5e: results page with filters (FR-04, FR-05, FR-06), loaded in the browser with a 45 s limit
- Task 0, UI spec: **done**
- Task 1, component test tooling: **done**
- Task 2, types and API layer: **done**
- Task 3, location: **done**
- Task 4, cards and small parts (with the Figma reference mapped to design tokens): **done**
- Task 5, the Find page: **done**
- Task 5b, blue palette (owner's colour change, 2026-10-10): **done**
- Task 6, the results page: **done**
- Task 7, wrap-up: checks and build **done** (`/find` 114 kB, `/search` 115 kB first load); merged (PR #14); the owner's
  phone test found the small PRs below

#### Small PRs after 5B-1 (found in the phone test, 2026-10-10)
- **All spec categories in every database** (backend, `feature/reference-categories`): an idempotent Alembic data migration
  that adds the 12 categories production was missing. Feature folder: [requirements](2026-10-10-reference-categories/requirements.md),
  [plan](2026-10-10-reference-categories/plan.md), [validation](2026-10-10-reference-categories/validation.md). **Done:** merged and deployed (PR #15); production `GET /meta`
  returns 12 categories.
- **Hide the emergency categories in the Filters sheet** (frontend, `feature/hide-emergency-filters`): **done**, merged and
  checked on the live site (PR #16). The public sheet shows only the five everyday categories, in the Find order; `GET /meta` stays as it is. Feature folder:
  [requirements](2026-10-10-hide-emergency-filters/requirements.md), [plan](2026-10-10-hide-emergency-filters/plan.md),
  [validation](2026-10-10-hide-emergency-filters/validation.md).
- **The next opening or closing time on search results** (backend, `feature/next-open-close-time`): **done**, merged and
  checked in production (PR #17).
  `GET /search` returns `hours_note` ("Closes 9:00 PM", "Opens Monday 7:30 AM"), worked out in Africa/Lagos time. Feature
  folder: [requirements](2026-10-10-next-open-close-time/requirements.md), [plan](2026-10-10-next-open-close-time/plan.md),
  [validation](2026-10-10-next-open-close-time/validation.md). Next: a small frontend PR that shows it on the card
  (`feature/hours-note-on-card`): **done**, merged and checked on the live site (PR #18): [requirements](2026-10-10-hours-note-on-card/requirements.md),
  [plan](2026-10-10-hours-note-on-card/plan.md), [validation](2026-10-10-hours-note-on-card/validation.md).

#### Phase 5B-2: Map view. Done (merged, PR #19)
FR-07 (Should). The List | Map toggle and the Leaflet map on `/search`. Merged and checked on the preview (2026-10-11). Feature folder:
[requirements](2026-10-11-map-view/requirements.md), [plan](2026-10-11-map-view/plan.md),
[validation](2026-10-11-map-view/validation.md). Frontend-only: `Backend CI` must not run on it.
- Task 0, spec (UI spec, feature folder, roadmap, `LOG.md` reminders): **done**
- Task 1, exact Leaflet pins (no `react-leaflet`), `view` helpers and map constants: **done**
- Task 2, the map: blue pin drawn in code, position dot, popups with Call and Directions, keyboard, credit: **done**
- Task 3, the List | Map toggle (adds a history entry) and `?view=map` on `/search`: **done**
- Task 4, wrap-up: build and page weight **done** (`/search` 118 kB first load, the map is a separate 148 kB chunk); pull
  request #19 `Frontend CI` green; the smoke test on the preview (laptop, 320 px, keyboard, Honor phone) **done, all
  passed**; **merged** (`d4c1a94`)
- Still to do before launch (`LOG.md`, "To do later"): "Search this area", the tile provider review, and map tiles on the
  Privacy page.

### Home page redesign (phase 13a, pulled forward by the owner, 2026-10-11). In progress (branch `feature/home-redesign`)
US-13, NFR-01, FR-02, NFR-04, NFR-10, NFR-07, NFR-12. Frontend-only: `Backend CI` must not run on it. Feature folder:
[requirements](2026-10-11-home-redesign/requirements.md), [plan](2026-10-11-home-redesign/plan.md),
[validation](2026-10-11-home-redesign/validation.md). The new home page in 9 parts, the new header (with a phone menu) and
footer (with the photo credit), and 10 photos converted to WebP for 3G, with a smaller hero for phones. It also replaces the
"Coming soon" text of `/emergency` with a minimal page (a red "Call 112" button), until phase 7. Phase 6b waits for its own
branch after this one.
- Task 0, spec (UI spec layout and 2.1, feature folder, roadmap, `LOG.md`): **done**
- Task 1, the photos (script, WebP files, alt text): **done**
- Task 2, header and footer: **done**
- Task 3, hero, how it works, browse by type, why SwiftHealth: **done**
- Task 4, the band, the facility part, About, the page: **done**
- Task 5, the minimal `/emergency` page (a red "Call 112" button; the owner's addition, 112 checked against NCC pages): **done**
- Task 7, a simpler home page after the owner's review of the preview (2026-10-12: two photos, icon tiles, a lighter hero with one
  photo that overlaps into the next section, no band, no About, no red hero button, no city): **done** (589 tests); the owner's review
  of the new preview is next
- Task 8, new hero and owner photos (Unsplash, from `hero4.jpg` and `owner2.jpg`; `hero3.jpg` unused) and no photo credit in the
  footer: **done** (591 tests); the owner's review of the new preview is next
- Task 9, other photos (`hero3` hero, `hero4` whole in the owners part), a sky blue hero (new `sky` token), an Overview part,
  "Why SwiftHealth" renamed "Benefits", "Find care" hidden in the header on the home page, and a logo and favicon: **done**
  (622 tests; `/` is static, 113 kB first load JS); the owner's review of the new preview is next
- Task 10, a hero like the reference site (owner, 2026-10-12): transparent header on the home page, a sky blue gradient with white
  text, the photo filling the right side with a slanted edge, no How it works, Benefits as a blue band, and the new order: **done**
  (632 tests; `/` is static, 113 kB first load JS); the owner's review of the new preview is next
- Task 11, fixes after the owner's review (2026-10-12): owners photo smaller with the text beside it, the footer in the page
  container and no beige band, a shorter softer veil, tablets use the phone hero up to 1024 px: **done** (637 tests); the
  owner's review of the new preview is next
- Task 6, wrap-up: checks and build **done** (584 tests; `/` is static, 113 kB first load JS); draft pull request next; the owner's
  review on the preview

### Phase 6: Listing page. In progress
US-02, US-03, US-06, US-07. Split in two pull requests, like phase 5: the API first, then the page (owner, 2026-10-11).

#### Phase 6a: `GET /listings/{slug}`. Done (merged, PR #20)
FR-09 to FR-11, FR-13, FR-47, US-06, US-07, FR-08, FR-22. Backend-only: `Frontend CI` must not run on it. Feature folder:
[requirements](2026-10-11-listing-detail-api/requirements.md), [plan](2026-10-11-listing-detail-api/plan.md),
[validation](2026-10-11-listing-detail-api/validation.md). It also records the owner's decisions for 6b. It adds one column,
`phone_numbers.is_whatsapp` (default false, with a migration); the project still has exactly 9 tables.
- Task 0, spec (api-spec, PRD FR-47, feature folder, roadmap, `LOG.md`): **done**
- Task 1, `is_whatsapp`: model and migration: **done**
- Task 2, the repository: **done**
- Task 3, schemas and service: **done**; Task 3b, one shared `verification_due` rule for search and the page: **done**
- Task 4, the route: **done**
- Task 5, wrap-up: full suite **done** (769 passed, ruff clean); pull request #20 `Backend CI` green and **merged**
  (`6fdb5fa`); production checked by the owner (the migration ran, `/listings/<slug>` answers, an unknown slug is a 404,
  `/docs` lists it, search total still 4)

#### Phase 6b: the listing page. Next (branch `feature/listing-page`, 6a is merged)
US-02, US-03, FR-09 to FR-13 and FR-47 (FR-12 Share and FR-47 WhatsApp are Shoulds). The page with Call, WhatsApp (for numbers marked as WhatsApp) and
Directions buttons, the 12-hour hours table, the fees, share, the report link and the notice for a reported listing. It loads
in the browser, like `/search`. It also changes the Directions icon everywhere (cards, map popups, the page) to a diamond road
sign with a right-turn arrow, drawn in code. Its feature folder and the UI spec 2.4 changes come first (Task 0). The owner's
decisions are in the 6a requirements (6b decisions 1 to 10).

### Phase 7: SwiftRescue, the emergency section. Next
US-04, US-09, US-14.
- 7a: `GET /emergency`
- 7b: page with 112 first and grouped contacts (FR-14, FR-15, FR-16, FR-19, FR-26)
- 7c: share the emergency list and share my location (FR-18, FR-24)
- 7d: offline cache (FR-17, NFR-03)
- 7e: nearby 24-hour pharmacies (FR-25)

### Phase 8: Blood. Next
US-15, US-16.
- 8a: find blood, API and page (FR-27)
- 8b: donate blood, API and page (FR-28, FR-29)

### Phase 9: Reports. Next
US-08.
- 9a: `POST /reports` and the report form (FR-20, FR-21)
- 9b: automatic urgent flag after 2 "not working" reports in 7 days (FR-22)

### Phase 10: Staff screens and "List your facility". Next
US-10.
- 10a: staff login screen (FR-30, FR-42)
- 10b: admin listings list and listing editor (FR-31). Services are **picked from a controlled list of service names**,
  not typed, so "X ray" and "Xray" cannot both exist and the `/meta` label is always the same spelling (owner's
  decision, 2026-10-09; see "To do later" in [LOG.md](../LOG.md)). Where the list lives (a new table needs the owner's
  approval, since the project has exactly 9 tables) and the UI spec 3.4 are decided first.
- 10c: verification log and status moves: submit, publish, hide, reopen (FR-32)
- 10d: "List your facility" form and submissions arriving as drafts (FR-37)
- 10e: admin manages staff accounts and roles (FR-41)

### Phase 11: Reports queue, re-checks and dashboard. Next
US-11, US-12.
- 11a: reports queue (FR-35)
- 11b: nightly re-check job and automatic hide on failed re-check (FR-33, FR-36)
- 11c: dashboard (FR-34)

### Phase 12: Providers and featured listings. Next
- 12a: provider edits their own listing (FR-43)
- 12b: Paystack featured payment, verified webhook, audit entry with reference (FR-44, FR-46)
- 12c: one "Sponsored" listing first in matching search results, never in SwiftRescue (FR-45)

### Phase 13: Landing page, information pages and polish. Next
US-13.
- 13a: landing page. **Pulled forward by the owner (2026-10-11): in progress, see "Home page redesign" below** (branch
  `feature/home-redesign`)
- 13b: About, How we verify, Privacy policy, Terms of use, Contact us (FR-23)
- 13c: accessibility and speed pass (NFR-01, NFR-10)

### Phase 14: Launch readiness. Next
- 14a: CSV import and export (FR-39, FR-40, both Should)
- 14b: daily backups and a tested restore (NFR-09)
- 14c: anonymous analytics events (see "Analytics" in [prd.md](prd.md#analytics))
- 14d: go through the release criteria in [prd.md](prd.md#release-criteria). Includes the demo cleanup: set
  `REMOVE_DEMO_LISTINGS=true` in Render (already in the dashboard as `false`), redeploy, and confirm zero demo
  listings are left (`/search?q=DEMO` returns `total` 0), then set it back to `false` (see [decision 13](2026-10-09-search-backend/requirements.md))

## After the MVP

These are not phases. The numbered phases above are the MVP build order; the items below have no order and no
dates. All of them are out of scope for the MVP (see "Out of scope for the MVP" in
[prd.md](prd.md#out-of-scope-for-the-mvp)). Each line says what it needs first.

### Soon after launch

- **Public accounts:** a decision on how visitors sign in, and an updated privacy policy (NDPA). Today `users`
  holds staff and providers only.
- **Reviews:** public accounts first, and a moderation process for editors.
- **Native Android app:** a stable public API, and MVP usage numbers (see "Analytics" in
  [prd.md](prd.md#analytics)).
- **Igbo:** translated text for every screen and someone to review it. NFR-11 already keeps text out of the code.

### With partners

- **Appointment and lab booking:** facilities that agree to confirm bookings.
- **Pharmacy stock and delivery:** pharmacies that agree to share stock data.
- **Donor registry:** explicit consent under the NDPA, opt-out at any time, and its own table (adding a table needs
  the owner's approval).
- **USSD:** a mobile network or aggregator partner for a short code.
- **Hospital bed and service availability:** hospitals that agree to share it.
- **Ambulance requests:** ambulance providers that accept requests, and a change to FR-26, because SwiftRescue
  today does not dispatch or promise a response.
- **Live blood stock:** partner blood banks that share stock. Today the page says to call to confirm (FR-27).
- **Groups needed by donation centres:** donation centres that confirm which blood groups they need.

### Not planned

- **Diagnosis and symptom checking:** SwiftHealth is a directory and never gives medical advice
  (see [mission.md](mission.md#principles-we-never-break), FR-13, NFR-13).
