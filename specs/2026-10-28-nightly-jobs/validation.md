# Validation: nightly jobs and the daily Neon backup

Check every line before the pull request leaves draft.

## Done by me (2026-10-28)

- [x] `pytest tests/unit/test_github_workflows.py`: 22 passed (run in the backend container with the workflow folder copied in; in CI they run on the checkout).
- [x] `ruff check` on the new test file: clean.
- [x] Mutation check (security code): with `pull_request:` added, `retention-days: 90` and `path: backups/`, two tests failed as they must; reverted, 22 pass (then retention changed to 30, J2; the test follows, 22 pass).
- [x] The exact `gpg` encrypt and decrypt commands of the workflow were run on a fictional file with a throw-away passphrase: round trip works, the plain file is removed.
- [x] No secret, address or key is written in either workflow file (a test reads both files for `postgres://`, `neon.tech` and the shape of a Resend key).

## Not possible for me, so it is yours (after the merge)

I cannot run GitHub Actions from here, and a schedule starts only from `main`. These are untested until you do them:

- [ ] The four secrets are added (`gh secret list` shows `BACKUP_PASSPHRASE`, `DATABASE_URL_DIRECT`, and the two Resend ones if you use them).
- [ ] **Nightly jobs**, **Run workflow**: both jobs green; the log has the two result lines and no address or key.
- [ ] **Nightly backup**, **Run workflow**: green; the artifact `neon-backup-encrypted` exists and shows an expiry 30 days away. If it shows less, the repository-wide artifact retention (Settings, Actions, General) is lower than 30: raise it there.
      The step "Install the pg_dump of the same major version" is the one most likely to need a fix on the first run (the apt script of the PostgreSQL project, `-y` option).
- [ ] Download the artifact, decrypt it with the passphrase from your password manager, restore it into a new local database as in `runbook-backups.md`, compare the row counts, delete the plain file.
- [ ] Next morning: the scheduled runs of both workflows appear in the Actions tab (about 00:00 and 00:30 UTC).
- [x] Decision J1 taken by you on 2026-10-28: the encrypted backups stay in the public repository. Look at it again at launch, when the dumps hold real users' data.
