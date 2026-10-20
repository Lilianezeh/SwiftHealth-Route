# Reports (Phase 9): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## How to run
- Backend: `docker compose exec backend pytest -q -W error` and `ruff check .`
- Frontend: `cd frontend && npm run lint && npm run typecheck && npm test`; real browser: `npx playwright test reports` (see the memory note of this machine in `LOG.md`: the browser needs three libraries from `apt-get download`)

## Results (2026-10-20)
- Backend: **867 passed** with `-W error`, `ruff check` clean. New: `tests/unit/test_phone.py` (15), `tests/unit/test_staff_alert_service.py` (10), `tests/integration/test_reports.py` (23).
- Frontend: lint and typecheck clean; **1026 unit tests passed** (new: `ReportPage` 17, the contact-card link, the slug link; `request.test.ts` still green after the POST option).
- Build: `/report/[slug]` is **3.42 kB own, 110 kB first load**; `/emergency` 116 kB.
- Real browser, 320, 360, 768 and 1024 px: **9 of 9 passed** (open from the listing page, no sideways scroll, radio rows and the button at least 48 px, text 16 px or more, two taps to send with the API call answered by the test, the 429 message keeps the form, an unknown listing shows the not-found page).
- Not checked by me: a real email or SMS (no Resend or Termii key exists here, so nothing was sent and the Resend call is untested against the real service), a real phone.
- Found on the way: the Playwright check first took a radio caption for a tap target (fixed in the check); the listing page and the home-performance guard still named `/report/[id]` (both updated to the slug).

## Tests per task
- Task 1 (`d34604c`, with 2 and 3): `test_phone` (every usual way of writing a number; anything else is not a number), the rate-limit test inside `test_reports`.
- Task 2 (`d34604c`), `test_reports`: 201 and the thank-you; optional fields and blank means none; the key is a keyed hash, never the raw phone or IP; unpublished and unknown are the same 404; bad reason, long comment, bad phone are 422 and nothing is stored; 500 characters accepted; the first report flags nothing; the second from a different reporter flags (status, `next_check_due`, the audit entry, the alert); the same reporter counts once, also with the same phone from two networks; other reasons, old and resolved reports do not count; a report 6 days 23 hours old counts; flagged only once; the sixth report in an hour is 429; an ordinary report changes nothing on the listing.
- Task 3 (`d34604c`), `test_staff_alert_service`: texts hold the name only; editors get email and admins SMS; a failed email or SMS stops nothing and logs no address or number; Resend: nothing without a key or sender, the documented fields and bearer header, errors hold no key or address, network failures too.
- Task 4 (`8f15969`): `ReportPage`. Task 5 (`8f15969`, `reports.spec.ts`).

## Security and privacy checklist
- [x] The raw IP is never stored, returned or logged; only the keyed hash is stored (test)
- [x] The comment and the reporter phone are never in a staff alert, a log line or an audit entry (tests)
- [x] A report for an unpublished listing is a 404, the same as an unknown id (test)
- [x] The rate limit answers 429 on the 6th report in an hour from one IP (test)
- [x] No Resend or Termii call is made without a key (tests use a mock transport; the integrations return early)
- [x] The form reads no position and stores nothing (unit test on the source)

## Merge checklist
- [x] Lint, typecheck, tests, build clean; numbers written above
- [ ] Both CIs green (checked after the pull request is opened)
- [x] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] The owner checked the preview (the API part shows only after the merge and the Render redeploy)
- [ ] The pull request stays a draft until every box above is ticked.
