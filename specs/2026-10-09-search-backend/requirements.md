# Search backend (Phase 5A): requirements

What this feature must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it is
done is in [validation.md](validation.md).

## Requirements

- **US-01:** find pharmacies open now near me. **US-05:** search by service.
- **FR-04:** search by facility name, category or service, tolerant of misspellings.
- **FR-05:** filters for category, service, open now, open 24 hours and distance.
- **FR-06:** results sort by distance by default (the API side: the fields and the order; the buttons are Phase 5B).
- **FR-08:** only published listings within their re-check cycle appear; overdue listings show a "verification due" label.
- **FR-22:** a contact reported "not working" by 2 different users within 7 days is flagged. In 5A this means search
  hides it. The flag itself (setting `recheck_due`, the audit entry, the alerts) is Phase 9b.
- **NFR-02:** search results return in under 1 second for the pilot dataset.
- **NFR-08:** no published listing older than its re-check cycle without the "verification due" label.

Source of truth: [prd.md](../prd.md), [api-spec.md](../backend/api-spec.md) (`GET /search` and `ListingSummary`).
Branch: `feature/search-backend`. Every commit and test references these IDs. This is roadmap
[phase 5A](../roadmap.md); the frontend (5d to 5f) is Phase 5B.

Fit with the project: this is the hard part of the mission, "a resident finds a facility that is open now, near them"
([mission.md](../mission.md)), and it applies the principle that only published, verified listings are public. It uses
the fixed stack in [tech-stack.md](../tech-stack.md) (FastAPI, SQLModel, PostgreSQL, async) and adds no table and no
library.

## In scope

- `backend/app/services/hours.py`: is a listing open at a given moment, in `Africa/Lagos` time, including hours that
  cross midnight and 24-hour listings (roadmap 5a).
- `search_service.py` and `search_repository.py`: trust rules, filters, distance, sort, paging, the FR-22 exclusion and
  the `verification_due` label (5b).
- `GET /search` with the query parameters and the `{ "items", "total" }` response in the api-spec (5c).
- `backend/tests/unit/test_search_service.py` (the three tests named in CLAUDE.md, adapted: overdue listings are
  labelled, not hidden) and the other tests in [validation.md](validation.md).
- One Alembic migration: the `pg_trgm` extension, trigram indexes, and the new `user_reports.reporter_key` column
  (decisions 1 and 4).
- The `REPORTER_KEY_SECRET` setting (with the same startup check as `JWT_SECRET`), the `hash_reporter_key` helper in
  `core/security.py`, `render.yaml` and `.env.example` (decisions 4 and 6).
- Spec updates first (Task 0): `sponsored` stays `false`, the `reporter_key` column, the `q` rule.

## Out of scope (planned elsewhere)

- The Find page, location permission, results page, filters UI and map view (FR-01, FR-03, FR-07): Phase 5B
  (roadmap 5d to 5f).
- The sponsored slot, rule 4 in the api-spec (FR-45): [roadmap](../roadmap.md) phase 12c. Until then `sponsored` is
  always `false` and the test "only one sponsored item" is not written.
- `POST /reports`, calling `hash_reporter_key` to fill `reporter_key`, setting `recheck_due` after the second report,
  alerts to editors and admin (FR-20 to FR-22): phase 9.
- The nightly job that moves overdue listings to `recheck_due` (FR-33, FR-36): phase 11b. Until then overdue listings
  stay visible with the label.
- Clearing `reporter_key` when a report is resolved (decision 5): phase 11a.
- `GET /listings/{slug}`, `GET /emergency`, `GET /blood/*`: phases 6 to 8. The `ListingSummary` schema built here is
  reused by them.

## Decisions

1. **Misspellings use PostgreSQL `pg_trgm`.** `q` is matched against the listing name, the area and the service names
   with trigram similarity, in SQL with the other filters. The extension is created in an Alembic migration (no new
   table), with GIN trigram indexes on `listings.name` and `services.name`. Alternatives: Python `difflib` (no
   migration, but loads every candidate listing into Python and does not scale) and plain `ILIKE` (no tolerance, so
   FR-04 would not be met). The extension must also exist in the test database and in the `postgres:16` CI service.
   Task 0 result (checked 2026-10-09):
   - The [Render PostgreSQL extensions page](https://render.com/docs/postgresql-extensions) lists `pg_trgm` as
     supported on PostgreSQL 13 and later. It does not say which database role may run `CREATE EXTENSION`, and it says
     nothing about free-plan databases. `render.yaml` does not set a PostgreSQL version. The owner read the Render
     dashboard: our database runs **PostgreSQL 18**, so `pg_trgm` is supported.
   - The [PostgreSQL 16 documentation](https://www.postgresql.org/docs/16/pgtrgm.html) says `pg_trgm` is a "trusted"
     extension: a non-superuser with `CREATE` privilege on the database can install it. Whether Render's database
     user has that privilege is not documented, so it is not proven.
   - So the real proof is the deploy: the migration runs on start (`backend/Dockerfile`) and would fail without the
     extension ([validation.md](validation.md), "After the merge"). If it fails, Render keeps the old version running
     and we redo this decision.
   - Checked in the local container (2026-10-09, `postgres:16`, server 16.15): `pg_trgm` is available (default
     version 1.6) and marked trusted. The CI service uses the same image (`postgres:16` in `backend.yml`), so it
     has it too; `backend.yml` going green in Task 2 confirms that.
   - Local and CI run PostgreSQL 16 but Render runs 18. The risks and the decision about moving to 18 are in `LOG.md`
     ("Decision for the owner: PostgreSQL 16 locally and in CI, 18 on Render").
2. **The similarity threshold is chosen with tests, not guessed.** Task 0 read the official `pg_trgm` documentation
   ([PostgreSQL 16](https://www.postgresql.org/docs/16/pgtrgm.html)): `similarity(a, b)` gives 0 to 1; `a % b` is true
   when similarity is above `pg_trgm.similarity_threshold` (default 0.3); `word_similarity` and `<%` compare a short
   word with any run of words in a longer text, with default threshold 0.6; a GIN index with `gin_trgm_ops` speeds up
   `%`, `<%`, `LIKE` and `ILIKE`. A name such as "Demo 24 Hour Pharmacy" searched with "pharmcy" is a word inside a
   longer text, so `word_similarity` is the likely fit; the tests in Task 2 decide between it and `similarity`. Task 2 writes the tests first, with realistic Enugu examples
   (misspelled facility names, areas and services, and unrelated words that must find nothing), then picks the lowest
   threshold that passes them and records the number and the examples here, in "Threshold result" below.
3. **Python does distance, radius, open-now, sort and paging; SQL does the rest.** The repository returns every
   published listing that matches the SQL filters (status, category, service, area, `q`, 24-hour, flagged exclusion)
   with its hours, phones and category. The service computes distance, applies `radius_km` and `open_now`, sorts, and
   pages. This matches the spike, keeps the open-now logic in one readable place, and is enough for the pilot dataset
   (NFR-02). A note in `LOG.md` says: if listings grow into the thousands, add a bounding-box pre-filter or move
   distance into SQL.
4. **`user_reports` gets a `reporter_key` column (no new table).** FR-22 counts "different reporters (by phone, else
   by IP)", but `reporter_phone` is optional and the table has no IP. `reporter_key` is nullable text: an HMAC-SHA256
   (hex) of the phone if the reporter gave one, else of the client IP from `get_client_ip`. The 9-table rule is kept:
   this is one column on an existing table, added by migration with the owner's approval. Search counts
   `COUNT(DISTINCT reporter_key)` of `not_working` reports in the last 7 days; a listing with 2 or more is excluded.
   Reports with a null `reporter_key` count for nothing, so a report can never hide a listing by itself.
   5A adds the helper `hash_reporter_key(value)` in `core/security.py`, so the way the key is made is decided and
   tested once, next to the other HMAC code. It is security code, so it gets a mutation check (see
   [validation.md](validation.md)). The 5A search tests insert `reporter_key` values directly; Phase 9a calls the
   helper when a report is created.
5. **Why a keyed hash and never the raw IP (NDPA 2023, [NFR-07](../prd.md#non-functional-requirements)).** An IP
   address and a phone number identify a person. We store neither for counting: only the keyed hash, which cannot be
   reversed or matched to a phone book without the server secret. A plain hash would not do, because the space of
   Nigerian phone numbers is small enough to try them all. This is a design choice to collect little data, not a legal
   claim that the hash is anonymous: whoever holds the secret can still check whether a given number reported. So a
   resolved or dismissed report stops counting (only `open` reports count), and Phase 11a clears `reporter_key` when a
   report is resolved, like `reporter_phone`. The owner confirmed both points. Nothing here was reviewed by a lawyer
   (NFR-13).
6. **The HMAC uses its own secret, `REPORTER_KEY_SECRET`; it does not reuse `jwt_secret`.** Rotating `JWT_SECRET`
   (which we may need to do after a leak) would change every new key, so old and new keys for the same reporter would
   no longer match, and FR-22 counting would break without any error. A separate secret keeps the two apart. It also
   means a leaked `jwt_secret` does not help someone test phone numbers against the stored keys. The details:
   - `Settings` gets `reporter_key_secret` (`REPORTER_KEY_SECRET`) with the same startup check as `JWT_SECRET`:
     outside development (`APP_ENV` is not `development`) the app refuses to start if it is missing, empty, the
     built-in development default, or shorter than 32 bytes. The error names the problem and never prints the secret.
     In development a blank value (as in `.env.example`) falls back to a public development default, so a new
     checkout works without setting it.
   - `render.yaml` gets `REPORTER_KEY_SECRET` with `generateValue: true`, like `JWT_SECRET`. `.env.example` gets
     `REPORTER_KEY_SECRET=` blank. `.env` is never edited.
   - `hash_reporter_key(value)` returns the hex HMAC-SHA256 of `"reporter:" + value` (the fixed label keeps the
     message from ever matching another use of HMAC in the code). The caller passes the phone already normalised to
     `+234...`, or the client IP.
   - Rotating `REPORTER_KEY_SECRET` on purpose only affects the last 7 days: reports made before and after the change
     by the same person stop matching, and old keys then fall out of the 7-day window by themselves.
7. **Overdue listings are labelled, not hidden.** `verification_due` is `true` when `next_check_due` has passed and the
   listing is still `published`. The spike hides them; its test data and this rule must not be copied. Only the nightly
   job (phase 11b) hides them, by moving them to `recheck_due`. A listing with no `next_check_due` is not overdue.
8. **24-hour listings are always open.** `is_open_now` is `true` for any listing with `is_24_hours = true`, even
   with no opening-hours rows or with a `23:59` close (the spike's gap, from `LOG.md`). The `is_24_hours` filter uses
   only the flag. A listing with `is_24_hours = false` and no hours rows is closed.
9. **"Now" comes from outside the functions.** `hours.py` and the service take the moment as an argument and convert
   it to `Africa/Lagos` inside. The server runs in UTC on Render, so tests use a UTC moment that falls on a different
   day in Lagos (for example 23:30 UTC). Only the route calls the clock.
10. **`hours.py` is plain `def`; the service is `async def`.** `hours.py` and the distance function are pure logic.
    `search_service.search_listings` awaits the repository, so it is async (CLAUDE.md, "Code style").
11. **Without a location the search still works.** `distance_km` is `null`, `radius_km` is ignored and results sort by
    name. `lat` without `lng` (or the reverse) is a 422, as in the api-spec.
12. **Sort and paging.** With a location: nearest first, ties by name. Without: by name. `total` is the count after all
    filters, before `limit` and `offset`. Distance is rounded to 1 decimal only in the response, never before sorting.

## Threshold result

Filled in during Task 2 (decision 2): the chosen `pg_trgm` threshold, and the misspelling examples that justify it.
