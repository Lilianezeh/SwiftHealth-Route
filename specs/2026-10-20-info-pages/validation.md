# Information pages and polish (Phase 13): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## How to run
- `cd frontend && npm run lint && npm run typecheck && npm test`; the build `npm run build`; real browser `npx playwright test info-pages`

## Results
Written at the end of the feature.

## Security and privacy checklist
- [ ] No page makes up a legal claim, a contact address or a phone number
- [ ] Every statement on Privacy matches the code (what is stored, where, and for how long)
- [ ] No outside link without `rel="noopener noreferrer"`; no script on the five pages
- [ ] The staff pages are `noindex` and disallowed in `robots.txt`

## Merge checklist
- [ ] Lint, typecheck, tests, build clean; numbers written above
- [ ] Both CIs green
- [ ] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] **The owner read Privacy and Terms and decided who reviews them; the owner gave a contact address (or accepted the placeholder)**
- [ ] The pull request stays a draft until every box above is ticked.
