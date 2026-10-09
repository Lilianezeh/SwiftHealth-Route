# LOG.md — SwiftHealth

One entry per day. Keep it short and honest.

## To do later

Open reminders. Each says when it is due. Remove a line once it is done.

- **Render collation provider (before the production `pg_trgm` check):** PostgreSQL 18 release notes say `pg_trgm`
  behaviour can change on clusters whose default collation provider is not libc. Local and CI use the image default
  (libc). Confirm that Render's database also uses libc, or reindex the `pg_trgm` indexes after any change.
- **Render Blueprint is on manual sync:** a new variable in `render.yaml` does NOT reach the service by itself, and
  changing `render.yaml` does not redeploy through the Blueprint. Add every new variable by hand in the dashboard
  (Environment, **+ Add Environment Variable**) and deploy. Seen twice: `CORS_ORIGINS` in phase 4, and
  `REPORTER_KEY_SECRET`, `SEED_DEMO_LISTINGS` and `REMOVE_DEMO_LISTINGS` in phase 5A (all three now in the dashboard).
  Still to add by hand: any variable a later phase adds (Paystack, Resend, Cloudinary, Termii keys). Keep `render.yaml` as
  the written record, and update the dashboard to match whenever it changes.
- **`GET /meta` service labels, optional (decide with real data):** when a service is saved in several spellings, `/meta`
  shows the first in plain alphabetical order, so `X-RAY` would win over `X-ray`. Showing the spelling used by the most
  listings would look better; it needs `GROUP BY name` with a count in `service_repository`. Not needed while the
  verifiers write names the same way.
- **Node.js versions (check the schedule each autumn):** Node 20, which we run (frontend Dockerfile, `netlify.toml`, the
  frontend CI), reached end of life on 2026-04-30 (official [release schedule](https://github.com/nodejs/Release/blob/main/schedule.json),
  checked 2026-10-09). A chore moves the frontend to Node 24 (Active LTS until 2026-10-20, Maintenance LTS until
  2028-04-30). Node 22 ends 2027-04-30. Node 26 becomes LTS on 2026-10-28: move to it in 2027, well before 2028-04-30.
  After the chore, check in Netlify (Project configuration, Environment variables and Dependency management) that no
  old `NODE_VERSION` value overrides `netlify.toml`.
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
- **Learned:** [write this in your own words, e.g. what a trigram is and why a score of 0.50 is not enough]
- **AI use:** Claude Code compared the options with real scores, wrote the tests first and the code; I chose the
  options, approved the plan and decided what to keep out of scope.

- To do (after building): rename project to "SwiftHealth Route" and update the tagline (currently "Emergency, Hospital & Pharmacy Finder"). Before renaming, check that the name is free on Play Store and App Store, plus the domain, social handles and CAC business name. Then update app title, README, specs, pitch decks, project docs and the Netlify/Render names.

- To do: lint-on-edit hook uses the wrong ESLint for frontend files (no node_modules on host, so npx fetches ESLint 10, which can't read our config). Real lint (npm run lint in Docker, plus Frontend CI) still works. Fix later, probably by running ESLint inside the frontend container.
