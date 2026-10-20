#!/usr/bin/env bash
# The tested restore (NFR-09): dump the development database, restore the dump into a THROW-AWAY container, and compare the number
# of rows of every table. No database of ours is changed or dropped; the container is removed at the end.
# Run from the repository root with `docker compose up` running:  bash scripts/test-backup-restore.sh
set -eu
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
name="swifthealth-restore-test-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

bash "$here/backup-db.sh" --folder "$work" >/dev/null
dump="$(ls "$work"/swifthealth-*.dump)"

docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=throwaway postgres:18 >/dev/null
for attempt in $(seq 1 40); do
  if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$name" createdb -U postgres restored
docker exec -i "$name" pg_restore --no-owner -U postgres -d restored < "$dump"

tables="users categories listings phone_numbers opening_hours services verification_checks user_reports audit_entries"
failures=0
for table in $tables; do
  source_count="$(docker compose exec -T db psql -U swifthealth -d swifthealth -Atc "select count(*) from $table")"
  restored_count="$(docker exec "$name" psql -U postgres -d restored -Atc "select count(*) from $table")"
  if [ "$source_count" = "$restored_count" ]; then
    echo "ok    $table: $restored_count rows"
  else
    echo "FAIL  $table: $source_count rows in the source, $restored_count after the restore"
    failures=$((failures + 1))
  fi
done
extension="$(docker exec "$name" psql -U postgres -d restored -Atc "select count(*) from pg_extension where extname = 'pg_trgm'")"
if [ "$extension" = "1" ]; then echo "ok    the pg_trgm extension came back"; else echo "FAIL  the pg_trgm extension is missing"; failures=$((failures + 1)); fi
if [ "$failures" -ne 0 ]; then echo "$failures check(s) failed."; exit 1; fi
echo "The restore works: every table has the same number of rows."
