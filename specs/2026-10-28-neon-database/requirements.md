# Production database moves from Render Postgres to Neon: requirements

Requirements: NFR-05 (a production database that stays), NFR-06 (no secret in the repository), NFR-09 (backups, see "Not in this change"). Owner's request of 2026-10-28.

## Why
The free Render database expires about 2026-11-07 (see `LOG.md`, "The Render database expires about 2026-11-07"). The owner chose option B of that comparison, Neon Free, and created the Neon project.

## How `DATABASE_URL` is set today (answer to the owner's question 1)
- `render.yaml` links it to the Render database: `fromDatabase: { name: swifthealth-db, property: connectionString }`. It is **not** a manual variable. The value is Render's private-network address (`postgresql://...`), refreshed at every Blueprint sync.
- `backend/app/core/config.py` reads it as `settings.database_url` and a validator changes the start `postgresql://` to `postgresql+psycopg://`.
- The driver is **psycopg 3** (`psycopg[binary]==3.3.6`) under SQLAlchemy 2.1, async for the app (`create_async_engine`, `app/core/database.py`) and sync for Alembic (`alembic/env.py`, `engine_from_config` with `NullPool`).
- Alembic uses the same address. The container runs `alembic upgrade head` at every start (`backend/Dockerfile`).
- The Render database allows no outside connection (`ipAllowList: []`).

## What changes
1. `render.yaml`: `DATABASE_URL` becomes a **secret set by hand** (`sync: false`, no value, no link), and a second one, `DATABASE_URL_DIRECT`, is added the same way. The `databases:` block stays, so that nothing in the Blueprint deletes the Render database; its comment says it is unused and kept until it expires.
2. `DATABASE_URL` is Neon's **pooled** address (host with `-pooler`, PgBouncer in transaction mode) for the API; `DATABASE_URL_DIRECT` is the **direct** address for Alembic. If `DATABASE_URL_DIRECT` is not set, Alembic uses `DATABASE_URL` (right for local development and for the tests).
3. The app accepts what Neon gives and what Neon needs:
   - `postgres://` and `postgresql://` both get the psycopg driver.
   - A `.neon.tech` host without `sslmode` gets `sslmode=require` (the text of the address is kept as it is, so a password with special characters is not changed).
   - psycopg is told not to prepare statements on the server (`prepare_threshold=None`), which a transaction pooler cannot keep; the connect timeout is 15 s (a sleeping free Neon database wakes in about a second); a connection is tested before use (`pool_pre_ping`) and not kept longer than 240 s (`pool_recycle`).
   - Alembic escapes a `%` in the address (an encoded password), which would otherwise stop the start-up.
4. A runbook for the owner (`runbook.md`): allow an address, `pg_dump` with a Docker image of the server's version, restore into Neon without owner and privileges, compare the rows of each table, switch the variables, check, remove the address, and the way back.
5. `LOG.md`: the Render database stays untouched until it expires; it is not deleted.

## Rules
- No address, host name or password of either database is written in the repository, in a test or in a message. The tests use made-up addresses.
- Nothing is changed in Render or Neon by me: the owner sets the variables and clicks the dashboards.
- Merging this pull request must not change the live database by itself (see the runbook, step 6.1).

## Not in this change
- Backups on Neon (NFR-09). A free Neon database keeps a short history only. The owner decides where a nightly `pg_dump` runs (`specs/2026-10-20-launch-readiness/runbook-backups.md`).
- Removing the Render database block from `render.yaml`: after the database has expired.
- Neon's own settings (auto-suspend, compute size, the role's password rotation) are the owner's in the Neon dashboard.

## Owner steps
Follow `runbook.md`. The order matters: dump, restore and compare **before** merging this pull request; merge; then point the API at Neon.
