#!/bin/sh
# What the production container does when it starts (backend/Dockerfile runs this). Requirements: NFR-05, NFR-06.
# Spec: specs/2026-11-02-startup-never-hangs/. Tests: backend/tests/unit/test_start_script.py.
#
# The host (Render) waits for the API to open its port. A step before the API that waits for ever means no port, so the deploy
# times out. So:
#   - every step runs under `timeout`: a step that is still running when its time is up is stopped, and killed a few seconds
#     later if it ignores that;
#   - every step gets no input at all (stdin is /dev/null), so nothing can wait for a key or an answer;
#   - the MIGRATIONS must succeed (the owner's rule of 2026-11-02): if they fail or are stopped, this script stops with an
#     error and the API is NOT started, so the host keeps the previous deploy live instead of running new code on an old
#     schema;
#   - the other steps (demo listings, first admin, two-factor reset) are one-off helpers: if one fails or is stopped it is
#     reported by name and skipped, and the API starts.
# A step that is stopped can have done part of its work (a migration runs in one transaction, so it is all or nothing; the
# other steps are each safe to run again at the next start).
# Nothing here prints an environment variable: a message holds the name of a step and a number, never a value.

# Seconds. The migrations may take a while on a big table; the one-off admin steps never should.
MIGRATION_TIMEOUT="${MIGRATION_TIMEOUT_SECONDS:-120}"
STEP_TIMEOUT="${STARTUP_STEP_TIMEOUT_SECONDS:-45}"
KILL_AFTER="${STARTUP_KILL_AFTER_SECONDS:-5}"

# run_step "<name>" <seconds> <command> [arguments...]
# Runs the command with a time limit and no input, says by name what went wrong, and returns 1 if it did not work (0 if it did).
# The exit code of `timeout` is 124 when the time ran out, and 137 when the step had to be killed (it ignored the stop).
run_step() {
  name="$1"
  seconds="$2"
  shift 2
  timeout -k "$KILL_AFTER" "$seconds" "$@" </dev/null
  code=$?
  if [ "$code" -eq 124 ] || [ "$code" -eq 137 ]; then
    echo "$name stopped after ${seconds}s (it did not finish)."
    return 1
  elif [ "$code" -ne 0 ]; then
    echo "$name failed (exit $code)."
    return 1
  fi
  return 0
}

# The migrations did not work: stop with an error. The host sees a failed start and keeps the previous deploy live.
refuse_to_start() {
  echo "The API is NOT started because the migrations did not work, so the previous deploy stays live."
  exit 1
}

# A one-off step did not work: say it is skipped (run_step has already said which step and why) and go on.
skipped() {
  echo "That step is skipped. The API starts without it."
}

run_step "Migrations" "$MIGRATION_TIMEOUT" alembic upgrade head || refuse_to_start
run_step "Demo listings" "$STEP_TIMEOUT" python -m seed.demo_listings || skipped
run_step "First admin" "$STEP_TIMEOUT" python -m app.bootstrap_admin --at-startup || skipped
run_step "Two-factor reset" "$STEP_TIMEOUT" python -m app.reset_two_factor --at-startup || skipped

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
