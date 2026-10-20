# Reports (Phase 9): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## How to run
- Backend: `docker compose exec backend pytest -q -W error` and `ruff check .`
- Frontend: `cd frontend && npm run lint && npm run typecheck && npm test`; real browser: `npx playwright test reports` (see `reference` notes in `LOG.md`)

## Results
Written at the end of the feature.

## Security and privacy checklist
- [ ] The raw IP is never stored, returned or logged; only the keyed hash is stored (NFR-07)
- [ ] The comment and the reporter phone are never in a staff alert, a log line or an audit entry
- [ ] A report for an unpublished listing is a 404, the same as an unknown id
- [ ] The rate limit answers 429 on the 6th report in an hour from one IP
- [ ] No Resend or Termii call is made without a key (tests use a mock transport)

## Merge checklist
- [ ] Lint, typecheck, tests, build clean; numbers written above
- [ ] Both CIs green
- [ ] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] The owner checked the preview
- [ ] The pull request stays a draft until every box above is ticked.
