# Nightly jobs and the daily Neon backup (GitHub Actions)

Requirements: **NFR-09** (daily automatic backups, a tested restore), **FR-33**, **FR-36**, **FR-38**, **US-11** (the nightly re-check),
**FR-48** (unfinished sign-ups are removed after 7 days, the promise on the Privacy page), **NFR-05**, **NFR-06** (no secret in the repository).
Written 2026-10-28, after the production database moved to Neon (`specs/2026-10-28-neon-database/`).

## What the owner asked for

Free GitHub Actions schedules, with repository secrets that are never printed, that run:

1. every night the re-check job (`python -m app.jobs.recheck`),
2. every night the sign-up clean-up (`python -m app.jobs.purge_signups`),
3. every day a backup of Neon with `scripts/backup-db.sh`, using the direct address, kept as a private GitHub Actions artifact for 7 days.
   **Changed by the owner on 2026-10-28, after the first draft:** keep the **encrypted** backups in the public repository (decision J1), and keep them **30 days**, to match NFR-09 (decision J2).

Tell the owner exactly which repository secrets to add, and how. Draft pull request; nothing in GitHub settings, Render or Neon is changed by me.

## What is built

| File | What it does |
| --- | --- |
| `.github/workflows/nightly-jobs.yml` | Two jobs, started at 00:00 UTC (01:00 in Lagos): `recheck` and `purge-signups`. Each installs the backend requirements and runs the job module against Neon's direct address. |
| `.github/workflows/nightly-backup.yml` | One job at 00:30 UTC (01:30 in Lagos): installs a `pg_dump` of the same major version as the Neon server, runs `scripts/backup-db.sh --url-from-env DATABASE_URL`, checks the dump can be read, **encrypts it**, deletes the plain file, uploads only the encrypted file with `retention-days: 30`. |
| `backend/tests/unit/test_github_workflows.py` | 22 tests that read both files and hold the safety rules below. |
| `how-to-add-the-secrets.md` | The owner's steps: the four repository secrets, how to add them, how to test, how to decrypt and restore. |

## The one thing that differs from the request: "private artifact"

**This repository is public.** The logs and the artifacts of a run in a public repository can be read, and the artifacts downloaded, by any GitHub user who is
signed in. A "private" artifact is not possible here. The dump holds staff and reporter data (emails, phone numbers, password hashes). So:

- the dump is **encrypted on the runner** with `gpg` (symmetric, AES-256, a passphrase kept as a repository secret) and only the encrypted file is uploaded;
- the plain file is deleted before the upload step, and the workflow checks that none is left;
- without the passphrase the file cannot be read, so the passphrase is a strong random value kept in the owner's password manager (how: the how-to).

**Decided by the owner (J1): the encrypted backups stay in the public repository.** What that means, plainly: up to 30 encrypted dumps (one a day) can be downloaded by
anyone signed in to GitHub. They stay unreadable only while `BACKUP_PASSPHRASE` stays secret and is strong. If the passphrase leaks, every dump still in the
30-day window can be read, and so can any copy someone already downloaded, and it cannot be taken back. The passphrase is therefore the one thing to protect (random, from
`openssl rand -base64 32`, only in a password manager and the repository secret). The safer options (a private repository, or private storage) remain open if the risk changes, for example at launch with real users' data.

## Safety rules (each one has a test)

- Started only by `schedule` or `workflow_dispatch` (the "Run workflow" button). **No `pull_request` trigger**, so code from a pull request or a fork can never read a secret.
- The token can only read the repository (`permissions: contents: read`).
- Secrets are read only as `secrets.NAME`, only these four: `DATABASE_URL_DIRECT`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `BACKUP_PASSPHRASE`.
- No address, host or key is written in the file. Nothing prints the environment or traces commands (`set -x`); a message may name a secret but never reads its value.
- In the backup job the address and the passphrase are given only to the steps that use them, never to the upload step.
- Every action is pinned to a version, every job has a time limit.
- The jobs use Neon's **direct** address (a short single connection; the pooler is for the API's many short requests, and `pg_dump` must not go through it).

## Not in scope

- No change to the app, the schema or the 10 tables. No new Python code: the two jobs already existed.
- No restore from the artifact is automated. The monthly restore test of `scripts/test-backup-restore.sh` stays the owner's routine.
- Nothing in Render, Netlify, Neon or Paystack is changed.

## Decisions

| ID | Decision |
| --- | --- |
| J1 | The artifact is public in a public repository, so the dump is encrypted before the upload. **Decided by the owner 2026-10-28: keep the encrypted backups in the public repository.** A leaked passphrase would open every dump still kept (see above). |
| J2 | NFR-09 asks to keep backups 30 days. The owner first said 7, then **decided on 30 on 2026-10-28** to match NFR-09: `retention-days: 30` in `nightly-backup.yml`. GitHub also has a repository-wide cap on how long artifacts are kept (Settings, Actions, General); if it is below 30, the shorter value wins, so check it. The 30-day pruning in `backup-db.sh` has nothing to prune on a fresh runner. |
| J3 | Two workflow files, not three: the re-check and the clean-up are small, run at the same time and need the same install, so they share a file; the backup needs a different client program and a different secret set. |
| J4 | The runner installs the `pg_dump` of the Neon server's major version from the PostgreSQL project's apt repository, read from `SHOW server_version_num`. A fixed number would break the day Neon upgrades. |
| J5 | The e-mail secrets are optional: with either one empty the re-check job still moves the listings and logs a warning; the editors just get no e-mail. |
