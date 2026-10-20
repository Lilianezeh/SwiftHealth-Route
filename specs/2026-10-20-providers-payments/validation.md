# Providers and featured listings (Phase 12): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results (2026-10-20, branch `feature/providers-payments`)

- Backend: `pytest -q -W error` **1376 passed**; `ruff check .` clean. New: `test_provider_listing.py` (27), `test_payments_featured.py`, `test_payments_webhook.py`
  (47, among them two webhooks for one reference at the same moment applying once), `test_search_sponsored.py` (20), `test_paystack.py` (18).
- Frontend: `vitest` **1442 passed** (104 files); `tsc --noEmit` and `next lint` clean. New: `ProviderScreens` (45), `SponsoredLabel`.
- Real browser at 320, 360, 768 and 1024 px: `provider.spec.ts` **28 passed** (every provider screen fits, Save sends only the change with the token,
  a refusal from the payment call is shown in words, an address that is not https is never followed, the pending-then-confirmed flow, a staff role is
  refused, the search shows one Sponsored result first). Paystack was **never called**: the browser checks use a fake API, the backend tests a mock transport.
- A running pytest and a second one on the same test database fail each other: run the backend suite alone.

## Security and privacy checklist
- [x] A provider reads and edits only their own listing; every other role or listing is 403 or 404 (FR-43, NFR-06); the role comes from the database
- [x] A bad or missing webhook signature changes nothing (401); a repeated webhook applies once (FR-46), also when two arrive together (advisory lock)
- [x] Money is a Decimal, sent as a string in JSON, and converted to kobo only for Paystack (`int(price * 100)`)
- [x] A live Paystack key is refused (503, before any call) and a webhook is not accepted with one; the secret key, the body of a webhook and the customer email are never logged or returned (a test reads the log)
- [x] Nothing is sponsored in SwiftRescue, the blood pages or the listing page (FR-19, FR-45); at most one sponsored item in a search; never an emergency category

## Merge checklist
- [x] Lint, typecheck, tests clean; numbers written above
- [ ] Both CIs green (check on the pull request)
- [x] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] **The owner checked the Paystack calls once against the Paystack test dashboard** (they were tested with a mock transport only)
- [ ] The pull request stays a draft until every box above is ticked.
