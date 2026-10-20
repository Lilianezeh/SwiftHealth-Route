#!/usr/bin/env bash
# Deletes backup files older than N days, in ONE folder, and only files named swifthealth-*.dump. Requirement: NFR-09 (kept 30 days).
# Usage: scripts/prune-backups.sh <folder> <days>
# It never goes into sub-folders, never touches another file name, and refuses a folder that is not a plain directory.
set -eu
folder="${1:-}"
days="${2:-}"
if [ -z "$folder" ] || [ -z "$days" ]; then echo "Usage: prune-backups.sh <folder> <days>" >&2; exit 2; fi
case "$days" in (*[!0-9]*|'') echo "days must be a whole number" >&2; exit 2;; esac
if [ ! -d "$folder" ] || [ -L "$folder" ]; then echo "$folder is not a plain folder" >&2; exit 2; fi
find "$folder" -maxdepth 1 -type f -name 'swifthealth-*.dump' -mtime "+$days" -print -delete
