# Validation: owner fee

Check every line before the pull request leaves draft. Paystack **test mode only**: nothing here moves real money.

## Done by me (2026-10-29)

- [x] Still exactly 10 tables; `paid_until` migration tested (nullable, time zone, free first month for approved links only, safe to run twice, downgrade drops only the column). The Alembic revision runs at the next deploy.
- [x] A `sk_live_` key is refused (start, webhook signature, refund), no key gives 503, and the amount comes from `OWNER_FEE_NAIRA`, never from the request (an `amount` field is 422).
- [x] Only a signed webhook confirms a payment; a repeated webhook applies once; a short amount, a float, a wrong link, a Featured reference and a missing signature change nothing; every payment and refund is an audit entry with its reference.
- [x] The claim reaches staff only after the confirmed payment; a rejected claim is refunded in full and a refund that fails is kept as `refund_pending` and asked again by the nightly job.
- [x] A lapsed owner cannot edit, move, close, read the history or buy Featured; the listing stays public, free and unchanged; paying restores editing without staff. Staff and visitors are never charged.
- [x] Backend: ruff clean; full suite **2346 passed, 5 skipped**. New: `test_owner_fee_rules` (unit), `test_paystack_refund`, `test_owner_fee_{migration,access,payment,cancel_refund,job}`, workflow tests for the new job.
- [x] Mutation check (payment and access code): with the amount rule removed, and with "no paid date" allowed to edit, 3 tests failed as they must; reverted.
- [x] Frontend: `tsc` and `eslint` clean; `OwnerFee.test.tsx` (19 tests) and the changed `ListYourFacility`, `OwnerRequests`, `MyFacilities` tests pass (84 together), and `ProviderScreens` and `StaffGate` (64) pass.
- [x] **Whole frontend unit suite (2026-11-01, run alone): 2254 tests, all pass** (one real failure found and fixed: the list of the site's page addresses did not know `/provider/fee-complete`).
- [x] **Playwright, one spec at a time with nothing else running (2026-11-01): `provider.spec.ts` 28 of 28, `facility.spec.ts` 20 of 20, `admin-accounts.spec.ts` 6 of 6** (320, 360, 768 and 1024 px; Light mode). Two real failures found and fixed in the test helper `tests/helpers/browserApi.ts`: (1) the idle sign-out of #80 renews the token with `POST /auth/keep-alive`, which the fake API did not answer, so the real API said 401 to the fake token and the page signed the person out in the middle of a check (the helper now answers it); (2) the new "My payments" list calls `GET /provider/payments`, also unanswered (added to the side calls). No product code was wrong. Other specs that log in with a fake token (`staff`, `queue`, `reports`, `import-export`, `emergency-contacts`, `signup`) use the same helper and were not re-run.

## Not done by me (yours, or needs a browser)

- [ ] **Lawyer's answer to L1 to L8**, then the wording of the Terms, Privacy, "For facilities", the home page and "List your facility" (they still say "Listing is free during our launch"). FR-64.
- [ ] Add the repository secret **`PAYSTACK_SECRET_KEY`** (a Paystack **test** key `sk_test_...`) for the nightly job, as in `specs/2026-10-28-nightly-jobs/how-to-add-the-secrets.md`. Optional: without it only the retry of a failed refund waits.
- [ ] On Render: `PAYSTACK_SECRET_KEY` (test key) must be set for the API and the Paystack **test** dashboard webhook must point to `<Render address>/payments/webhook` (already needed for Featured). Check `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set, or no receipt or reminder email is sent. Optionally set `OWNER_FEE_NAIRA`, `OWNER_FEE_GRACE_DAYS`, `OWNER_FEE_REMINDER_DAYS`.
- [ ] Try it with a Paystack **test card** end to end: register a facility as a provider → Pay → the page `/provider/fee-complete` says confirmed → the request appears in Owner requests → approve → edit works. Then: reject a second paid request and look at the refund in the Paystack test dashboard (the Create Refund call is read from Paystack's documentation and **not tested against the real service**).
- [ ] After the merge: press "Run workflow" on **Nightly jobs** and check the `owner-fee` job prints one line and no address.
- [ ] Dark mode and Lighthouse accessibility on `/provider`, `/provider/fee-complete` and `/list-your-facility` (not run), and a Playwright check of `/provider/fee-complete` and of the pay button's redirect (the unit tests cover them; no spec drives them in a real browser).

## Known limits

- A request never paid within 14 days is ended and its draft closed as "unpaid" by the nightly job (never deleted, never shown to staff in lists, numbers or the export; the activity log still holds its entries).
- Reminders are counted in whole UTC days and sent by the nightly job (a missed night skips that day's reminder; the grace period still protects the owner).
- Q6: each person who edits pays their own fee (no shared fee per facility).
