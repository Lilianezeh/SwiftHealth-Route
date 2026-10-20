# Release checklist (roadmap 14d)

Every release criterion of [prd.md](../prd.md#release-criteria), its status and its evidence, then the owner's actions in the order to do them.
Written 2026-10-20 at the end of phase 14 of the unattended run; the rows for phases 8, 11 and 12 are updated when those phases are built (the
last commit of the run). "Done" means built and tested here; nothing below is switched on in production.

## The release criteria

| # | Criterion (PRD) | Status | Evidence or what is missing |
| --- | --- | --- | --- |
| 1 | All Must requirements pass testing on a low-cost Android phone on 3G | **Open (owner)** | Unit, real-browser (320 to 1024 px) and build checks pass in every phase; none was run on a real low-cost phone on 3G. See "Must requirements by phase" below for what is built. |
| 2 | Every facility in the pilot area is verified and published, at least [__] listings | **Open (team)** | The tools exist: the staff screens (PR #27) and the CSV import (this PR). The number and the data are the team's work. Production has only 4 demo listings. |
| 3 | Every emergency contact verified within the last 14 days | **Open (team)** | The 14-day cycle is in the code (FR-33); production has no emergency contacts yet. Verify them with the staff screens. |
| 4 | 112 tested and shown on the Emergency page | **Done** (real call tested by the owner on a phone on 2026-10-13, PR #21 notes; the full page is PR #25) | `tel:112` is the first thing on `/emergency`, in the page's own HTML, offline too (unit and real-browser tests). |
| 5 | Privacy policy, terms and disclaimers reviewed by a lawyer | **Open (owner)** | Draft statements are in PR #28 with a visible "not yet reviewed" notice; the disclaimer sentences of FR-13 and FR-26 are on every listing and on SwiftRescue. |
| 6 | Medical advisor has reviewed all health wording | **Open (owner)** | The only health wording is the disclaimer sentences and, in phase 8, the donor guidance, which I left out (see the phase 8 requirements). |
| 7 | Backups and restore tested | **Partly done** | The restore was tested on 2026-10-20 (all 9 tables, `pg_trgm`): `runbook-backups.md`. Production has **no backups today** (free database): upgrade it, see the owner's actions. |
| 8 | At least [__] residents have tested the site and their feedback is handled | **Open (owner)** | The owner's phone checks of each preview are recorded in `LOG.md`. |

## Must requirements by phase (what is built)

| Phase | Requirements | Where |
| --- | --- | --- |
| 5 to 6 | FR-01 to FR-11, FR-13, FR-22 (search, listing page), US-01 to US-03, US-05 to US-07, FR-47 | merged (PRs #7 to #23) |
| 7 SwiftRescue | US-04, US-09, US-14, FR-14 to FR-19, FR-24 to FR-26, NFR-03 | PR #25 |
| 9 Reports | US-08, FR-20 to FR-22 | PR #26 |
| 10 Staff and List your facility | US-10, FR-30 to FR-32, FR-36 (failed check), FR-37, FR-38, FR-41, FR-42 | PR #27 |
| 13 Information pages | FR-23, NFR-12 | PR #28 |
| 14 Launch readiness | FR-39, FR-40 (Should), NFR-09 (tested restore) | this PR |
| 8 Blood | US-15, US-16, FR-27 to FR-29 (FR-29 guidance text waits for the medical advisor) | PR of branch `feature/blood` |
| 11 Reports queue and dashboard | US-11, US-12, FR-33 (nightly job), FR-34, FR-35, FR-36 (nightly hide); "assign" of FR-35 not built (H1); the nightly job has no schedule yet (H4) | PR of branch `feature/reports-queue-dashboard` |
| 12 Providers and featured | FR-43 to FR-46, FR-19 (test mode only; a live key is refused) | PR of branch `feature/providers-payments` |

## The owner's actions, in order

Each is outside the code. **I changed none of them.**

1. **Merge the pull requests in the order of the table in `LOG.md`**, changing the base of the next one to `main` after each merge.
2. **Render, by hand** (the Blueprint is on manual sync): `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (staff alerts), `CLOUDINARY_URL` and `CLOUDINARY_UPLOAD_PRESET`
   (photos; create the upload preset in Cloudinary: images only, at most 5 MB), the Termii variables (`TERMII_API_KEY`, `TERMII_BASE_URL`, `TERMII_SENDER_ID`,
   `TERMII_CHANNEL`) after the DND route is activated and the sender ID approved, and later the Paystack keys (phase 12).
3. **Create the first admin.** A new production database has no users. Run `python -m app.bootstrap_admin` with the four `BOOTSTRAP_ADMIN_*` variables set
   (name, email, phone that can receive SMS, a password of at least 10 characters). On a machine with Docker: `docker compose run --rm -e DATABASE_URL=<the production
   address> -e BOOTSTRAP_ADMIN_NAME=... backend python -m app.bootstrap_admin`. Then log in at `/admin/login` and add the rest in `/admin/staff`.
4. **Upgrade the Render database** before real data goes in (comparison in `LOG.md`), and check that Render keeps backups; run `scripts/test-backup-restore.sh` monthly.
5. **Add the real emergency contacts and facilities** (staff screens and the CSV import: `/admin/import-export`), verify them, publish them.
6. **The demo cleanup**, once real listings exist: set `REMOVE_DEMO_LISTINGS=true` in Render (it is in the dashboard as `false`), redeploy, confirm
   `/search?q=DEMO` returns `total` 0, then set it back to `false` ([decision 13](../2026-10-09-search-backend/requirements.md)).
7. **Lawyer and medical advisor** review Privacy, Terms and any health wording; give the contact address (`contactEmail` in `frontend/src/config/site.ts`).
8. **Decide the analytics** (`analytics-proposal.md`) and read the WhatsApp and Magnific terms (`LOG.md`, "Pre-launch checklist").
9. **Test on a real low-cost phone on 3G**, with real residents, and record the result.
