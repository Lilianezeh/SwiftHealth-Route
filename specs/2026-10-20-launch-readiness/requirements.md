# Launch readiness (Phase 14): requirements

CSV import and export, backups with a tested restore, a proposal for the anonymous analytics, and the walk through the release criteria.
How we build it is in [plan.md](plan.md); how we know it is done is in [validation.md](validation.md). Branch: `feature/launch-readiness`,
stacked on `feature/info-pages` (PR #28) in the unattended run of 2026-10-17. **Nothing paid or irreversible is done here**: no Render cron job
(a cron job is a paid service), no production change, no demo cleanup (that is a step for the owner, written out in the release checklist).

## Requirements

[prd.md](../prd.md): **FR-39** (bulk import of listings from a CSV, Should), **FR-40** (export listings and verification logs to CSV, Should),
**NFR-09** (daily automatic backups kept for 30 days, a restore tested monthly), **NFR-06**, **NFR-07**, "Analytics" (anonymous events only),
"Release criteria". Source of truth: [api-spec.md](../backend/api-spec.md) (section 11) and [ui-spec.md](../frontend/ui-spec.md) (3.9).
No new package and **no new table**.

## In scope

- **14a:** `POST /admin/import`, `GET /admin/export` and the screen `/admin/import-export` (admin only).
- **14b:** a backup script, a restore script and a script that **tests the restore** on a throw-away database; the monthly restore routine and the
  Render options written as a runbook (`runbook-backups.md`).
- **14c:** a **proposal only** (`analytics-proposal.md`): the anonymous events need somewhere to be stored and the project has exactly 9 tables, so the
  owner chooses; nothing is built.
- **14d:** `release-checklist.md`: every release criterion of the PRD with its status and the evidence, the list of owner actions (keys, variables,
  the demo cleanup step) and the merge order.

## Out of scope

- A scheduled backup job on Render (paid) and any change to Render or Netlify: the owner's, see the runbook.
- Building the analytics (needs a table or an outside tool: the owner decides, see the proposal).
- CSV import of services, hours or several phones per listing (the columns of the api-spec only).

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| E1 | **The import takes the CSV as the request body with `Content-Type: text/csv`**, not as `multipart/form-data` as the api-spec first said: reading a multipart upload needs the `python-multipart` package, and a new package needs your approval (CLAUDE.md). The screen reads the chosen file in the browser and sends its text. The api-spec is changed to say so. | Add `python-multipart` |
| E2 | **Import rules:** at most **500 rows** and 1 MB per file; UTF-8 (a leading byte-order mark is ignored); the header row must name the columns of the api-spec (any order, extra columns ignored); a row with a problem is **skipped and reported** (`{ "row": 7, "detail": "Unknown area" }`, where row 1 is the header) while the good rows are created as drafts owned by the admin; a row whose **name and area already exist** (any case) is reported as "Already listed" so a second import of the same file creates nothing; every created draft gets a `create` audit entry with the reference `csv-import`. `is_24_hours` accepts true/false, yes/no, 1/0. Each row has one phone, the primary one. | Fail the whole file on one bad row |
| E3 | **Export:** `type=listings` has `id, slug, name, category, area, address, landmark, latitude, longitude, phone, is_24_hours, status, last_verified_at, next_check_due`; `type=checks` has `id, listing_id, listing_name, staff_name, method, result, person_reached, notes, photo_url, checked_at`. A cell that begins with `=`, `+`, `-`, `@`, tab or carriage return gets a `'` in front, so a spreadsheet never runs it as a formula (CSV injection); this is also applied to imported text on export. The file is sent as an attachment. | No protection |
| E4 | **Backups:** `scripts/backup-db.sh` writes a `pg_dump` in custom format to a folder, names it by date and **deletes copies older than 30 days in that folder only**; `scripts/restore-db.sh` restores a dump only into a database you name with `--into` and **refuses** the database the dump came from or any URL that is not `localhost`/the compose `db` unless `--really-here` is added; `scripts/test-backup-restore.sh` dumps the development database, restores it into a **throw-away container** (no database of ours is changed or dropped) and compares the row count of each of the 9 tables. Dumps are kept out of git (`backups/` in `.gitignore`) and are never printed. A monthly restore test (NFR-09) is the owner's routine in the runbook. | Only Render's own backups |
| E5 | **No Render cron job** is added to `render.yaml`: it is a paid service. The runbook says how to run the backup from a laptop or from Render's own backups when the database is upgraded. | Add a cron job |
| E6 | **Analytics:** a proposal with three options (a new table, the audit table's `action` column, an outside cookie-free tool) and a recommendation, for you to choose. | Build one of them now |
