# How to add the repository secrets, test the schedules, and read a backup

For the owner. Nothing here asks you to show me a value, and I never see one. Only you paste the values.

## The secrets to add: four

| Name | What it is | Where the value comes from | Needed by |
| --- | --- | --- | --- |
| `DATABASE_URL_DIRECT` | Neon's **direct** connection address (the host **without** `-pooler`) | The same value you already set as `DATABASE_URL_DIRECT` on Render. Neon dashboard, your project, Connect, turn **Connection pooling off**, copy. | all three jobs |
| `BACKUP_PASSPHRASE` | The password that encrypts every backup | **You make it** (below) and keep a copy in your password manager. | the backup |
| `RESEND_API_KEY` | The Resend key for the re-check summary e-mail | The same key as on the Render API service (Resend dashboard, API Keys). | the re-check, optional |
| `RESEND_FROM_EMAIL` | The sender address on a domain verified in Resend | The same value as on the Render API service. | the re-check, optional |

If you leave the two Resend secrets out, the re-check still hides the overdue listings every night; only the summary e-mail to editors and admins is not sent.
Do not add `DATABASE_URL`, a JWT secret or anything else: the workflows read exactly these four names and the tests fail if they read another.

## Make the backup passphrase

On your machine (it prints once; copy it straight into your password manager, then close the terminal):

```
openssl rand -base64 32
```

**If you lose this passphrase, every backup is unreadable.** Do not put it in the repository, in chat or in an e-mail.

## Add a secret: the web page (easiest)

1. Open the repository on GitHub, then **Settings**, then **Secrets and variables**, then **Actions**.
   Direct link: <https://github.com/Lilianezeh/SwiftHealth-Route/settings/secrets/actions>
2. Click **New repository secret**. (Not "environment secret", not "variable".)
3. **Name:** one of the four names above, exactly, in capitals. **Secret:** paste the value. Click **Add secret**.
4. Repeat for each name. GitHub never shows a value again; to change one, add it again with the same name.

## Or from the terminal with the GitHub CLI

`gh secret set NAME` asks for the value and does not show it, and nothing goes in your shell history (never put the value on the command line):

```
gh secret set DATABASE_URL_DIRECT
gh secret set BACKUP_PASSPHRASE
gh secret set RESEND_API_KEY
gh secret set RESEND_FROM_EMAIL
gh secret list
```

`gh secret list` shows the names and the dates, never the values. If `gh` says it lacks permission, use the web page.

## Test it after the pull request is merged

A schedule runs only from `main`, so nothing starts before the merge.

1. **Actions** tab, **Nightly backup** in the left list, **Run workflow**, branch `main`, **Run workflow**. About 2 to 4 minutes.
2. Open the run. All steps should be green, and an **Artifacts** section at the bottom lists `neon-backup-encrypted`.
3. Do the same for **Nightly jobs**. The log must show one line per job, like `0 listings moved to re-check due.` and the sign-up count line. The log must show **no address and no key**; if it does, tell me and rotate that secret.
4. The first backup run is the first real test of the step that installs `pg_dump`; if it fails there, copy me the failing step's message (it never holds a secret) and I fix it.

## Read a backup and restore it

1. **Actions**, the run, **Artifacts**, download `neon-backup-encrypted` (a zip with one `.dump.gpg` file).
2. Decrypt (it asks for the passphrase and does not show it):

   ```
   gpg --output swifthealth.dump --decrypt swifthealth-<date>.dump.gpg
   ```

3. Restore it as in `specs/2026-10-20-launch-readiness/runbook-backups.md` ("Restoring after a loss"), into a **new** database. Then delete `swifthealth.dump`:
   the plain file holds personal data.

## Things to know

- **Times are UTC.** 00:00 UTC is 01:00 in Lagos (no daylight saving time in Nigeria). GitHub can start a scheduled run several minutes late when it is busy.
- **Schedules switch themselves off after 60 days without any activity in a public repository** (GitHub's rule). A push or a pull request counts. If the backups stop, look at the Actions tab for a banner and press **Enable workflow**.
- **When a scheduled run fails**, GitHub e-mails the person who last changed the schedule (check **Settings, Notifications, Actions**). Look at the Actions tab now and then anyway.
- **The artifact is public in a public repository**: that is why it is encrypted (decision J1 in `requirements.md`, kept by your choice). Up to 30 days of encrypted backups sit there (decision J2), so the passphrase is what protects them. Rotate `BACKUP_PASSPHRASE` (add the secret again) if you ever think it leaked; backups already made keep the old passphrase.
- Public repositories have free Actions minutes. The three jobs use about 6 minutes a night. Each one wakes Neon's compute for a short time; the free plan's 100 compute-hours a month is not at risk.
- To stop everything: **Actions**, the workflow, the **...** menu, **Disable workflow**.
