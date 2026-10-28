"""How the app and Alembic connect to PostgreSQL.

Requirements: NFR-05, NFR-06. Spec: specs/2026-10-28-neon-database/.

The production database is Neon (it was Render Postgres). Neon has a pooled address (`-pooler` in
the host, PgBouncer in "transaction" mode) and a direct one. The app uses the pooled one
(DATABASE_URL) and Alembic the direct one (DATABASE_URL_DIRECT, see config.py). What that asks of
the psycopg 3 driver, in plain words:

- `prepare_threshold=None`: psycopg prepares a statement on the server after it has run 5 times,
  and a prepared statement belongs to ONE server connection. Behind a transaction pooler the next
  query can reach another connection, which fails with "prepared statement does not exist". None
  means "never prepare on the server" (the psycopg documentation advises it for PgBouncer). It
  costs a little speed, which this API can spare.
- `connect_timeout`: a free Neon database suspends its compute after 5 minutes without queries and
  wakes at the next connection, in about a second. 15 seconds is long enough for that and for a
  slow network, and short enough that a real outage is reported.
- `pool_pre_ping`: each connection is tested before it is used, so one that was closed while the
  database slept is replaced instead of failing a request.
- `pool_recycle`: a connection is not kept longer than 4 minutes, under Neon's 5 minutes of idleness.

These options are harmless for the local database and for Render's, so there is one set for every
address.
"""
from typing import Any

CONNECT_ARGS: dict[str, Any] = {"prepare_threshold": None, "connect_timeout": 15}

ENGINE_OPTIONS: dict[str, Any] = {
    "pool_pre_ping": True,
    "pool_recycle": 240,
    "connect_args": CONNECT_ARGS,
}
