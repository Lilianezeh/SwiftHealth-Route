# Backups and the tested restore (runbook)

Requirement: **NFR-09** (daily automatic backups kept for 30 days, a restore tested monthly). Decisions E4 and E5 in
[requirements.md](requirements.md). Written 2026-10-20; nothing here changes Render or Netlify.

## What exists

| Script | What it does |
| --- | --- |
| `scripts/backup-db.sh` | One `pg_dump` (custom format) into `backups/`, named by the UTC time; then deletes `swifthealth-*.dump` files older than 30 days in that folder only. Local database by default; another database with `--url-from-env NAME` (the address is read from the environment variable `NAME`, never typed on the command line, never printed). |
| `scripts/prune-backups.sh` | The 30-day rule on its own: one folder, only `swifthealth-*.dump`, no sub-folders. |
| `scripts/restore-db.sh` | Restores a dump into a **new** database of the local Docker server. It refuses `swifthealth`, `swifthealth_test` and the system databases, and it never drops anything. |
| `scripts/test-backup-restore.sh` | **The tested restore:** dumps the development database, restores it into a throw-away container, compares the row count of each of the 9 tables and checks that the `pg_trgm` extension came back. No database of ours is changed. |
| `scripts/test-backup-scripts.sh` | Tests of the pruning and the refusals (no Docker needed). |

Result of the test on 2026-10-20: all 9 tables had the same number of rows after the restore (users 4, categories 12, listings 31, phone_numbers 35,
opening_hours 217, services 47, verification_checks 56, user_reports 2, audit_entries 31) and `pg_trgm` was back.

## The monthly routine (the owner)

1. Run `bash scripts/test-backup-restore.sh` (Docker up). It must end with "The restore works".
2. For production, once the database is on a paid Render plan, also open Render's backups page for the database and check that a recent backup exists.
3. Write the date in `LOG.md`.

> **Since 2026-10-28 the production database is moving from Render to Neon** (`specs/2026-10-28-neon-database/runbook.md`). After the move, use Neon's **direct** address (the host without `-pooler`) for `scripts/backup-db.sh`, never the pooled one (Neon: "always use direct connections for `pg_dump`"). Neon's free plan keeps only a short history, so this script, run nightly somewhere, is still the daily backup of NFR-09.

## Backing up the production database yourself (until Render's backups exist)

On your own machine, with the PostgreSQL client tools installed (`pg_dump`), take the database's **External Database URL** from the Render dashboard
(Database, Connections) and put it in a variable that is not saved in your shell history:

```
read -rs PRODUCTION_DATABASE_URL   # paste the address, press Enter; it is not shown
export PRODUCTION_DATABASE_URL
bash scripts/backup-db.sh --url-from-env PRODUCTION_DATABASE_URL
unset PRODUCTION_DATABASE_URL
```

The dump holds staff and reporter data: keep `backups/` private and off shared drives. An external connection may need your address on the database's
allow list in Render (a setting of the dashboard, so it is your step). A free Render database has **no backups and expires after 30 days**; see the
comparison in `LOG.md` ("The Render database expires about 2026-11-07").

## Restoring after a loss

1. Create the new database (Render dashboard) or use the local Docker server.
2. Local: `bash scripts/restore-db.sh backups/<file>.dump --into swifthealth_restored`, then point a throw-away copy of the API at it and check `/search`.
3. On a Render database: `pg_restore --no-owner --dbname "<new database URL>" backups/<file>.dump` from your machine, then set `DATABASE_URL` on the Render service
   (by hand: the Blueprint is on manual sync) and redeploy. The deploy runs `alembic upgrade head`, which does nothing to a restored database that is already current.
4. Check `/health`, `/search`, and the number of listings in the staff list.

## Not done on purpose

- **No Render cron job** in `render.yaml`: a cron job is a paid service. When the database is on a paid plan, Render keeps its own recovery points; ask Render's docs how long.
- **No scheduled job anywhere** (until 2026-10-28): the owner decides where a nightly run would live (a free scheduler such as GitHub Actions can run `pg_dump` against the external URL
  with the address kept as a repository secret; that needs your decision because it puts the production address in GitHub).
  **Update 2026-10-28:** the owner chose GitHub Actions. `.github/workflows/nightly-backup.yml` runs this script every day against Neon's direct address, **encrypts** the dump
  (the repository is public, so an artifact is not private), and keeps the encrypted file for 30 days. Spec, secrets and how to decrypt: `specs/2026-10-28-nightly-jobs/`.
