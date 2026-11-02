#!/bin/sh
# What the production container does when it starts (backend/Dockerfile runs this). Requirements: NFR-05, NFR-06.
# Spec: specs/2026-11-02-startup-never-hangs/. Tests: backend/tests/unit/test_start_script.py.
#
# The host (Render) waits for the API to open its port. A step before the API that waits for ever means no port, so the deploy
# times out and the old version stays live. So:
#   - every step runs under `timeout`: a step that is still running when its time is up is stopped, and killed a few seconds
#     later if it ignores that;
#   - every step gets no input at all (stdin is /dev/null), so nothing can wait for a key or an answer;
#   - a step that fails or is stopped is reported by name and the script goes on: the API is the last line, whatever happened.
# A step that is stopped can have done part of its work (a migration runs in one transaction, so it is all or nothing; the
# demo listings, the first admin and the two-factor reset are each safe to run again at the next start).
# Nothing here prints an environment variable: a message holds the name of a step and a number, never a value.

# Seconds. The migrations may take a while on a big table; the one-off admin steps never should.
MIGRATION_TIMEOUT="${MIGRATION_TIMEOUT_SECONDS:-120}"
STEP_TIMEOUT="${STARTUP_STEP_TIMEOUT_SECONDS:-45}"
KILL_AFTER="${STARTUP_KILL_AFTER_SECONDS:-5}"

# run_step "<name>" <seconds> <command> [arguments...]
# The exit code of `timeout` is 124 when the time ran out, and 137 when the step had to be killed (it ignored the stop).
run_step() {
  name="$1"
  seconds="$2"
  shift 2
  timeout -k "$KILL_AFTER" "$seconds" "$@" </dev/null
  code=$?
  if [ "$code" -eq 124 ] || [ "$code" -eq 137 ]; then
    echo "$name stopped after ${seconds}s (it did not finish). The API starts without waiting for it."
  elif [ "$code" -ne 0 ]; then
    echo "$name failed (exit $code). The API starts without it."
  fi
  return 0
}

run_step "Migrations" "$MIGRATION_TIMEOUT" alembic upgrade head
run_step "Demo listings" "$STEP_TIMEOUT" python -m seed.demo_listings
run_step "First admin" "$STEP_TIMEOUT" python -m app.bootstrap_admin --at-startup
run_step "Two-factor reset" "$STEP_TIMEOUT" python -m app.reset_two_factor --at-startup

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
