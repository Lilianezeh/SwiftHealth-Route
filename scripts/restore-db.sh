#!/usr/bin/env bash
# Restores a backup into a NEW database of the local Docker server. Requirement: NFR-09 (a restore that is tested).
# Usage: scripts/restore-db.sh <dump file> --into <new database name>
# It creates the database (it never drops or overwrites one), and it REFUSES the live database name `swifthealth` and the test
# database `swifthealth_test`, so a restore can never replace the data you are using. To look at the data, point a throw-away
# copy of the app at the new database. Restoring on another server is done by hand, with the steps in the runbook.
set -eu
dump="${1:-}"
if [ -z "$dump" ] || [ "${2:-}" != "--into" ] || [ -z "${3:-}" ]; then
  echo "Usage: restore-db.sh <dump file> --into <new database name>" >&2; exit 2
fi
target="$3"
if [ ! -f "$dump" ]; then echo "No such file: $dump" >&2; exit 2; fi
case "$target" in (*[!a-z0-9_]*|'') echo "The database name may hold only a-z, 0-9 and _." >&2; exit 2;; esac
case "$target" in (swifthealth|swifthealth_test|postgres|template0|template1) echo "Refused: $target is a database in use." >&2; exit 3;; esac
docker compose exec -T db createdb -U swifthealth "$target"
docker compose exec -T db pg_restore --no-owner -U swifthealth -d "$target" < "$dump"
echo "Restored into the new database: $target"
