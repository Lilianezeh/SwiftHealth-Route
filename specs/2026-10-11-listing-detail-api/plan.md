# Listing detail API (Phase 6a): plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and checks
that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (FR-09, FR-10, FR-11, FR-13, US-06, US-07, FR-08, FR-22, NFR-07, NFR-08)
in every commit and test. Tick a box with its commit hash only when the step is really done. Check
`git branch --show-current` before every commit and push, and never push to `main` (CLAUDE.md). The pull request stays a draft
until the merge checklist in [validation.md](validation.md) is ticked.

## Files

| File | Change |
| --- | --- |
| `specs/backend/api-spec.md`, `specs/prd.md` | `ListingDetail` rules, `recently_reported_not_working`, `is_whatsapp`, `GET /listings/{slug}`; FR-10 gains the WhatsApp button (Task 0) |
| `specs/2026-10-11-listing-detail-api/` | This folder (Task 0) |
| `specs/roadmap.md`, `LOG.md` | Status; the owner's decisions for 6b; the SEO reminder (Task 0) |
| `backend/app/models/phone_number.py` | Task 1: `is_whatsapp` (default `False`, server default `false`) |
| `backend/alembic/versions/<id>_phone_is_whatsapp.py` | Task 1: new revision, safe on a table with rows; downgrade drops the column |
| `backend/tests/revision_loader.py` | Task 1: load a revision by its file name pattern (not only the categories one) |
| `backend/tests/integration/test_whatsapp_migration.py` | Task 1: new |
| `backend/tests/unit/test_whatsapp_flag.py` | Task 1: new: the default, and the seed and demo data never set it |
| `backend/app/repositories/listing_repository.py` | Task 2: `get_published_detail_by_slug` (listing, category, phones, hours, services) and `is_reported_not_working` |
| `backend/app/schemas/listing.py` | Task 3: `PhoneRead` (with `is_whatsapp`), `OpeningHoursRead`, `ServiceRead`, `ListingDetail` |
| `backend/app/services/listing_service.py` | Task 3: new. `get_published_listing(...)`, the 7 hours entries, the disclaimer, a `ListingNotFoundError` |
| `backend/app/api/routes/listings.py` | Task 4: `GET /{slug}`; the error becomes a 404 here, and only here |
| `backend/tests/integration/test_listing_repository.py` | Task 2: new |
| `backend/tests/unit/test_listing_service.py` | Task 3: new |
| `backend/tests/integration/test_listing_detail.py` | Task 4: new, through HTTP with a fixed clock |
| `backend/tests/factories.py` | Tasks 2 to 4: small helpers if needed (phones with `is_whatsapp`, a report) |

One new column (`phone_numbers.is_whatsapp`) and its migration; no new table, no new package, no frontend change. The seed and
demo code are not changed: a new phone number is not a WhatsApp number unless something says so. In production the container
runs `alembic upgrade head` before the demo step (`backend/Dockerfile`), so the migration is applied by the deploy.

## Tasks

### Task 0: Spec
- [ ] Write this folder, the api-spec and PRD text, the roadmap lines and the `LOG.md` notes (the SEO reminder). Commit:
  `docs(specs): listing detail API and the WhatsApp flag, spec (FR-09, FR-10, FR-13, US-06, US-07, FR-22)`.

### Task 1: `is_whatsapp`: model and migration (tests first)
- [ ] Write the tests (names in [validation.md](validation.md)): the default is `false` (model and database), a `true` value is
  saved and read back, the migration works on a table that already has rows (they become `false`), the column is `NOT NULL`,
  the downgrade drops it and keeps the rows, and no seed or demo phone is marked WhatsApp. They fail: the column does not exist.
  Teach `tests/revision_loader.py` to load a revision by its file name pattern.
- [ ] Add the field to the model, then make the revision in the backend container:
  `alembic revision --autogenerate -m "phone is_whatsapp"`. Edit it by hand: `server_default=sa.false()` on the new column
  (autogenerate leaves it out, and a `NOT NULL` column cannot be added to a table with rows without it). Run
  `alembic upgrade head`, `alembic downgrade -1`, `alembic upgrade head` on the local database, then
  `alembic revision --autogenerate` again to see that it finds no difference (delete that empty file).
- [ ] Run `pytest -q -W error` and `ruff check .`, then commit:
  `feat(db): phone_numbers.is_whatsapp, default false (FR-10)`.

### Task 2: The repository (tests first)
- [ ] Write the tests: a published listing comes back with its category, phones, hours and services; draft, pending, hidden,
  re-check-due and unknown slugs come back as nothing; the report check counts different reporters only, in the window, open
  reports only; the number of queries does not grow with the number of phones or services. They fail: the functions do not
  exist.
- [ ] Add `get_published_detail_by_slug` and `is_reported_not_working` (it uses `flagged_listing_ids` of `search_repository`).
  One query for the listing and its category, one each for phones, hours and services, one for the reports.
- [ ] Run the checks, then commit: `feat(listings): load a published listing with its details (FR-09, FR-22)`.

### Task 3: Schemas and the service (tests first)
- [ ] Write the unit tests: the 7 entries (missing day, closed day, row without times, duplicate rows, a past-midnight row,
  Monday first, `HH:MM` text), the primary phone first, `is_whatsapp` carried through, the fees as strings, the sorted
  services, the disclaimer, the flags (`verification_due`, `recently_reported_not_working`), `hours_note` and `is_open_now`
  with a fixed moment, and `ListingNotFoundError` for nothing. They fail.
- [ ] Add the schemas and `listing_service.get_published_listing`. The service takes the moment as an argument (never reads the
  clock), reuses `is_open_at` and `hours_note` of `services/hours.py`, and raises `ListingNotFoundError` (no HTTP).
- [ ] Run the checks, then commit: `feat(listings): the listing detail answer (FR-09, FR-10, FR-11, FR-13, US-06, US-07, FR-08)`.

### Task 4: The route (tests first)
- [ ] Write the integration tests through HTTP: 200 and the exact set of fields, the 404 body for every unpublished status and
  an unknown slug, the opening hours, the phones (with `is_whatsapp`) and the services in the answer, the fees as strings, the
  overdue and reported flags with the listing still returned, agreement with `/search` for `is_open_now` and `hours_note`, none
  of the internal fields, and that the route is public (no token) and writes no audit entry. They fail.
- [ ] Add `GET /listings/{slug}` (`response_model=ListingDetail`, `tags=["Listings"]` already on the router). The route reads
  the request, calls the service and turns `ListingNotFoundError` into a 404 `{"detail": "Listing not found"}`. Check that
  the OpenAPI page `/docs` shows the endpoint and its fields.
- [ ] Run the checks, then commit: `feat(listings): GET /listings/{slug} (FR-09, FR-10, FR-13, US-06, US-07, FR-22)`.

### Task 5: Wrap-up
- [ ] Run the whole backend suite and ruff, push the branch and open the draft pull request. Check that `Backend CI` ran and
  `Frontend CI` did not; write what `gh pr checks` shows in [validation.md](validation.md).
- [ ] After the merge and the Render deploy, the owner checks production (the migration ran, and a demo listing answers: see
  [validation.md](validation.md)). Then update the roadmap and `LOG.md` once, and tick the boxes with their commit hashes.
