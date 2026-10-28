# Production database moves to Neon: plan

Requirements: [requirements.md](requirements.md). Tests first.

1. Tests (red first)
   - `backend/tests/unit/test_config.py`: `postgres://` gets the psycopg driver; a Neon host without `sslmode` gets `sslmode=require`, added once, with other options kept; an address with its own `sslmode`, a Render address, `localhost`, `db` and a look-alike host are left alone; an encoded password comes out exactly as it went in; `database_url_direct` and `alembic_database_url`; a validation error does not print the address.
   - `backend/tests/unit/test_database_options.py` (new): `prepare_threshold=None`, the connect timeout, `pool_pre_ping`, `pool_recycle`; psycopg accepts the arguments (a real refused connection, not a TypeError); an async engine can be made with them; Alembic keeps an encoded password whole and uses the direct address.
   - `backend/tests/unit/test_render_blueprint.py` (new): `DATABASE_URL` and `DATABASE_URL_DIRECT` are `sync: false` and nothing else; no address, password or `neon.tech` in the file; the Render database block is still declared; the other variables are as they were. (Skipped inside the backend container, which does not see the file; it runs in CI.)
2. Code: `app/core/config.py` (the validator, `database_url_direct`, `alembic_database_url`), `app/core/database_options.py` (new), `app/core/database.py`, `alembic/env.py`, `render.yaml`.
3. Rehearsal of every runbook command on throw-away containers (done): version check, dump, `pg_trgm`, restore, tables, row-count comparison and its detection of a difference, a second restore over existing data, a Postgres 18 dump into a Postgres 17 target, sequences. A "plan B" (build the tables with Alembic, copy the data only) **failed** (the migrations insert the categories, and listings and categories refer to themselves), so it is not in the runbook.
4. Checks: ruff, the backend unit suite, the full backend suite, a real Alembic run and a query loop against the local database (no prepared statement is left on the server).
5. Docs: this folder, `LOG.md` (the Render database stays untouched until it expires), a pointer in `runbook-backups.md`.
