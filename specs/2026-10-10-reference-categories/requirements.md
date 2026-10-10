# All spec categories in every database (small backend PR): requirements

What this small backend feature must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we
know it is done is in [validation.md](validation.md). It exists because the phone test of the
[search frontend](../2026-10-09-search-frontend/validation.md) showed that production lists only Clinic, Pharmacy and
Laboratory in the Filters sheet.

## Requirements

- **FR-05:** the search filters need the category list, which comes from `GET /meta`. In production that list had three
  entries, because the database only held the categories its demo listings needed.
- **FR-01:** the Find page shortcuts are Hospitals, Clinics, Pharmacies, Maternity and Labs. **FR-15:** SwiftRescue groups
  contacts as Ambulance, Fire, Police, 24-hour emergency units, Roadside assistance, Security and Blood banks. Together
  these are the 12 categories of the seed ([`seed_data.CATEGORIES`](../../backend/seed/seed_data.py)).
- **FR-33:** the re-check cycle is set per category: emergency contacts every 14 days, other listings every 45 days. This is
  where the numbers come from; they are **not new**. The line is [FR-33 in prd.md](../prd.md) (and the closed question
  "Exact re-check cycles for emergency and other listings? Decided in FR-33: 14 days and 45 days" under the open
  questions), and the seed already uses them as `EMERGENCY_RECHECK_DAYS = 14` and `OTHER_RECHECK_DAYS = 45`. No spec
  change is needed for them.

Source of truth: [prd.md](../prd.md), [api-spec.md](../backend/api-spec.md) (`GET /meta`). Branch:
`feature/reference-categories`. Every commit and test references these IDs.

Fit with the project: [mission.md](../mission.md) wants the directory to be dependable for a resident, and
[tech-stack.md](../tech-stack.md) fixes Alembic for schema changes. This adds **no table, no column, no library and no
setting** (CLAUDE.md: exactly 9 tables). It is a data migration on the existing `categories` table.

## In scope

- One new Alembic revision (after `82a902495666`) that inserts the 12 categories that are missing, and changes nothing else.
- Tests that run that revision against a database (the test suite builds tables with `create_all`, not Alembic).
- One sentence in the api-spec `GET /meta` section: every database has all 12 categories.
- A check in [validation.md](validation.md) that production `GET /meta` returns 12 categories after the deploy.

## Out of scope (planned elsewhere)

- Hiding the 7 emergency categories in the public Filters sheet: a **separate frontend pull request after this one**
  (owner's decision, 2026-10-10), recorded in `LOG.md`. `GET /meta` keeps returning all categories with `is_emergency`.
- Renaming or re-ordering categories, parent categories (`parent_id`), or an editor for categories: roadmap phase 10
  (the editor can edit categories, see the Editor role in the PRD).
- Any listing: the migration never reads, inserts, updates or deletes a listing.

## Decisions

1. **A data migration, not a seed.** The backend start command runs `alembic upgrade head` on every deploy
   ([Dockerfile](../../backend/Dockerfile)), so a migration reaches production and every other database by itself. The
   seed does not: production's seed is flag-driven (`SEED_DEMO_LISTINGS`) and only adds what its demo listings need.
   Categories are reference data, so every database needs all of them whatever listings it has.
2. **`INSERT ... ON CONFLICT (slug) DO NOTHING`.** `slug` has a unique index (`ix_categories_slug`), which is what
   PostgreSQL needs for `ON CONFLICT (slug)`. A category that already exists is left exactly as it is: its name, its
   `is_emergency` and its `recheck_days` are not updated (a name an editor changed stays). Running the migration twice
   changes nothing.
3. **The 12 rows are written inside the migration file.** An old migration must keep meaning what it meant when it was
   written, so it does not import `seed_data` (which will change). A test compares the migration's list with
   `seed_data.CATEGORIES` and fails if they drift, so the seed and the migration stay equal until the day somebody
   chooses to change one on purpose.
4. **`recheck_days` is 14 for the 7 emergency categories and 45 for the 5 others** (FR-33, see above). `is_emergency` and
   the names are those of the seed. `parent_id` is empty.
5. **The migration touches only `categories`.** No listing, phone number, hours, service, user, report or audit row is read
   or changed, and no foreign key is added or removed. A test counts the rows of the other tables before and after.
6. **`downgrade()` does nothing.** Removing categories could orphan listings that use them. The data is reference data that
   is safe to keep, so going back one revision leaves it.
7. **Order in `GET /meta`.** `categories` are sorted by `id` (api-spec). Production keeps its existing ids, so there it
   lists Clinic, Pharmacy, Laboratory first and then the new ones in the order the migration inserts them (hospital,
   maternity, then the seven emergency categories). New ones are inserted in the seed's order, so a new database matches
   the seed. The order in production is odd but harmless: the frontend does not depend on it. The frontend PR that hides
   the emergency categories may also sort the Filters list; that is its decision, not this one.
8. **The tests run the revision's `upgrade()` on the test database.** `tests/conftest.py` builds the tables with
   `create_all`, so there is no Alembic history in the test database. The tests load the revision file and run its
   `upgrade()` through Alembic's `Operations` on a connection, which executes the same SQL as `alembic upgrade head`.
   They also check once, by hand, that `alembic upgrade head` works on a scratch database (validation, smoke test).
