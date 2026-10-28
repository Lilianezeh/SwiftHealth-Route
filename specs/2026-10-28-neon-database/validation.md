# Production database moves to Neon: validation

Requirements: [requirements.md](requirements.md). Plan: [plan.md](plan.md). Runbook: [runbook.md](runbook.md). Decisions D1 to D5 are in `LOG.md`.

## Results (2026-10-28, branch `chore/neon-database`, from `main`)
- **Tests came first** (red: the new module did not exist, then each rule failed until written).
- Backend: **2169 passed, 5 skipped**; `ruff check .` clean. New: 14 cases for the Neon address and the direct address in `test_config.py` (the existing ones are unchanged and still pass), 7 in `test_database_options.py`, 5 in `test_render_blueprint.py` (2148 before, 2169 passed now: +21, the blueprint ones skipped). The 5 blueprint tests are skipped inside the backend container (it does not see `render.yaml`); run with the file mounted (`docker compose run --rm --no-deps -v "$PWD/render.yaml:/render.yaml:ro" backend pytest tests/unit/test_render_blueprint.py`) they **pass 5 of 5**, and they run in CI.
- **Real checks against the local PostgreSQL 18:** `alembic upgrade head` runs through the new `env.py` (at head, no change); 8 queries in a row through the app's engine leave **0 prepared statements** on the server connection.
- **The runbook's commands were rehearsed** on throw-away `postgres:18` containers on the project's Docker network (the Render and Neon addresses were stand-ins): the version and extension queries, the dump (owner 600, 47 kB for the development data), `CREATE EXTENSION pg_trgm`, the restore (exit 0, 11 tables), the row-count comparison for the 10 tables and `alembic_version` (same), a deliberate difference (one audit row removed from the target: the comparison printed it), a second restore over data that was already there (same again), the sequences (the next user id continues), a trigram search (`word_similarity`) in the restored database, and a **Postgres 18 dump restored into a Postgres 17 target** (exit 0, same data). `alembic current` against the restored database prints `(head)`. The `host` helper was tested on made-up Neon and Render addresses (it prints only the host).
- **A fallback that failed, so it is not offered:** build the tables with `alembic upgrade head` on the empty target, then copy the data only: the migrations insert the 15 categories, so the copy stops with a duplicate key, and `pg_dump` warns about circular foreign keys (listings and categories refer to themselves).
- No address, host name or password of the real databases was read, typed, printed or written at any point. The tests use made-up addresses; a test checks that `render.yaml` contains none.

## Not checked by me
- **Anything on Render or Neon:** I changed no setting and have no access. In particular: the exact names of the dashboard buttons, Render's behaviour when this Blueprint changes (its documentation says a `sync: false` variable is ignored when an existing Blueprint is updated; I could not test it on your account), whether the deploy after the merge is healthy, and the behaviour of Neon's pooler with this app. The runbook says what to look at after each step and how to go back.
- The cold start of a sleeping free Neon database on top of the free API's own (about a second, from Neon's documentation; not measured).
- A restore into a Postgres older than 17.

## Render / Netlify
Merging this pull request changes `render.yaml`: Render syncs the Blueprint and deploys. It adds the secret `DATABASE_URL_DIRECT` (ignored for an existing service, so the owner adds it by hand) and makes `DATABASE_URL` a manual secret. It also puts the empty allow list back on the Render database. Follow the order in the runbook (step 6).
