# Reports queue, re-checks and dashboard (Phase 11): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results
Written at the end of the feature.

## Security and privacy checklist
- [ ] Only an editor or an admin can read or close reports and read the dashboard (403 for a verifier and a provider, 401 without a token); the role comes from the database
- [ ] A resolved or dismissed report has no `reporter_phone` and no `reporter_key` (NFR-07); an open report shows the phone masked
- [ ] No audit entry, email or log holds a reporter's phone or comment
- [ ] Every change (a report closed, a listing moved by the job) writes an audit entry (FR-38)

## Merge checklist
- [ ] Lint, typecheck, tests clean; numbers written above
- [ ] Both CIs green
- [ ] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] **The owner decided how the nightly job is run** (H4)
- [ ] The pull request stays a draft until every box above is ticked.
