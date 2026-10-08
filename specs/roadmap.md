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

### Phase 4: Walking skeleton in production. In progress (all tasks done; pull request #5 is ready for review and becomes Done when the owner merges it)
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

### Phase 5: Search. Next
US-01, US-05. The hard part.
- 5a: `hours.py`, open now in Africa/Lagos time, hours that cross midnight, and 24-hour listings always open
- 5b: `search_service`, distance order, and the labelling and exclusion rules: overdue listings are labelled
  `verification_due` and stay visible (FR-08); listings reported "not working" by 2 users in 7 days are excluded (FR-22)
- 5c: `GET /search`
- 5d: Find page and location permission (FR-01, FR-03)
- 5e: results page with filters (FR-04, FR-05, FR-06)
- 5f: map view (FR-07, Should)

Note for 5a and 5b: `backend/tests/unit/test_search_service.py` does not exist yet. Its tests must expect overdue
listings to be labelled, not excluded. The spike `spikes/open_now_nearest.py` still hides them, so do not copy that
part of the spike into the tests.

### Phase 6: Listing page. Next
US-02, US-03, US-06, US-07.
- 6a: `GET /listings/{slug}`
- 6b: page with Call and Directions buttons (FR-09 to FR-13)

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
- 10b: admin listings list and listing editor (FR-31)
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
- 13a: landing page
- 13b: About, How we verify, Privacy policy, Terms of use, Contact us (FR-23)
- 13c: accessibility and speed pass (NFR-01, NFR-10)

### Phase 14: Launch readiness. Next
- 14a: CSV import and export (FR-39, FR-40, both Should)
- 14b: daily backups and a tested restore (NFR-09)
- 14c: anonymous analytics events (see "Analytics" in [prd.md](prd.md#analytics))
- 14d: go through the release criteria in [prd.md](prd.md#release-criteria)

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
