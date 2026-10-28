# Plan: nightly jobs and the daily Neon backup

Branch `chore/nightly-jobs`, one draft pull request. Requirements in [requirements.md](requirements.md).

- [x] **Tests first:** `backend/tests/unit/test_github_workflows.py` (22 tests): triggers, token permissions, the four secret names, nothing printed, pinned actions,
      time limits, the schedule times, direct address, the e-mail secrets only for the re-check, encrypted upload only, `retention-days: 30`, secrets only in the steps that need them.
- [x] `.github/workflows/nightly-jobs.yml`: `recheck` and `purge-signups` at 00:00 UTC.
- [x] `.github/workflows/nightly-backup.yml`: backup at 00:30 UTC, encrypted, 30 days.
- [x] `how-to-add-the-secrets.md` for the owner.
- [x] Docs once at the end: `LOG.md` (decisions J1 to J5, the open reminder), `runbook-backups.md` ("Not done on purpose" now points here).
- [ ] After the merge, by the owner: add the four secrets, run both workflows once with **Run workflow**, check the logs (see validation.md). Tick with the commit hash at the end of the feature.
