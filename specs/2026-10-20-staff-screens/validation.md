# Staff screens and "List your facility" (Phase 10): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## How to run
- Backend: `docker compose exec backend pytest -q -W error` and `ruff check .`
- Frontend: `cd frontend && npm run lint && npm run typecheck && npm test`; real browser: `npx playwright test staff facility`

## Results
Written at the end of the feature.

## Security and privacy checklist
- [ ] Every staff endpoint loads the user from the database and checks role and `is_active` from that row (no role in the token)
- [ ] A verifier cannot publish, hide, reopen, edit another verifier's draft or open the staff list of users
- [ ] A provider has no access to any staff endpoint of this phase
- [ ] A facility submission's contact details are in no public answer and not in the listing's `description`
- [ ] No password or hash in any answer, log line or audit entry
- [ ] The session is in `sessionStorage` only; the token is in no address and no log
- [ ] The Cloudinary secret is never returned or logged; `photo_url` only from res.cloudinary.com
- [ ] Every listing change and move writes an audit entry

## Merge checklist
- [ ] Lint, typecheck, tests, build clean; numbers written above
- [ ] Both CIs green
- [ ] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] The owner checked the preview (the API part shows only after the merge and the Render redeploy)
- [ ] The pull request stays a draft until every box above is ticked.
