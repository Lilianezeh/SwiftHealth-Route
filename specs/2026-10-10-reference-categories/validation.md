# All spec categories in every database: validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-05, FR-01, FR-15 or FR-33. Tick a box only after the test exists and passes.

## How to run

The host has no Python tooling, so the commands run in the backend container:
- Tests: `docker compose exec backend pytest -q`
- Lint: `docker compose exec backend ruff check .`
- The migration by hand: `docker compose exec backend alembic upgrade head` (see the smoke test)

## Tests per task

### Task 1: `tests/integration/test_categories_migration.py`, `tests/unit/test_categories_migration_list.py`
Each integration test loads the revision file and runs its `upgrade()` on the test database (decision 8).
All 15 passed in the first run and in the full backend suite (642 passed with `-W error`, `ruff check .` clean), commit `e25e5cc`.
They failed first: before the revision file existed, every one of them failed.
- [x] `test_empty_table_gets_all_twelve_categories`
- [x] `test_categories_are_inserted_in_the_seed_order` (ids go up in the order of `seed_data.CATEGORIES`)
- [x] `test_clinic_pharmacy_and_laboratory_are_kept_unchanged_and_nine_are_added` (the production case: same ids, names and
  flags for the three that were there; 12 rows afterwards)
- [x] `test_running_it_twice_changes_nothing` (same 12 rows, same ids)
- [x] `test_an_existing_category_is_never_updated` (a renamed row and a row with another `recheck_days` stay as they are)
- [x] `test_emergency_categories_get_14_days_and_the_others_45` (FR-33; integration, and the same name in the unit file)
- [x] `test_listings_and_every_other_table_are_untouched` (rows of listings, phone numbers, hours, services, users, reports and
  audit entries are the same before and after, and a listing keeps its category)
- [x] `test_downgrade_removes_nothing`
- [x] `test_get_meta_returns_twelve_categories_after_the_migration` (the service that builds `GET /meta`)
- [x] `test_migration_list_equals_the_seed_categories` (unit: slug, name, `is_emergency` and `recheck_days` of all 12)
- [x] `test_migration_has_twelve_different_slugs` (unit)
- [x] `test_migration_follows_the_last_revision_and_is_the_only_head` (unit: `down_revision` is `82a902495666`, and there is one head)
- [x] `test_migration_sql_only_inserts_and_never_updates_or_deletes` and `test_migration_names_only_the_categories_table`
  (unit: the file has `ON CONFLICT (slug) DO NOTHING`, and no `UPDATE`, `DELETE`, `DO UPDATE`, `TRUNCATE` or `DROP`; it names
  no other table; added while writing the tests)

## Review-focus edge cases

- [x] **No update, no delete.** The SQL has no `UPDATE`, no `DELETE` and no `ON CONFLICT ... DO UPDATE` (read the revision file,
  and `test_migration_sql_only_inserts_and_never_updates_or_deletes`).
- [x] **Only `categories`.** The revision names no other table (`test_migration_names_only_the_categories_table`).
- [x] **No secrets, no real data.** Category names are not personal data; nothing in the file is a key or a phone number.
- [x] **Fresh database.** `alembic upgrade head` from an empty database builds the tables and then adds the 12 categories
  (smoke test, 2026-10-10: it ran the three revisions and left 12 rows).
- [x] **Ids have gaps.** `ON CONFLICT DO NOTHING` still uses up a sequence number, so after the production case the new
  categories have ids 13, 16, 18 and up (not 4 to 12). Harmless: `GET /meta` sorts by id, and nothing relies on consecutive ids.

## Security checklist

- [ ] The migration runs with the same database user as the app, and needs no extra permission. (It does: Render's start
  command runs `alembic upgrade head` with the app's own connection, as it did for the two earlier revisions. Confirm in
  the deploy log after the merge.)
- [x] No listing, user, report or audit row changes (`test_listings_and_every_other_table_are_untouched`; and on the
  development database the listings count was 30 before and after).
- [x] `git diff --stat origin/main` shows no change under `frontend/`, `backend/app/` or `backend/seed/` (checked 2026-10-10).

## Smoke test (local, scratch databases)

Run these in order. Use a throw-away database, never the development database for the "only three" case.
Done on 2026-10-10 (before the computer switched off). The development password is not the one in the old command below, so the
scratch URL was taken from the container's own `DATABASE_URL` with the database name replaced by `scratch_categories`.
- [x] `CREATE DATABASE scratch_categories`, then `alembic upgrade head` against it. It ran the three revisions
  (`create initial tables`, `search: pg_trgm...`, `all spec categories`). The query showed **12 rows, 7 emergency, 7 with 14
  days and 5 with 45 days**.
- [x] Production case: in `scratch_categories`, `DELETE FROM categories WHERE slug NOT IN ('clinic','pharmacy','laboratory')`
  (9 rows), `UPDATE alembic_version SET version_num = '82a902495666'`, then `alembic upgrade head` again. 12 rows again; the
  three kept their ids (2, 3, 5), and the other nine were added.
- [x] Run `alembic upgrade head` once more (version set back first): no error, still 12 rows.
- [x] On the development database: `alembic upgrade head` ran the new revision; categories stayed 12 (the seed made them) and
  listings stayed 30 before and after.
- [x] `DROP DATABASE scratch_categories` (done).

## After the deploy (owner, production)

Render deploys on merge and runs `alembic upgrade head` when the service starts (it wakes up slowly on the free plan).
- [ ] **Production `GET /meta` returns 12 categories.** Wait until the newest deploy says **Live**, then run
  `curl -s https://swifthealth-api.onrender.com/meta | grep -o '"slug"' | wc -l`. The answer must be `12`. (Or open
  <https://swifthealth-api.onrender.com/meta> in a browser and count the entries of `categories`.)
- [ ] The three categories that were there are still first, with the same names (Clinic, Pharmacy, Laboratory), and `is_emergency`
  is true for exactly seven entries.
- [ ] Nothing happened to the listings: `curl -s "https://swifthealth-api.onrender.com/search?limit=1"` gives the same `total` as
  before the deploy. **Before the deploy (read from production on 2026-10-10): `total` is 4, and `GET /meta` has exactly 3
  categories: `clinic`, `pharmacy`, `laboratory`.** After the deploy `total` must still be 4 and `/meta` must have 12.
- [ ] The Filters sheet on the live site lists the categories (until the frontend PR hides the emergency ones, it lists all 12).

## Merge checklist

- [x] `pytest -q` and `ruff check .` are clean in the backend container (642 passed with `-W error`, ruff "All checks passed",
  2026-10-10, on `e25e5cc`).
- [x] On the draft pull request `Backend CI` runs and is green, and `Frontend CI` does not run (nothing under `frontend/` changed).
  What `gh pr checks` showed on PR #15 (2026-10-10): `backend` **pass** (1m8s, run 38069826990); the only GitHub workflow run on
  the branch is Backend CI (no Frontend CI run exists); Netlify `deploy-preview` pass, "Header rules", "Redirect rules" and
  "Pages changed" skipping. The PR is clean and mergeable.
- [x] The api-spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date (Task 0, `f3cafb3`; the final status lines are
  updated after the merge).
- [ ] The pull request stays a draft until every box above is ticked.
