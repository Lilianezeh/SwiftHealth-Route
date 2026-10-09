# Search backend (Phase 5A): plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and
checks that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (US-01, US-05, FR-04, FR-05, FR-06, FR-08, FR-22, NFR-02,
NFR-07, NFR-08) in every commit and test. Tick a box with its commit hash only when the step is really done.

## Files

| File | Change |
| --- | --- |
| `specs/backend/api-spec.md` | `GET /search`: `sponsored` is `false` until phase 12c; unknown `area` is a 422; the `q` rule; only open reports count for FR-22; `user_reports.reporter_key` |
| `specs/prd.md` | Only if it lists table columns: add `reporter_key` (checked in Task 0) |
| `LOG.md` | Remove the "Search feature: is_24_hours" reminder; add the "thousands of listings" note; add the reminders for phase 9a (call `hash_reporter_key`) and 11a (clear `reporter_key` on resolve) |
| `backend/app/core/config.py` | New `reporter_key_secret`; the startup check covers it as well as `jwt_secret` |
| `backend/app/core/security.py` | New `hash_reporter_key(value)` (HMAC-SHA256 of `"reporter:" + value`, plain `def`) |
| `render.yaml` | New `REPORTER_KEY_SECRET` with `generateValue: true`; update the header comment |
| `.env.example` | New blank `REPORTER_KEY_SECRET=` with a comment (`.env` itself is never edited) |
| `backend/tests/unit/test_config.py` | New tests for the secret check |
| `backend/tests/unit/test_security.py` | New tests for `hash_reporter_key` |
| `backend/app/services/hours.py` | New: `is_open_at(opening_hours, is_24_hours, moment)` in `Africa/Lagos` time (plain `def`) |
| `backend/app/services/search_service.py` | New: `distance_in_km`, `search_listings` (async), the sort and paging helpers |
| `backend/app/repositories/search_repository.py` | New: published listings with SQL filters, trigram match on `q`, FR-22 exclusion, hours, phones, category |
| `backend/app/schemas/listing.py` | New: `ListingSummary` and `CategorySummary` (reused by phases 6 to 8) |
| `backend/app/schemas/search.py` | New: `SearchParams` (query parameters) and `SearchResponse` (`items`, `total`) |
| `backend/app/models/user_report.py` | New nullable column `reporter_key` |
| `backend/alembic/versions/<new>.py` | `CREATE EXTENSION pg_trgm`, trigram indexes, `reporter_key` column (autogenerate, then edit by hand for the extension) |
| `backend/app/api/dependencies.py` | New `get_current_moment` dependency (the clock, so tests can replace it) |
| `backend/app/api/routes/search.py` | `GET /search`: reads the request, calls the service, returns the schema |
| `backend/tests/conftest.py` | Create the `pg_trgm` extension in the test database; small helpers to build listings, hours and reports |
| `backend/tests/unit/test_hours.py` | New |
| `backend/tests/unit/test_search_service.py` | New: the three spike tests (adapted) and the rest of the service rules |
| `backend/tests/integration/test_search_repository.py` | New: SQL filters, `q`, FR-22 |
| `backend/tests/integration/test_search.py` | New: the route |
| `.github/workflows/backend.yml` | Only if the CI database needs the extension created another way (checked in Task 0) |
| `specs/roadmap.md` | Phase 5A status (done at the end) |

## Tasks

### Task 0: Spec and checks
- [x] Read the Render documentation for PostgreSQL extensions: is `pg_trgm` supported on our Render database (the
  `swifthealth-db` in `render.yaml`), and can the app's database user run `CREATE EXTENSION`? Write the answer and the
  link in [requirements.md](requirements.md), decision 1. If it is not supported, stop and ask the owner.
- [x] Read the official PostgreSQL `pg_trgm` documentation: the `similarity()` function, the `%` and `<%` operators,
  the default thresholds and `gin_trgm_ops`. Write what we rely on in decision 2.
- [x] In the backend container, run `CREATE EXTENSION IF NOT EXISTS pg_trgm` on a throwaway database to confirm the
  `postgres:16` image (compose and the CI service) includes it.
- [x] Update [api-spec.md](../backend/api-spec.md) and [prd.md](../prd.md) as listed in the Files table. Update `LOG.md`.
- [x] Commit: `docs(specs): search backend spec and pg_trgm check (FR-04, FR-22)`.

### Task 1: `hours.py` (roadmap 5a)
- [ ] Write `tests/unit/test_hours.py` first (names in [validation.md](validation.md)). They fail: the module does not exist.
- [ ] Write `services/hours.py`: `is_open_at` converts the moment to `Africa/Lagos`, returns `True` for a 24-hour
  listing, checks today's row and yesterday's past-midnight row, and refuses a moment without a time zone.
- [ ] Run `pytest -q` and `ruff check .`, then commit: `feat(search): open now in Lagos time with past-midnight hours (US-01, FR-05)`.

### Task 1b: `REPORTER_KEY_SECRET` and `hash_reporter_key` (decisions 4 and 6)
- [ ] Write the tests first in `test_config.py` and `test_security.py` (names in [validation.md](validation.md)).
- [ ] Add `reporter_key_secret` to `Settings` and extend the startup check to both secrets, keeping the error messages
  free of secret values. A blank value in development falls back to a public development default.
- [ ] Add `hash_reporter_key` to `core/security.py`. Add `REPORTER_KEY_SECRET` to `render.yaml` and `.env.example`.
- [ ] Run the security mutation check in [validation.md](validation.md), restore the code, run `pytest -q` and
  `ruff check .`, then commit: `feat(security): keyed hash for report counting, separate secret (FR-22, NFR-07)`.

### Task 2: `search_service` and the repository (roadmap 5b)
- [ ] Write the failing tests first: `tests/unit/test_search_service.py` (the three spike tests, then the label,
  radius, sort and paging tests) and `tests/integration/test_search_repository.py` (status, `q`, FR-22).
- [ ] Add `reporter_key` to the `UserReport` model, generate the migration, add the `pg_trgm` extension and the
  trigram indexes by hand, and run `alembic upgrade head` and `alembic downgrade -1` and `upgrade head` again.
  Update `conftest.py` so the test database gets the extension.
- [ ] Write `ListingSummary`, `SearchParams` and `SearchResponse`, `search_repository.py` and `search_service.py`.
- [ ] Pick the trigram threshold with the misspelling examples (decision 2) and write the number and the examples in
  "Threshold result" in [requirements.md](requirements.md).
- [ ] Run `pytest -q` and `ruff check .`, then commit: `feat(search): nearest-first search with trust rules and flag exclusion (FR-04, FR-06, FR-08, FR-22)`.

### Task 3: `GET /search` (roadmap 5c)
- [ ] Write `tests/integration/test_search.py` first. They fail with 404 (the route has only a TODO).
- [ ] Add `get_current_moment` to `dependencies.py`. Write the route: query validation (`lat` with `lng`, `radius_km`
  at most 50, `limit` 1 to 100, `area` from the fixed list), then call the service. No business rules in the route.
- [ ] Run `pytest -q` and `ruff check .`, then commit: `feat(search): GET /search endpoint (US-01, US-05, FR-04 to FR-06, FR-08)`.

### Task 4: Wrap-up
- [ ] Run the checks and the smoke test in [validation.md](validation.md), including the timing check (NFR-02) on the seed data.
- [ ] Remind the owner of the "After the merge" checks in [validation.md](validation.md) (the deploy and the live
  misspelled search).
- [ ] Update `LOG.md`, the [roadmap](../roadmap.md), and tick the boxes in this folder with their commit hashes.
- [ ] Commit: `docs(specs): search backend wrap-up (US-01, US-05)`. Open the pull request as a draft.
