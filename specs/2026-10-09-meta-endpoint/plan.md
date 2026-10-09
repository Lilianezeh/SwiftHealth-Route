# GET /meta and no location in the logs (Phase 5B-0): plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and
checks that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (FR-03, FR-05, NFR-07) in every commit and test. Tick a box
with its commit hash only when the step is really done. Check `git branch --show-current` before every commit and
push, and never push to `main` (CLAUDE.md).

## Files

| File | Change |
| --- | --- |
| `specs/backend/api-spec.md` | `GET /meta`: categories sorted by `id`, `services` list; `GET /search`: server logs never keep `lat` or `lng` |
| `backend/app/core/config.py` | New constant `BLOOD_GROUPS` next to the areas |
| `backend/app/schemas/meta.py` | New: `MetaCategory`, `MetaResponse` |
| `backend/app/repositories/category_repository.py` | New `list_all` (sorted by id) |
| `backend/app/repositories/service_repository.py` | New: `list_public_names` (service names of published listings, one query) |
| `backend/app/services/meta_service.py` | New: `get_meta` (async, awaits the repositories; drops the blood groups, dedupes and sorts the service names) |
| `specs/backend/api-spec.md` | Also: `GET /meta` has `services` (done in Task 0) |
| `backend/app/api/routes/public.py` | `GET /meta`: reads the request, calls the service, returns the schema (the `POST /facility-submissions` TODO stays) |
| `backend/app/core/logging_filters.py` | New: `RedactLocationFilter` and `install_log_redaction()` |
| `backend/app/core/service_names.py` | New (Task 2b): `normalise_service_name` (Python) and `normalised_service_name_expression` (SQL), the one rule for "the same service" |
| `backend/app/repositories/search_repository.py` | Task 2b: the `service` filter uses the shared SQL expression |
| `backend/tests/unit/test_service_names.py`, `tests/integration/test_service_names_sql.py` | New (Task 2b) |
| `backend/app/main.py` | Call `install_log_redaction()` once |
| `backend/tests/integration/test_meta.py` | New |
| `backend/tests/unit/test_meta_service.py`, `test_logging_filters.py` | New |
| `specs/roadmap.md`, `LOG.md` | Phase 5B-0 status; the notes about Render's request logs |

## Tasks

### Task 0: Spec (this commit)
- [ ] Write this folder, the roadmap split (5B-0, 5B-1, 5B-2) and the [search frontend](../2026-10-09-search-frontend/requirements.md)
  folder. Add the two api-spec notes (categories sorted by `id`; the logs never keep `lat` or `lng`) and the `LOG.md`
  notes. Commit: `docs(specs): phase 5B split, GET /meta and search frontend specs (FR-03, FR-05, NFR-07)`.

### Task 1: `GET /meta` (tests first)
- [ ] Write `tests/integration/test_meta.py` and `tests/unit/test_meta_service.py` (names in [validation.md](validation.md)).
  They fail with 404, because the route is a TODO.
- [ ] Add `BLOOD_GROUPS`, `list_all`, `service_repository.list_public_names`, the schemas, `meta_service.get_meta` and the route.
- [ ] Run `pytest -q` and `ruff check .`, then commit: `feat(meta): GET /meta with areas, categories, blood groups and report reasons (FR-03, FR-05)`.

### Task 2: no position in the access log (tests first)
- [ ] Write `tests/unit/test_logging_filters.py` first. They fail: the module does not exist.
- [ ] Write `core/logging_filters.py` and install it from `main.py`.
- [ ] Mutation check (it protects personal data): stop redacting `lng`, make the name match case-sensitive, make the
  filter drop the record, and make it redact `latitude` too; each must fail a test. Restore the code.
- [ ] Run `pytest -q` and `ruff check .`, then commit: `feat(logging): redact lat and lng in the access log (NFR-07)`.

### Task 2b: one rule for "the same service" (tests first; decision 9)
- [ ] Write the tests first (names in [validation.md](validation.md)): the rule itself, SQL against Python on many strings,
  the `service` filter in the repository and through `GET /search`, `/meta` merging, and a no-drift test that checks
  both against each other. Watch the filter and merge tests fail with today's code (`lower(name) = lower(text)`).
- [ ] Write `core/service_names.py` (`normalise_service_name` and `normalised_service_name_expression`), use the first in
  `meta_service.choose_service_names` and the second in `search_repository`. Nothing else compares service names.
- [ ] Run `pytest -q` and `ruff check .`, then commit: `fix(search): the service filter and /meta share one same-service rule (FR-05, US-05)`.

### Task 3: Wrap-up
- [ ] Run the checks and the smoke test in [validation.md](validation.md), including a real request to the dev server
  and a look at its log.
- [ ] Update `LOG.md`, the [roadmap](../roadmap.md), tick the boxes in this folder with their commit hashes.
- [ ] Commit: `docs(specs): GET /meta wrap-up (FR-03, FR-05, NFR-07)`. Push the branch, open a draft pull request.
- [ ] Give the owner the after-merge steps (live `/meta` and the Render log check), written for a beginner.
