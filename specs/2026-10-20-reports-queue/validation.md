# Reports queue, re-checks and dashboard (Phase 11): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results (2026-10-20, branch `feature/reports-queue-dashboard`)

- Backend: `pytest -q -W error` **1239 passed**; `ruff check .` clean. New: `test_report_queue.py` (19), `test_dashboard.py`, `test_recheck_job.py` (8).
- Frontend: `vitest` **1395 passed** (102 files); `tsc --noEmit` and `next lint` clean. New: `ReportsQueue` (22), `Rechecks`, `Dashboard`, `queueApi`, date helpers.
- Real browser at 320, 360, 768 and 1024 px: `queue.spec.ts` **16 passed** (the chart really draws, the bars use the design token colour, Resolve sends
  the PATCH with the token, a verifier is refused); the staff and import-export specs still pass (35 of 36 on the first run, the one failure was the
  first page compile and passed again on its own).
- The job `python -m app.jobs.recheck` was tested through the code path with a recorded email; it was **not** run against the development database, and no
  schedule exists (H4).
- A second pytest on the same test database fails the first: run the backend suite alone.

## Security and privacy checklist
- [x] Only an editor or an admin can read or close reports and read the dashboard (403 for a verifier and a provider, 401 without a token); the role comes from the database
- [x] A resolved or dismissed report has no `reporter_phone` and no `reporter_key` (NFR-07); an open report shows the phone masked
- [x] No audit entry, email or log holds a reporter's phone or comment (tests read the audit entry and the email body)
- [x] Every change (a report closed, a listing moved by the job) writes an audit entry (FR-38)

## Merge checklist
- [x] Lint, typecheck, tests clean; numbers written above
- [ ] Both CIs green (check on the pull request)
- [x] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] **The owner decided how the nightly job is run** (H4)
- [ ] The pull request stays a draft until every box above is ticked.
