# LOG.md — SwiftHealth

One entry per day. Keep it short and honest.

## To do later

Open reminders. Each says when it is due. Remove a line once it is done.

- **Search feature:** treat is_24_hours listings as always open (no 23:59 gap).
- **Auth, Render deploy (roadmap phase 4):** log one real `X-Forwarded-For` header from a request through Render and
  set `TRUSTED_PROXY_COUNT` to match. Render's docs say traffic passes through Cloudflare and Render's load
  balancers but not which entry to trust. A count that is too high trusts an entry the client can fake, so the limit
  can be dodged. A count that is too low counts a proxy address as the client, so every visitor shares one limit.
  Also check FastAPI's "Behind a Proxy" approach (uvicorn `--proxy-headers` and `--forwarded-allow-ips`) and prefer it
  over our own `get_client_ip` logic if it fits Render.
- **Before the first real SMS (Termii):** activate the DND route on the account, get the sender ID approved, and set
  `TERMII_BASE_URL` from the dashboard (Settings, API token tab). Termii has no sandbox, so every real send costs
  balance. Also decide at the Render deploy whether to add a startup warning (lifespan) when no key is set; for now
  each no-key send logs a WARNING.
- **Rate limiter, if traffic grows:** sweep old IPs. An IP that stops calling keeps its list of timestamps in memory
  until it calls again (`core/rate_limit.py`).
- **First frontend change:** check that it runs only `Frontend CI` and not `Backend CI` (the `frontend/**` filter
  has not been tested yet). Add this to the pull request notes for that change.
- **pwdlib change:** the passlib warning ("'crypt' is deprecated and slated for removal in Python 3.13")
  goes away with the later move from passlib to pwdlib (needs a re-seed, since seed users are bcrypt-hashed).

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
