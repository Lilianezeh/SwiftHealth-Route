# Listing detail API (Phase 6a): validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-09, FR-10, FR-11, FR-13, US-06, US-07, FR-08, FR-22, NFR-07 or NFR-08. Tick a
box only after the test exists and passes.

## How to run

The commands run in the backend container:
- Tests: `docker compose exec backend pytest -q -W error`
- Lint: `docker compose exec backend ruff check .`
- Migration by hand (Task 1): `alembic upgrade head`, `alembic downgrade -1`, `alembic upgrade head`

## Tests per task

### Task 1: `tests/unit/test_whatsapp_flag.py`, `tests/integration/test_whatsapp_migration.py`
- [ ] `a new phone number is not a WhatsApp number by default` (the model)
- [ ] `a phone number saved without is_whatsapp is false in the database` (the server default, with a raw insert)
- [ ] `is_whatsapp true is saved and read back`
- [ ] `the column is NOT NULL, with a default of false, and the model says the same`
- [ ] `the migration adds is_whatsapp to a phone_numbers table that already has rows, and they become false`
- [ ] `the migration changes no other column and no other table`
- [ ] `the downgrade drops the column and keeps the rows`, and `upgrade, downgrade and upgrade again works`
- [ ] `no seeded listing phone is marked WhatsApp`, `no demo listing phone is marked WhatsApp`, and `the seed and demo code
  never set is_whatsapp` (a scan of `seed/`)

### Task 2: `tests/integration/test_listing_repository.py`
- [ ] `a published listing is loaded with its category, phones, hours and services`
- [ ] `draft, pending review, hidden and re-check due listings are not found`, and `an unknown slug is not found`
- [ ] `the slug must match exactly` (case and spaces)
- [ ] `a listing with no phones, no hours and no services is loaded with empty lists`
- [ ] `the number of queries is the same for a listing with one phone and one service and one with ten of each`
- [ ] `two different reporters saying not working in the last 7 days report the listing`
- [ ] `one reporter, two reports from the same reporter, an older report, a resolved report, another reason and a report with no
  key do not report it`
- [ ] `reports of another listing do not count`

### Task 3: `tests/unit/test_listing_service.py`
- [ ] `opening_hours has 7 entries, Monday first, whatever rows exist`
- [ ] `a day with no row, a closed day and a row without times are closed with null times`
- [ ] `a past-midnight row keeps its opening and closing times` ("20:00" and "02:00")
- [ ] `times are HH:MM text without seconds`
- [ ] `with two rows for one day the one with the lowest id is used`
- [ ] `the primary phone is first, the others follow by id, and primary_phone is its number`
- [ ] `a listing with no primary phone has primary_phone null and its numbers in order of id`
- [ ] `each phone carries its is_whatsapp value, false unless it was set`
- [ ] `services are sorted by name ignoring case, then id`
- [ ] `fees are strings with 2 decimals, a missing fee stays null, and the date is YYYY-MM-DD or null` (no maximum is made up)
- [ ] `the disclaimer is the fixed text`
- [ ] `verification_due is true after next_check_due and false before it or with no date`
- [ ] `recently_reported_not_working follows the repository`
- [ ] `is_open_now and hours_note come from the clock given, in Lagos time`, and `a 24-hour listing has hours_note null`
- [ ] `distance_km is null and sponsored is false`
- [ ] `a missing listing raises ListingNotFoundError` (and the service raises no HTTP error)

### Task 4: `tests/integration/test_listing_detail.py`
- [ ] `GET /listings/{slug} returns 200 with exactly the fields of ListingDetail`
- [ ] `needs no token`
- [ ] `draft, pending review, hidden and re-check due listings and an unknown slug return 404 with the same body`
  (`{"detail": "Listing not found"}`)
- [ ] `the phones, the 7 opening-hours entries and the services are in the answer`
- [ ] `a WhatsApp number is returned with is_whatsapp true and the others with false`
- [ ] `fees are strings like "1500.00" in the JSON, and a fee that is null stays null`
- [ ] `an overdue published listing is returned with verification_due true`
- [ ] `a listing hidden from search by 2 reporters is still returned, with recently_reported_not_working true`, and `one reporter
  leaves it false`
- [ ] `is_open_now and hours_note are the same as in /search for the same listing and the same moment`
- [ ] `none of status, next_check_due, owner_id, created_by, featured_until, reporter_key or reporter_phone is in the answer`
- [ ] `a request writes no audit entry`
- [ ] `/docs lists GET /listings/{slug} under the Listings tag` (the existing OpenAPI tag test still passes)
- [ ] The existing tests of search, meta, auth and the rest still pass.

## Review-focus edge cases

- [ ] **The migration on a filled table.** The column is added to rows that exist (production has demo listings) without an
  error, and they read `false`. Checked by the test and by running it on the local database after `seed` and the demo step.
- [ ] **No difference left.** After the migration, `alembic revision --autogenerate` finds nothing to change (the model and the
  revision agree); the empty file it makes is deleted.
- [ ] **Drafts and hidden listings.** Nothing in the 404 tells a draft from a missing listing.
- [ ] **Re-check due.** `recheck_due` is a status that hides the listing; a still-published overdue one is shown with the label.
- [ ] **The report rule.** Window and count are the constants of `/search`, and the same query, so search and detail cannot
  disagree about which listings are reported.
- [ ] **Past midnight.** "20:00" to "02:00" is returned as stored; the page, not the API, adds "(next day)".
- [ ] **A day with several rows or none.** Seven entries every time.
- [ ] **A listing with no phone.** `phones` is `[]` and `primary_phone` is `null`.
- [ ] **A slug like `id` or `abc/def`.** `id` is just an unknown slug (404); a slash is a different path, not a slug.

## Security checklist

- [ ] The route is public and read-only; it uses no `current_user` and writes nothing.
- [ ] Only `published` listings are returned; the status check is in the repository query, not only in the service.
- [ ] No internal field and nothing about the reports (who, when, comment, phone, key) is in any answer
  (the field-set tests).
- [ ] No raw SQL built from the slug: the query is a SQLModel `where` with a bound value. The migration uses Alembic operations
  only (no string built from data).
- [ ] The seed and demo data never mark a number as WhatsApp (even fictional numbers can belong to real people): the tests above.
- [ ] No new package, no secret, no `.env` change, no new table. `git diff --stat origin/main -- backend` shows only the files of
  the plan's table, and the one model change is the new column.
- [ ] Demo and test data stay fictional (CLAUDE.md): the tests use the fictional phone number of `tests/factories.py`.

## After the deploy (owner, production)

- [ ] The Render deploy log shows the migration ran (`alembic upgrade head`), and the service started.
- [ ] `GET https://swifthealth-api.onrender.com/listings/<a demo slug>` returns 200 with the fields above, every `is_whatsapp`
  `false`; a draft or unknown slug returns 404; `/docs` shows the endpoint. (The demo slugs are the fixed ones in
  `seed/demo_listings_data.py`.)

## Merge checklist

- [ ] `pytest -q -W error` and `ruff check .` are clean in the backend container. Record the numbers: _(fill in)_.
- [ ] On the draft pull request `Backend CI` runs and is green, and `Frontend CI` does not run. Write what `gh pr checks` shows:
  _(fill in)_.
- [ ] `git diff --stat origin/main -- frontend` is empty.
- [ ] The api-spec, the PRD (FR-10), the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The production check above is done after the deploy.
- [ ] The pull request stays a draft until every box above is ticked.
