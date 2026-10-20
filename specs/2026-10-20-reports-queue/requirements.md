# Reports queue, re-checks and dashboard (Phase 11): requirements

The staff side of problem reports and of the re-check cycle: the report queue, the nightly re-check job, the dashboard numbers, and three screens. How we build it
is in [plan.md](plan.md); how we know it is done is in [validation.md](validation.md). Branch: `feature/reports-queue-dashboard`, stacked on `feature/blood`
(PR #31) in the unattended run of 2026-10-17.

## Requirements

[prd.md](../prd.md): **US-11** (an editor sees the listings due for a re-check), **US-12** (an editor reviews and resolves reports; resolving logs who and when),
**FR-33** (the re-check cycle: 14 days for emergency contacts, 45 for the rest; the cycle itself is `categories.recheck_days`, already used when a listing is published),
**FR-34** (the dashboard), **FR-35** (the report queue, urgent first), **FR-36** (a published listing that is overdue goes to `recheck_due` and the editors are told),
**FR-38** (an audit entry for every change), **NFR-06**, **NFR-07** (a resolved report keeps no phone number: NDPA 2023), **NFR-10**.
Source of truth: [api-spec.md](../backend/api-spec.md) (sections 6, 10, 12 and the phase 11 rules) and [ui-spec.md](../frontend/ui-spec.md) (3.2, 3.6, 3.7).
No new table, no new package (Recharts is already in the stack).

## In scope

- **11a:** `GET /reports` and `PATCH /reports/{id}`; the screen `/admin/reports`.
- **11b:** the job `python -m app.jobs.recheck`; `GET /dashboard/stats`; the dashboard at `/admin`; the screen `/admin/recheck` (uses `GET /listings?due=`, which exists).
- The staff bar gets the links Dashboard, Reports and Re-checks for the editor and admin.

## Out of scope

- **Running the job every night.** A Render Cron Job is a paid service, so I did not create one (see H4). The command exists, is tested and is safe to run by hand or from any scheduler.
- Assigning a report to a person (see H1). Charts other than checks per day.
- Any change to Render or Netlify settings.

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| H1 | **"Assign" (FR-35) is not built.** `user_reports` has no column for it and the nine-table design is fixed; I will not add a column without your word. A report is open, then resolved or dismissed, and the page records who and when (`resolved_by`, `resolved_at`). | Add a nullable `assigned_to` column in a migration |
| H2 | **A report is urgent** when its reason is `not_working` and its listing is currently `recheck_due` (the state the two-reporter flag of FR-22 puts it in). Urgent reports come first, then newest first. A listing that the nightly job moved to `recheck_due` with a single "not working" report is also marked urgent; I judged that right (it is hidden and reported). | Mark urgent only when two reporters flagged it (needs a lookup of the audit entries) |
| H3 | **The queue shows a small listing reference** (`id`, `slug`, `name`, `area`, `status`), not a full `ListingSummary`: a report of a `recheck_due` listing must still show, and the full summary is built for public listings. `reporter_phone` is shown masked (`+234******0000`) while the report is open. | The full summary |
| H4 | **The nightly job exists but no schedule is created.** Render Cron Jobs are paid. Run `docker compose exec backend python -m app.jobs.recheck` (or the same command in a Render shell, or a free GitHub Actions schedule with the database address as a secret: your decision) every night at about 01:00 Lagos time. Running it twice does nothing the second time. | A Render Cron Job (about the price of the smallest plan: confirm on render.com/pricing) |
| H5 | **What the job does:** every `published` listing whose `next_check_due` is in the past becomes `recheck_due`, with an audit entry (no user, action `recheck`, `status` published to recheck_due, reference `nightly-recheck`); then one email to every active editor and admin with the **count and the names** of the listings (names only), and an SMS to nobody. With no Resend key nothing is sent. A failed email never undoes the move. It prints one line: how many listings moved. | A separate email per listing |
| H6 | **Dashboard numbers.** `listings_by_status` lists all five statuses (0 when none). `overdue_rechecks` and `rechecks_due_this_week` count only `published` and `recheck_due` listings with a `next_check_due` (this week means from now to now plus 7 days), and the list `GET /listings?due=` now counts the same ones, so a number on the dashboard always equals the length of its list (a hidden or draft listing is no re-check job). `open_reports` and `urgent_reports` count open reports (urgent as in H2). `checks_last_30_days` has **one entry for each of the last 30 days** (Lagos dates, oldest first, zero when none), so the chart has no gaps. `featured_active` counts listings whose `featured_until` is in the future. | Only the days that have checks |
| H7 | **Resolve or dismiss** is allowed once: a report that is already resolved or dismissed answers 400 ("This report is already closed."). Both delete `reporter_phone` and `reporter_key` and write an audit entry (action `report_resolve` or `report_dismiss`, the listing, `status` open to the new value, reference `report-<id>`). The audit entry never holds the phone or the comment. | Allow reopening |
| H8 | **The screens.** The dashboard is for the editor and the admin (a verifier still starts at their own drafts and a provider at `/provider`). The stat cards are links to the queue they count. The chart is Recharts (a bar chart, passed and failed per day) with a table of the same numbers under it as text for a screen reader. Dates and times are shown in Lagos time. The Privacy page sentence about deleting phone numbers when a report is resolved is true from this phase on. | A chart only |

## Not in this phase

- A provider's listing and payments (phase 12), the analytics table (needs your approval: see `specs/2026-10-20-launch-readiness/analytics-proposal.md`).
