# LOG.md — SwiftHealth

One entry per day. Keep it short and honest.

## To do later

Open reminders. Each says when it is due. Remove a line once it is done.

- **Search feature:** treat is_24_hours listings as always open (no 23:59 gap).
- **Before launch, Render free plans (roadmap phases 14b and 14d):** the free API sleeps after 15 minutes idle (about
  a minute to wake). The free database expires 30 days after creation, about **2026-11-07** (confirm the exact date in
  the Render dashboard; Render allows 14 more days to upgrade, then deletes it) and has no backups. Upgrade both
  before launch. If the database lapses before then, recreate it from `render.yaml` and the data is only demo data.
- **After merging PR #5 (owner):** Render (service and Blueprint) and Netlify must deploy from `main`, and only then may
  the branch `feature/walking-skeleton-production` be deleted. Steps are in the Phase 4 `validation.md`, "After the merge".
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

- To do (after walking skeleton): capitalize router tags in /docs ("auth" → "Auth", "health" → "Health"). Paths unchanged. Update api-spec.md if it names tags. Own small branch and draft PR.

- To do (after building): rename project to "SwiftHealth Route" and update the tagline (currently "Emergency, Hospital & Pharmacy Finder"). Before renaming, check that the name is free on Play Store and App Store, plus the domain, social handles and CAC business name. Then update app title, README, specs, pitch decks, project docs and the Netlify/Render names.
