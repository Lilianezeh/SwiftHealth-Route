# Providers and featured listings (Phase 12): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results
Written at the end of the feature.

## Security and privacy checklist
- [ ] A provider reads and edits only their own listing; every other role or listing is 403 or 404 (FR-43, NFR-06); the role comes from the database
- [ ] A bad or missing webhook signature changes nothing (401); a repeated webhook applies once (FR-46)
- [ ] Money is a Decimal, sent as a string in JSON, and converted to kobo only for Paystack (`int(price * 100)`)
- [ ] A live Paystack key is refused; the secret key, the body of a webhook and the customer email are never logged or returned
- [ ] Nothing is sponsored in SwiftRescue, the blood pages or the listing page (FR-19, FR-45); at most one sponsored item in a search

## Merge checklist
- [ ] Lint, typecheck, tests, build clean; numbers written above
- [ ] Both CIs green
- [ ] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] **The owner checked the Paystack calls once against the Paystack test dashboard** (they were tested with a mock transport only)
- [ ] The pull request stays a draft until every box above is ticked.
