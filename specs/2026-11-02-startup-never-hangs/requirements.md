# Requirements: No start-up step can hang; the API always starts

Branch `fix/startup-steps-never-hang`. Status: **built (2026-11-02); draft pull request.** The owner's report of 2026-11-02: Render deploys time
out. The log shows the migration lines, then "Demo listings: no flag set, nothing to do.", then nothing until "Port scan timeout reached, no
open ports detected". The previous deploy stays live.

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| NFR-05 | The API deploys and stays up (a bad start-up step must not take the service down) | Must |
| NFR-06 | Secrets are never printed or logged | Must |

## What was found (read-only, before any change)

The container ran `alembic upgrade head`, the demo listings step, the first admin step, the two-factor reset step and then `uvicorn`, joined by
`&&` in one `CMD` line. Render needs the API's port to open; a step that waits for ever means it never does.

- **Nothing changed in the start command or in those steps in #82 to #89.** `Dockerfile`, `app/bootstrap_admin.py`, `app/reset_two_factor.py`,
  `seed/` and `render.yaml` are the same as before the owner fee work. Only `core/config.py`, `core/photo_address.py`, `integrations/` and
  `jobs/` grew, and none of that runs at start-up.
- **With none of the optional variables set, no step can wait.** Measured in the dev container: migrations 4 s, demo listings 1 s, first admin
  2 s, two-factor reset 2 s. Neither of the last two touches the database then (they return at once and print nothing, which is also why the log
  was silent after the demo step). Nothing reads input (no `input()`, no prompt), nothing at import time uses the network, and the API's
  start-up (`lifespan`) only checks a key in memory.
- **With a variable set, a step queries the database with no time limit.** The database connection has a 15 s limit for *opening*, but a query
  that waits (a lock, a pooled connection that does not answer, a database that is slow to wake) has none. Reproduced on the local database: a
  lock held on `users` kept the reset step waiting until a 20 s outer limit cut it; without the lock it took 1 s. The first admin step
  (`BOOTSTRAP_ADMIN_*`) and the demo listings step (`SEED_DEMO_LISTINGS`) have the same weakness.
- **What could not be told:** which step hung on Render. The log does not say, and the Render environment was not read. The most likely cause is
  a step whose variable is still set (`BOOTSTRAP_ADMIN_*`, `RESET_TWO_FACTOR_FOR_EMAIL`; both are meant to be deleted after one start) meeting a
  database query that waits. If neither is set, the cause is elsewhere and this change still keeps it from stopping the API, but the log will not
  show it unless a step is stopped by name.

## What changes

- `backend/start.sh` replaces the `CMD` chain. Each of the four steps runs through `run_step`: under `timeout` (45 s; 120 s for the
  migrations; then `kill` 5 s later if the step ignores the stop), with **stdin from `/dev/null`** (nothing can wait for input), and a step
  that fails or is stopped is **logged by name** ("First admin stopped after 45s…", "Migrations failed (exit 1)…") and the script goes on.
  The last line is `exec uvicorn …`, so the API always starts and receives the host's signals.
- The limits are settings of the environment (`STARTUP_STEP_TIMEOUT_SECONDS`, `MIGRATION_TIMEOUT_SECONDS`, `STARTUP_KILL_AFTER_SECONDS`).
  At the very worst the whole start-up is about 4 minutes before the API starts.
- `PYTHONUNBUFFERED=1` in the image, so every line a step prints shows at once in the host's log, even from a step that is later stopped.
- No message holds an environment value: only the name of the step and a number.

## Trade-off (for the owner)

The migrations are a step too, so **a migration that fails or runs past 120 s no longer stops the deploy: the API starts anyway**, on the old
schema, and the log says "Migrations failed/stopped". That is what "the API always starts" asks for, but code that needs a new column will
fail on the pages that use it until the migration is run again (the next start runs it again; an Alembic migration is one transaction, so a
stopped one leaves the schema as it was). Say if you would rather have a failed migration keep the old deploy live.

## Out of scope

- No new table, column, route or package. The dev container (`docker-compose.yml`) does not use this script; it has its own command.
- The cause on Render is not proven (see above): please check by name whether the `BOOTSTRAP_ADMIN_*` and `RESET_TWO_FACTOR_FOR_EMAIL`
  variables are still set, and delete them if they are.
