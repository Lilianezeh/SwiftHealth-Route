#!/usr/bin/env bash
# One backup of the database, in pg_dump's custom format, named by the date. Requirement: NFR-09.
# Usage:
#   scripts/backup-db.sh                       # the local Docker database (docker compose must be up)
#   scripts/backup-db.sh --url-from-env NAME   # another database: the address is read from the environment variable NAME
# Options: --folder <folder> (default backups/), --keep-days <days> (default 30; copies older than that are deleted from the folder).
# The address is read from the environment so it is not typed on the command line; nothing here prints it or a dump's content.
# The dump holds personal data (staff, reporters): keep the folder private. `backups/` is in .gitignore.
set -eu
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
folder="backups"
keep_days=30
url_variable=""
while [ $# -gt 0 ]; do
  case "$1" in
    --folder) folder="${2:?--folder needs a folder}"; shift 2;;
    --keep-days) keep_days="${2:?--keep-days needs a number}"; shift 2;;
    --url-from-env) url_variable="${2:?--url-from-env needs a variable name}"; shift 2;;
    *) echo "Unknown option: $1" >&2; exit 2;;
  esac
done
case "$keep_days" in (*[!0-9]*|'') echo "--keep-days must be a whole number" >&2; exit 2;; esac
mkdir -p "$folder"
chmod 700 "$folder"
file="$folder/swifthealth-$(date -u +%Y-%m-%dT%H%M%SZ).dump"
umask 077
if [ -n "$url_variable" ]; then
  address="${!url_variable:-}"
  if [ -z "$address" ]; then echo "The variable $url_variable is empty or not set." >&2; exit 2; fi
  pg_dump --format=custom --no-owner --dbname="$address" --file="$file" >/dev/null 2>&1 \
    || { rm -f "$file"; echo "The backup failed (pg_dump could not dump that database)." >&2; exit 1; }
else
  docker compose exec -T db pg_dump --format=custom --no-owner -U swifthealth swifthealth > "$file" \
    || { rm -f "$file"; echo "The backup failed (is docker compose up?)." >&2; exit 1; }
fi
if [ ! -s "$file" ]; then echo "The backup is empty: removed." >&2; rm -f "$file"; exit 1; fi
echo "Backup written: $file ($(wc -c < "$file") bytes)"
"$here/prune-backups.sh" "$folder" "$keep_days" | sed 's/^/Deleted old backup: /'
