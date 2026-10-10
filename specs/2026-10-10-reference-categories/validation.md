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
- [ ] `test_empty_table_gets_all_twelve_categories`
- [ ] `test_categories_are_inserted_in_the_seed_order` (ids go up in the order of `seed_data.CATEGORIES`)
- [ ] `test_clinic_pharmacy_and_laboratory_are_kept_unchanged_and_nine_are_added` (the production case: same ids, names and
  flags for the three that were there; 12 rows afterwards)
- [ ] `test_running_it_twice_changes_nothing` (same 12 rows, same ids)
- [ ] `test_an_existing_category_is_never_updated` (a renamed row and a row with another `recheck_days` stay as they are)
- [ ] `test_emergency_categories_get_14_days_and_the_others_45` (FR-33)
- [ ] `test_listings_and_every_other_table_are_untouched` (rows of listings, phone numbers, hours, services, users, reports and
  audit entries are the same before and after, and a listing keeps its category)
- [ ] `test_downgrade_removes_nothing`
- [ ] `test_get_meta_returns_twelve_categories_after_the_migration` (the service that builds `GET /meta`)
- [ ] `test_migration_list_equals_the_seed_categories` (unit: slug, name, `is_emergency` and `recheck_days` of all 12)
- [ ] `test_migration_has_twelve_different_slugs` (unit)
- [ ] `test_migration_follows_the_last_revision` (unit: `down_revision` is `82a902495666`, and there is one head)

## Review-focus edge cases

- [ ] **No update, no delete.** The SQL has no `UPDATE`, no `DELETE` and no `ON CONFLICT ... DO UPDATE`; read the revision file.
- [ ] **Only `categories`.** The revision names no other table.
- [ ] **No secrets, no real data.** Category names are not personal data; nothing in the file is a key or a phone number.
- [ ] **Fresh database.** `alembic upgrade head` from an empty database builds the tables and then adds the 12 categories
  (the seed afterwards creates none, because they exist).

## Security checklist

- [ ] The migration runs with the same database user as the app, and needs no extra permission.
- [ ] No listing, user, report or audit row changes (`test_listings_and_every_other_table_are_untouched`).
- [ ] `git diff --stat origin/main` shows no change under `frontend/`, `backend/app/` or `backend/seed/`.

## Smoke test (local, scratch databases)

Run these in order. Use a throw-away database, never the development database for the "only three" case.
- [ ] `docker compose exec db psql -U swifthealth -d postgres -c "CREATE DATABASE scratch_categories"`, then
  `docker compose exec -e DATABASE_URL=postgresql+psycopg://swifthealth:swifthealth@db:5432/scratch_categories backend alembic upgrade head`.
  Then `docker compose exec db psql -U swifthealth -d scratch_categories -c "SELECT slug, is_emergency, recheck_days FROM categories ORDER BY id"`
  shows 12 rows, 7 with `is_emergency` true and 14 days, 5 with 45 days.
- [ ] Production case: in `scratch_categories`, `DELETE FROM categories WHERE slug NOT IN ('clinic','pharmacy','laboratory')` (allowed here:
  the table has no listings), `UPDATE alembic_version SET version_num = '82a902495666'`, then run `alembic upgrade head` again. 12
  rows again; the three keep their ids.
- [ ] Run `alembic upgrade head` once more: no error, still 12 rows.
- [ ] On the development database: `alembic upgrade head` is a no-op for categories (the seed made them), and the listings count
  (`SELECT count(*) FROM listings`) is the same before and after.
- [ ] `docker compose exec db psql -U swifthealth -d postgres -c "DROP DATABASE scratch_categories"`.

## After the deploy (owner, production)

Render deploys on merge and runs `alembic upgrade head` when the service starts (it wakes up slowly on the free plan).
- [ ] **Production `GET /meta` returns 12 categories.** Wait until the newest deploy says **Live**, then run
  `curl -s https://swifthealth-api.onrender.com/meta | grep -o '"slug"' | wc -l`. The answer must be `12`. (Or open
  <https://swifthealth-api.onrender.com/meta> in a browser and count the entries of `categories`.)
- [ ] The three categories that were there are still first, with the same names (Clinic, Pharmacy, Laboratory), and `is_emergency`
  is true for exactly seven entries.
- [ ] Nothing happened to the listings: `curl -s "https://swifthealth-api.onrender.com/search?limit=1"` gives the same `total` as
  before the deploy (write the number down before merging: _not written down yet_).
- [ ] The Filters sheet on the live site lists the categories (until the frontend PR hides the emergency ones, it lists all 12).

## Merge checklist

- [ ] `pytest -q` and `ruff check .` are clean in the backend container.
- [ ] On the draft pull request `Backend CI` runs and is green, and `Frontend CI` does not run (nothing under `frontend/` changed).
  Write what `gh pr checks` showed here: _not checked yet_.
- [ ] The api-spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The pull request stays a draft until every box above is ticked.
