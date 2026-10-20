#!/usr/bin/env bash
# Tests for the rules of the backup scripts that need no Docker: the 30-day pruning and the refusals of the restore script.
# Run from anywhere: bash scripts/test-backup-scripts.sh. It works in a temp folder; nothing in this repo is touched.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0
ok() { echo "ok    $1"; }
fail() { echo "FAIL  $1"; failures=$((failures + 1)); }

# --- pruning ---
mkdir -p "$work/keep" "$work/keep/sub"
touch -d "40 days ago" "$work/keep/swifthealth-old.dump"
touch -d "31 days ago" "$work/keep/swifthealth-31.dump"
touch -d "29 days ago" "$work/keep/swifthealth-29.dump"
touch -d "40 days ago" "$work/keep/notes.txt"
touch -d "40 days ago" "$work/keep/other.dump"
touch -d "40 days ago" "$work/keep/sub/swifthealth-deep.dump"
bash "$here/prune-backups.sh" "$work/keep" 30 >/dev/null
[ ! -e "$work/keep/swifthealth-old.dump" ] && [ ! -e "$work/keep/swifthealth-31.dump" ] && ok "deletes dumps older than 30 days" || fail "deletes dumps older than 30 days"
[ -e "$work/keep/swifthealth-29.dump" ] && ok "keeps a dump of 29 days" || fail "keeps a dump of 29 days"
[ -e "$work/keep/notes.txt" ] && [ -e "$work/keep/other.dump" ] && ok "never touches another file name" || fail "never touches another file name"
[ -e "$work/keep/sub/swifthealth-deep.dump" ] && ok "never goes into a sub-folder" || fail "never goes into a sub-folder"
bash "$here/prune-backups.sh" "$work/nothing-here" 30 >/dev/null 2>&1 && fail "refuses a folder that does not exist" || ok "refuses a folder that does not exist"
ln -s "$work/keep" "$work/link"
bash "$here/prune-backups.sh" "$work/link" 30 >/dev/null 2>&1 && fail "refuses a link" || ok "refuses a link"
bash "$here/prune-backups.sh" "$work/keep" "3x" >/dev/null 2>&1 && fail "refuses days that are not a number" || ok "refuses days that are not a number"

# --- the restore script refuses before it touches anything ---
touch "$work/a.dump"
for name in swifthealth swifthealth_test postgres template1; do
  output="$(bash "$here/restore-db.sh" "$work/a.dump" --into "$name" 2>&1)"; status=$?
  if [ "$status" -eq 3 ] && grep -q "Refused" <<<"$output"; then ok "refuses to restore into $name"; else fail "refuses to restore into $name (status $status)"; fi
done
bash "$here/restore-db.sh" "$work/missing.dump" --into fresh_copy >/dev/null 2>&1 && fail "refuses a dump that is not there" || ok "refuses a dump that is not there"
bash "$here/restore-db.sh" "$work/a.dump" --into "Bad-Name;drop" >/dev/null 2>&1 && fail "refuses a database name with odd characters" || ok "refuses a database name with odd characters"
bash "$here/restore-db.sh" "$work/a.dump" >/dev/null 2>&1 && fail "needs --into" || ok "needs --into"

# --- the backup script ---
bash "$here/backup-db.sh" --url-from-env NO_SUCH_VARIABLE_FOR_TEST --folder "$work/b" >/dev/null 2>&1 && fail "refuses an empty address variable" || ok "refuses an empty address variable"
bash "$here/backup-db.sh" --keep-days x --folder "$work/b" >/dev/null 2>&1 && fail "refuses keep-days that is not a number" || ok "refuses keep-days that is not a number"
secret_url="postgresql://user:very-secret-password@example.invalid/db"
output="$(SECRET_URL_FOR_TEST="$secret_url" bash "$here/backup-db.sh" --url-from-env SECRET_URL_FOR_TEST --folder "$work/c" 2>&1)"
if grep -q "very-secret-password" <<<"$output"; then fail "never prints the address"; else ok "never prints the address"; fi
[ -z "$(ls "$work/c" 2>/dev/null)" ] && ok "removes an empty or failed backup" || fail "removes an empty or failed backup"

if [ "$failures" -ne 0 ]; then echo "$failures test(s) failed."; exit 1; fi
echo "All backup script tests passed."
