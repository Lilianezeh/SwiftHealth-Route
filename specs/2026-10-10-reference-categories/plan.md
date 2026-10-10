# All spec categories in every database: plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and checks
that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (FR-05, FR-01, FR-15, FR-33) in every commit and test. Tick a box with
its commit hash only when the step is really done. Check `git branch --show-current` before every commit and push, and never
push to `main` (CLAUDE.md). The pull request stays a draft until the merge checklist in [validation.md](validation.md) is ticked.

## Files

| File | Change |
| --- | --- |
| `specs/backend/api-spec.md` | `GET /meta`: every database has all 12 categories (Task 0) |
| `specs/2026-10-10-reference-categories/` | This folder (Task 0) |
| `specs/roadmap.md`, `LOG.md` | A small item in the roadmap; `LOG.md`: this item updated, and the frontend PR (hide emergency categories in Filters) added (Task 0) |
| `backend/alembic/versions/<id>_all_spec_categories.py` | New (Task 1): the data migration |
| `backend/tests/integration/test_categories_migration.py` | New (Task 1): runs the revision on the test database |
| `backend/tests/unit/test_categories_migration_list.py` | New (Task 1): the migration's list equals `seed_data.CATEGORIES` |

No change to `backend/app/`, `backend/seed/`, any model, the frontend, `render.yaml` or any setting.

## Tasks

### Task 0: Spec (done, `f3cafb3`)
- [x] Write this folder, the api-spec sentence, the roadmap item and the `LOG.md` notes. Commit:
  `docs(specs): all spec categories in every database, spec (FR-05, FR-15, FR-33)`.

### Task 1: The migration (tests first) (done, `e25e5cc`)
- [x] Write the tests (names in [validation.md](validation.md)). They fail: the revision does not exist.
- [x] Create the revision with `docker compose exec backend alembic revision -m "all spec categories"` (revision
  `f6184e303abb`) and write `upgrade()` by hand (Alembic cannot detect data): one `INSERT ... ON CONFLICT (slug) DO NOTHING`
  per category, with the values of decisions 3 and 4, and an empty `downgrade()` with a comment saying why. (The container
  created the file as root; `chown` to the host user was needed before it could be edited.)
- [x] Run `pytest -q` and `ruff check .` in the backend container (642 passed with `-W error`; ruff clean), then commit:
  `feat(db): add all spec categories to every database, idempotent data migration (FR-05, FR-15, FR-33)`.

### Task 2: Wrap-up
- [x] Smoke test on scratch databases and the dev database (see [validation.md](validation.md)): `alembic upgrade head` from
  empty, on a database with only Clinic, Pharmacy and Laboratory, and a second time. All passed on 2026-10-10.
- [ ] Push the branch and open the draft pull request. Check that `Backend CI` ran and that `Frontend CI` did not (nothing
  under `frontend/` changes); write what `gh pr checks` shows in [validation.md](validation.md).
- [ ] After the merge and the Render deploy, the owner does the production check in [validation.md](validation.md) (12
  categories in `GET /meta`). Then update the roadmap and `LOG.md`, and tick the boxes with their commit hashes.
