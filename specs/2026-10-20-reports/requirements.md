# Reports (Phase 9): requirements

What `POST /reports` and the report form must do, and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it is
done is in [validation.md](validation.md). Branch: `feature/reports`, stacked on `feature/swiftrescue` (PR #25) in the unattended run of
2026-10-17. Every decision I had to make alone is in "Assumed owner decisions".

## Requirements

[prd.md](../prd.md): **US-08** (report a wrong number or a closed facility in under 3 taps, no account), **FR-20** (every listing and contact has a
"Report a problem" link), **FR-21** (reasons: number not working, wrong number, facility closed, moved, wrong hours, other, with an optional comment and
an optional phone number), **FR-22** (2 different reporters saying "not working" within 7 days flag the listing for an urgent re-check), **NFR-06**
(rate limiting on the report form), **NFR-07** (reporter phone optional; the IP is never stored, only a keyed hash), **NFR-10**, **FR-38** (audit entry).

Source of truth: [api-spec.md](../backend/api-spec.md) ("POST /reports") and [ui-spec.md](../frontend/ui-spec.md) (2.8). Fit with the project:
[mission.md](../mission.md) (the directory stays trustworthy), [tech-stack.md](../tech-stack.md) unchanged. No new table, no new package.

## In scope

- **9a:** `POST /reports` (validation, rate limit 5 per IP per hour, the keyed `reporter_key`) and the form at `/report/<slug>`.
- **9b:** the automatic flag: the second `not_working` report from a different reporter inside 7 days moves a published listing to `recheck_due`,
  writes an audit entry and tells the staff (email to editors through Resend, SMS to admins through Termii; with no key, logged only).
- The "Report a problem" link on every emergency contact card (FR-20).

## Out of scope

- The staff queue to resolve or dismiss reports and the deletion of the reporter phone on resolve: phase 11 (FR-35).
- The nightly re-check job: phase 11 (FR-33, FR-36).

## Decisions with the spec (no owner choice needed)

1. A report is accepted only for a **published** listing (else 404, the same answer as an unknown id), so nothing leaks about drafts.
2. `reporter_key` is `hash_reporter_key(+234 phone)` when a phone is given, else `hash_reporter_key(client IP)`; the raw IP is never stored or logged.
3. The same reporter reporting twice counts once (different `reporter_key` values are counted).
4. The messages to staff hold the listing name and the count only: never the comment, the reporter phone or anything about the reporter.

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| B1 | The report page is **`/report/<slug>`**, not `/report/<id>` (the ui-spec said `[id]`, but the page reads the listing by slug and the listing page links by slug-based data). The old link `/report/12` is replaced. | Keep the numeric id |
| B2 | A phone given with a report is **normalised to +234…** and stored; a phone that is not a Nigerian number is a **422** ("Check the phone number"), not silently dropped. | Store it as typed |
| B3 | **Comment** at most 500 characters. | No limit / 1000 |
| B4 | The rate limit is **per IP, in memory** (like login), 5 per hour, answer 429; it resets when the server restarts. | A database counter |
| B5 | The flag sets `recheck_due` **and `next_check_due` to now**, so the re-check queue (phase 11) shows it first; the audit entry has no user, action `flag`, field `status`, reference `auto-flag`. | Only the status |
| B6 | Staff alerts are **best effort** in the background: if the email or SMS fails, the report is still saved and the failure is logged without any personal data. Who is told: every active editor and admin with an email (Resend) and every active admin with a phone (Termii). Resend's `from` address comes from a new setting `RESEND_FROM_EMAIL`; **with no `RESEND_API_KEY` or no from-address nothing is sent** (logged). I wrote the Resend call from its documented `POST https://api.resend.com/emails` (fields `from`, `to`, `subject`, `text`); I could not test it against the real service. | Synchronous sends |
| B7 | The "Report a problem" link is on the **listing page and on every SwiftRescue contact card**, not on the search cards (they are crowded; the card links to the listing page). | Also on search cards |
| B8 | The reasons are worded **"Number not working", "Wrong number", "Facility closed", "Facility moved", "Wrong opening hours", "Something else"**. | Other wording |

## What the owner should check on a phone

Open a listing, tap "Report a problem with this listing", pick a reason, tap Send: you should see "Thank you. We'll check this listing." and a link back. Try the
phone field with a bad number. (Production needs this PR merged and redeployed for the API part; the Resend and Termii keys are not set, so no email or SMS is sent.)
