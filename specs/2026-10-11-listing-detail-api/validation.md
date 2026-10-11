# Listing detail API (Phase 6a): validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-09, FR-10, FR-11, FR-13, FR-47, US-06, US-07, FR-08, FR-22, NFR-07 or NFR-08. Tick a
box only after the test exists and passes.

## How to run

The commands run in the backend container, one test process at a time (two runs at once share the test database and
break each other):
- Tests: `docker compose exec backend pytest -q -W error`
- Lint: `docker compose exec backend ruff check .`
- Migration by hand (Task 1): `alembic upgrade head`, `alembic downgrade -1`, `alembic upgrade head`, then `alembic check`

## Tests per task

Every test failed first (the code did not exist) and passes now. The whole backend suite is 769 tests (700 when Task 1
was finished).

### Task 1: `tests/unit/test_whatsapp_flag.py`, `tests/integration/test_whatsapp_migration.py` (done, `81da415`)
- [x] `a new phone number is not a WhatsApp number by default` (the model)
- [x] `a phone saved without is_whatsapp is false in the database` (the server default, with a raw insert)
- [x] `is_whatsapp true is saved and read back`
- [x] `the column is not null with a default of false and the model says the same`
- [x] `the column is added to a table that already has rows and they become false`
- [x] `the upgrade changes no other column and no other table`, and `the table after the upgrade is the table the model creates`
- [x] `the downgrade drops the column and keeps the rows`, and `upgrade then downgrade then upgrade again works`
- [x] `the revision follows the categories revision and is the only head`, and `the revision uses Alembic operations only and
  names only phone_numbers`
- [x] `no seeded listing phone is marked WhatsApp`, `no demo listing phone is marked WhatsApp`, and `the seed and demo code
  never set is_whatsapp` (a scan of `seed/`)

### Task 2: `tests/integration/test_listing_repository.py` (done, `0c8b786`)
- [x] `a published listing is loaded with its category, phones, hours and services`
- [x] `the phones come back in the order they were added and the hours by day`
- [x] `a listing with no phones, no hours and no services is loaded with empty lists`
- [x] `the details of another listing are not mixed in`
- [x] `a listing that is not published is not found` (draft, pending review, hidden, re-check due), and `an unknown slug is not found`
- [x] `the slug must match exactly` (case, spaces, a part of it, nothing)
- [x] `the number of queries is the same for one phone and ten` (and at most 4)
- [x] `two different reporters in the last 7 days report the listing`
- [x] `one reporter`, `two reports from the same reporter`, `a report older than the window`, `a resolved report`, `a report
  with another reason` and `a report with no reporter key` do not report it
- [x] `a report exactly at the start of the window counts`, and `the reports of another listing do not count`
- [x] `the detail and search use the same rule`

### Task 3: `tests/unit/test_listing_service.py` (done, `97ef721`), `tests/unit/test_verification.py` (done, `5da249e`)
- [x] `opening_hours has 7 entries, Monday first, whatever rows exist`
- [x] `a day with no row, a closed day and a row without times are closed with null times` (also a day that opens and closes at
  the same time)
- [x] `a past-midnight row keeps its opening and closing times` ("20:00" and "02:00")
- [x] `times are HH:MM text without seconds`
- [x] `with two rows for one day the one with the lowest id is used`
- [x] `the primary phone is first, the others follow by id, and primary_phone is its number`; `with two primary phones the first
  by id is the primary one`; `a listing with no primary phone has primary_phone null`; `a listing with no phone has an empty list`
- [x] `each phone carries its is_whatsapp value, false unless it was set`
- [x] `services are sorted by name ignoring case, then id`
- [x] `fees are strings with 2 decimals, a missing fee stays null, and the date is iso` (no maximum is made up)
- [x] `the disclaimer is the fixed text`
- [x] `the listing and category fields are carried into the answer`
- [x] `recently_reported_not_working is the flag that was given`, and `recently reported follows the reports in the database`
- [x] `is_open_now and hours_note come from the moment given in Lagos time`, and `a 24-hour listing is open now and has no hours note`
- [x] `distance is null and sponsored is false`
- [x] `a missing or unpublished listing raises ListingNotFoundError`, and `the service raises no http error`
- [x] **One shared rule** (`test_verification.py`): `a listing is due after its check date`; `is not due before it or at the
  exact moment`; `with no check date is not due`; `search and the listing page both use the shared rule and neither has its
  own copy`; `search and the listing page agree about which listings are due` (five check dates, compared on both sides)

### Task 4: `tests/integration/test_listing_detail.py` (done, `ac424b1`)
- [x] `a published listing returns 200 with exactly the fields of listing detail`
- [x] `the listing page needs no token`
- [x] `a listing that is not published is a 404 with the same body as an unknown slug` (draft, pending review, hidden, re-check
  due; body `{"detail": "Listing not found"}`), and `an odd slug is just a 404`
- [x] `the phones, the seven opening hours entries and the services are in the answer`
- [x] `a whatsapp number has is_whatsapp true and the others false`
- [x] `fees are strings with two decimals in the json and a null fee stays null` (also checked in the raw JSON text)
- [x] `an overdue published listing is returned with verification_due true`
- [x] `a listing hidden from search by two reporters is still returned with the flag`, and one reporter leaves it false
- [x] `is_open_now, hours_note and verification_due are the same as in search` (four listings, three moments)
- [x] `no internal field and nothing about the reports is in the answer`
- [x] `a request writes no audit entry`
- [x] `docs lists the endpoint under the listings tag` (and the schema has the new fields)
- [x] The existing tests of search, meta, auth and the rest still pass (the full suite below).

## Review-focus edge cases

- [x] **The migration on a filled table.** The column is added to rows that exist (production has demo listings) without an
  error, and they read `false`. Checked by the test, and by running the revision on the local database (2026-10-11): 32 existing
  phone rows, all `false` afterwards; downgrade and upgrade again worked.
- [x] **No difference left.** After the migration, `alembic check` said "No new upgrade operations detected" (the model and the
  revision agree).
- [x] **Drafts and hidden listings.** Nothing in the 404 tells a draft from a missing listing (same body, same status).
- [x] **Re-check due.** `recheck_due` is a status that hides the listing; a still-published overdue one is shown with the label.
- [x] **The report rule.** Window and count are the constants of `/search`, and the same query, so search and detail cannot
  disagree about which listings are reported (and a listing search hides still opens).
- [x] **Past midnight.** "20:00" to "02:00" is returned as stored; the page, not the API, adds "(next day)".
- [x] **A day with several rows or none.** Seven entries every time.
- [x] **A listing with no phone.** `phones` is `[]` and `primary_phone` is `null`.
- [x] **A slug like `id` or `abc/def`.** `id` is just an unknown slug (404, same body); a slash is a different path (404).

## Security checklist

- [x] The route is public and read-only; it uses no `current_user` and writes nothing (a test counts the audit entries).
- [x] Only `published` listings are returned; the status check is in the repository query, not only in the service.
- [x] No internal field and nothing about the reports (who, when, comment, phone, key) is in any answer
  (the field-set and raw-text tests).
- [x] No raw SQL built from the slug: the query is a SQLModel `where` with a bound value. The migration uses Alembic operations
  only (no string built from data).
- [x] The seed and demo data never mark a number as WhatsApp (even fictional numbers can belong to real people): the tests above.
- [x] No new package, no secret, no `.env` change, no new table. `git diff --stat origin/main -- backend` (2026-10-11) shows
  only the files of the plan's table; the one model change is the new column.
- [x] Demo and test data stay fictional (CLAUDE.md): the tests use the fictional phone numbers of `tests/factories.py`.

## After the deploy (owner, production)

- [ ] The Render deploy log shows the migration ran (`alembic upgrade head`), and the service started.
- [ ] `GET https://swifthealth-api.onrender.com/listings/<a demo slug>` returns 200 with the fields above, every `is_whatsapp`
  `false`; a draft or unknown slug returns 404; `/docs` shows the endpoint. (The demo slugs are the fixed ones in
  `seed/demo_listings_data.py`.)

## Merge checklist

- [x] `pytest -q -W error` and `ruff check .` are clean in the backend container, run once on its own (2026-10-11, on
  `ac424b1`): **769 passed in 85.69 s**, ruff "All checks passed!".
- [x] On the draft pull request `Backend CI` runs and is green, and `Frontend CI` does not run. What `gh pr checks 20` showed
  (2026-10-11, after `01d4ba2`): `backend` **pass** (1m31s, run 38161882617); the only workflow run on the branch is Backend
  CI (no Frontend CI run); Netlify `Header rules`, `Pages changed` and `Redirect rules` skipping, `deploy-preview` pass. The PR
  is #20.
- [x] `git diff --stat origin/main -- frontend` is empty (2026-10-11).
- [ ] The api-spec, the PRD (the new FR-47; FR-10 unchanged), the [roadmap](../roadmap.md) and `LOG.md` are up to date. (Done
  for the api-spec, the PRD and the roadmap; the `LOG.md` day entry is written after the merge and the production check.)
- [ ] The production check above is done after the deploy.
- [ ] The pull request stays a draft until every box above is ticked.

Note: this branch also carries `5391ec9` (the 5B-2 "done" docs, a docs-only commit that was not yet on `main`), so the pull
request shows it too.
