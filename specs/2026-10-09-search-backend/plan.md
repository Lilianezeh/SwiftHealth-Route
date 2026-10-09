# Search backend (Phase 5A): plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and
checks that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (US-01, US-05, FR-04, FR-05, FR-06, FR-08, FR-22, NFR-02,
NFR-07, NFR-08) in every commit and test. Tick a box with its commit hash only when the step is really done.

## Files

| File | Change |
| --- | --- |
| `specs/backend/api-spec.md` | `GET /search`: `sponsored` is `false` until phase 12c; unknown `area` is a 422; the `q` rule; only open reports count for FR-22; `user_reports.reporter_key` |
| `specs/prd.md` | The user report row lists `reporter_key` (checked in Task 0) |
| `LOG.md` | The "thousands of listings" note; reminders for phase 9a (call `hash_reporter_key`), 11a (clear `reporter_key` on resolve), the Render collation check and phase 5B; the day's entry |
| `backend/app/core/config.py` | New `reporter_key_secret`; the startup check covers it as well as `jwt_secret` |
| `backend/app/core/security.py` | New `hash_reporter_key(value)` (HMAC-SHA256 of `"reporter:" + value`, plain `def`) |
| `render.yaml` | New `REPORTER_KEY_SECRET` (`generateValue: true`) and the two demo flags, both `false` |
| `.env.example` | New blank `REPORTER_KEY_SECRET=` and the two demo flags (`.env` itself is never edited) |
| `backend/tests/unit/test_config.py`, `test_security.py` | New tests for the secret check and `hash_reporter_key` |
| `backend/app/services/hours.py` | New: `is_open_at(opening_hours, is_24_hours, moment)` in `Africa/Lagos` time (plain `def`) |
| `backend/app/services/search_service.py` | New: `distance_in_km`, `split_query_words`, `search_listings` (async), sort and paging |
| `backend/app/repositories/search_repository.py` | New: published listings with SQL filters, trigram match on `q` (whole query or every word), FR-22 exclusion, hours, phones, category |
| `backend/app/repositories/listing_repository.py` | `count_by_slugs` and `delete_by_slugs` for the demo cleanup |
| `backend/app/schemas/listing.py`, `search.py` | New: `ListingSummary`, `CategorySummary` (reused by phases 6 to 8), `SearchParams`, `SearchResponse` |
| `backend/app/models/user_report.py` | New nullable column `reporter_key` |
| `backend/alembic/versions/82a902495666_*.py` | `CREATE EXTENSION pg_trgm` and the `reporter_key` column |
| `backend/app/api/dependencies.py`, `routes/search.py` | `get_current_moment` (the clock, so tests can replace it); `GET /search` |
| `backend/app/api/routes/*.py`, `main.py`, `CLAUDE.md` | Router tags start with a capital letter; the rule is in CLAUDE.md |
| `backend/seed/demo_listings_data.py`, `demo_listings.py`, `backend/Dockerfile` | Task 3b: the production demo listings, their flag-driven seed and cleanup, run on start |
| `docker-compose.yml`, `.github/workflows/backend.yml`, `specs/tech-stack.md` | Task 1c: PostgreSQL 18 |
| `backend/tests/conftest.py`, `tests/factories.py` | `pg_trgm` and `drop_all` in the test database; helpers to build listings, hours and reports |
| `backend/tests/unit/test_hours.py`, `test_search_service.py`, `test_demo_listings.py`, `test_openapi_tags.py` | New |
| `backend/tests/integration/test_search_repository.py`, `test_search.py`, `test_demo_listings.py` | New |
| `specs/roadmap.md` | Phase 5A tasks; the demo cleanup line in the launch checklist (phase 14d) |

## Tasks

### Task 0: Spec and checks (done, `fef3fd7` and `df113dd`)
- [x] Read the Render documentation for PostgreSQL extensions: is `pg_trgm` supported on our Render database (the
  `swifthealth-db` in `render.yaml`), and can the app's database user run `CREATE EXTENSION`? Write the answer and the
  link in [requirements.md](requirements.md), decision 1. If it is not supported, stop and ask the owner.
- [x] Read the official PostgreSQL `pg_trgm` documentation: the `similarity()` function, the `%` and `<%` operators,
  the default thresholds and `gin_trgm_ops`. Write what we rely on in decision 2.
- [x] In the backend container, run `CREATE EXTENSION IF NOT EXISTS pg_trgm` on a throwaway database to confirm the
  `postgres:16` image (compose and the CI service) includes it.
- [x] Update [api-spec.md](../backend/api-spec.md) and [prd.md](../prd.md) as listed in the Files table. Update `LOG.md`.
- [x] Commit: `docs(specs): search backend spec and pg_trgm check (FR-04, FR-22)`.

The feature folder itself was committed first, as `9fa97f9`.

### Task 1: `hours.py` (roadmap 5a) (done, `d8aeb70`)
- [x] Write `tests/unit/test_hours.py` first (names in [validation.md](validation.md)). They fail: the module does not exist.
- [x] Write `services/hours.py`: `is_open_at` converts the moment to `Africa/Lagos`, returns `True` for a 24-hour
  listing, checks today's row and yesterday's past-midnight row, and refuses a moment without a time zone.
- [x] Run `pytest -q` and `ruff check .`, then commit: `feat(search): open now in Lagos time with past-midnight hours (US-01, FR-05)`.

### Task 1b: `REPORTER_KEY_SECRET` and `hash_reporter_key` (decisions 4 and 6) (done, `a3c9e33`)
- [x] Write the tests first in `test_config.py` and `test_security.py` (names in [validation.md](validation.md)).
- [x] Add `reporter_key_secret` to `Settings` and extend the startup check to both secrets, keeping the error messages
  free of secret values. A blank value in development falls back to a public development default.
- [x] Add `hash_reporter_key` to `core/security.py`. Add `REPORTER_KEY_SECRET` to `render.yaml` and `.env.example`.
- [x] Run the security mutation check in [validation.md](validation.md), restore the code, run `pytest -q` and
  `ruff check .`, then commit: `feat(security): keyed hash for report counting, separate secret (FR-22, NFR-07)`.

### Task 1c: PostgreSQL 18 in Docker Compose and backend CI (decision of 2026-10-09) (done, `5ae6434`)
Added after Task 0 found that the Render database runs PostgreSQL 18 while compose and CI ran 16. Done before Task 2
so the first `pg_trgm` migration runs on the production version.
- [x] `docker-compose.yml`: `postgres:18`, and the volume at `/var/lib/postgresql` (the 18 image changed its data path).
- [x] `.github/workflows/backend.yml`: the `postgres:18` service. [tech-stack.md](../tech-stack.md): decision line added.
- [x] `LOG.md`: the 16 against 18 decision is replaced by a reminder to confirm Render's collation provider.
- [x] Delete the old local volume, start the stack, check `SHOW server_version` (18.6), `alembic upgrade head`, re-seed,
  `pytest -q` (242 passed) and `ruff check .`.
- [x] Commit: `chore(db): run PostgreSQL 18 locally and in CI, like Render (NFR-05)`. CI on the pull request: green.

### Task 2: `search_service` and the repository (roadmap 5b) (done, `bcfcd5d`)
- [x] Write the failing tests first: `tests/unit/test_search_service.py` (the three spike tests, then the label,
  radius, sort and paging tests) and `tests/integration/test_search_repository.py` (status, `q`, FR-22).
- [x] Add `reporter_key` to the `UserReport` model, generate the migration, add the `pg_trgm` extension
  by hand, and run `alembic upgrade head` and `alembic downgrade -1` and `upgrade head` again.
  Update `conftest.py` so the test database gets the extension.
- [x] Write `ListingSummary`, `SearchParams` and `SearchResponse`, `search_repository.py` and `search_service.py`.
- [x] Pick the trigram threshold with the misspelling examples (decision 2) and write the number and the examples in
  "Threshold result" in [requirements.md](requirements.md).
- [x] Run `pytest -q` and `ruff check .`, then commit: `feat(search): nearest-first search with trust rules and flag exclusion (FR-04, FR-06, FR-08, FR-22)`.

### Task 3: `GET /search` (roadmap 5c) (done, `7cfef85`)
- [x] Write `tests/integration/test_search.py` first. They fail with 404 (the route has only a TODO).
- [x] Add `get_current_moment` to `dependencies.py`. Write the route: query validation (`lat` with `lng`, `radius_km`
  at most 50, `limit` 1 to 100, `area` from the fixed list), then call the service. No business rules in the route.
- [x] Run `pytest -q` and `ruff check .`, then commit: `feat(search): GET /search endpoint (US-01, US-05, FR-04 to FR-06, FR-08)`.

### Task 3a: Router tags with a capital letter (extra, done, `8b04b2a`)
Asked for by the owner; it was a to-do in `LOG.md`.
- [x] Capitalize every router tag, use `Search` for the new route, add the rule to `CLAUDE.md`, remove the to-do from
  `LOG.md`. The guard test `test_openapi_tags.py` was written after the change, which the owner accepted.

### Task 3b: Demo listings for production (decision 13) (done, `92a95c0`)
So the live misspelled-search check has something to find, and the production database is never opened. Listings only:
no users, no passwords. Built after `GET /search` so the test can search for them.
- [x] Write the failing tests first (names in [validation.md](validation.md)): `tests/unit/test_demo_listings.py`
  (the data rules) and `tests/integration/test_demo_listings.py` (seed, run twice, cleanup, flags).
- [x] `seed/demo_listings_data.py`: four listings whose names start with `DEMO – `, each with a fixed slug, a fictional
  `+234000...` phone from `demo_phone`, hours and services. Reuse the builders in `seed/seed_data.py`.
- [x] `seed/demo_listings.py`: `seed_demo_listings` (idempotent: skips a slug that exists, inserts any missing category
  by its fixed slug, creates no user) and `remove_demo_listings` (deletes by the exact slugs only, with their phones,
  hours, services, checks, reports and audit entries, in one transaction). `main` reads `SEED_DEMO_LISTINGS` and
  `REMOVE_DEMO_LISTINGS`; only the exact value `true` counts; with neither set it does nothing.
- [x] `backend/Dockerfile`: run `python -m seed.demo_listings` between `alembic upgrade head` and `uvicorn`, so a
  failure of this step is logged and never keeps the API from starting. `render.yaml` and `.env.example`: both flags
  declared as `false`.
- [x] Read the Render documentation: does a value changed in the dashboard survive a Blueprint sync when `render.yaml`
  declares the same variable with a plain `value`? The answer is in [requirements.md](requirements.md), decision 13
  (the docs do not say, so the checklist does not rely on it).
- [x] Add "run the demo cleanup, confirm zero demo listings" to the launch checklist in the [roadmap](../roadmap.md)
  (phase 14d), planned in `fa40d8b`.
- [x] Run `pytest -q` and `ruff check .`, then commit: `feat(seed): flag-driven demo listings for production (US-01, FR-04)`.

### Task 3c: Two typos in one query (extra, done, `6086041`)
Found while checking Task 3b: "Nigt Pharmcy" scored 0.50 and found nothing.
- [x] Write the failing tests first (names in [validation.md](validation.md)), including guards: unrelated and look-alike
  words must not match more than before.
- [x] Compare with real scores: a lower threshold (adds false matches), each word alone (loses queries that worked),
  and the whole query or every word (chosen). Written in [requirements.md](requirements.md).
- [x] `split_query_words` in the service, the word rule in `search_repository.py`. Re-check the timing.
- [x] Commit: `feat(search): find queries with two typos by matching each word too (FR-04)`.

### Task 4: Wrap-up (done, this commit)
- [x] Run the checks and the smoke test in [validation.md](validation.md), including the timing check (NFR-02) on the seed data.
- [x] Write the "After the merge" steps for the owner in [validation.md](validation.md), in this order: confirm
  `REPORTER_KEY_SECRET` exists in Render's Environment page, confirm the deploy, add the demo listings and switch the
  flag off, and try a misspelled search on the live `/docs`.
- [x] Update `LOG.md`, the [roadmap](../roadmap.md), and tick the boxes in this folder with their commit hashes.
- [x] Commit: `docs(specs): search backend wrap-up (US-01, US-05)`. The pull request (#7) was opened as a draft early,
  so CI ran on PostgreSQL 18. The owner marked it ready and merged it as `cf23c1a`, then did the Render steps.
  The docs follow-up (ticks, roadmap, LOG) went in a small docs pull request.
