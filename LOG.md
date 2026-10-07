# LOG.md — SwiftHealth

One entry per day. Keep it short and honest.

## To do later

Open reminders. Each says when it is due. Remove a line once it is done.

- **Search feature:** treat is_24_hours listings as always open (no 23:59 gap).
- **Auth Task 2b and 4a:** the Starlette TestClient deprecation warning ("install httpx2 instead") goes away
  when the tests move to `httpx.AsyncClient`. Add `httpx2` only if some test still needs `TestClient`.
- **Auth Task 4:** split `.github/workflows/ci.yml` into `backend.yml` and `frontend.yml`.
  Each runs only when its own folder or its own workflow file changes. `backend.yml` gets the
  `postgres:16` service and `TEST_DATABASE_URL`.
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
