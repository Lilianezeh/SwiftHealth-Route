# Plan: owner fee (approved 2026-10-29; built on `feature/owner-fee`, draft pull request)

Requirements: [requirements.md](requirements.md). Contracts: `api-spec.md` section 8 "Owner fee", `ui-spec.md` 4.2c, PRD FR-59 to FR-64.

## Before any code
- [x] Owner answered Q1 to Q10 (all as recommended) and said yes (2026-10-29).
- [ ] **Lawyer reviews L1 to L8 (the texts).** Not done: no page wording about the fee is changed (Terms, "For facilities", home, "List your facility" still say "free during our launch").
- [x] `prd.md` (FR-59 to FR-64), `api-spec.md` and `ui-spec.md` updated first, then the code.

## Phase 1: schema and settings
- [x] Tests first: `test_owner_fee_migration.py` (10 tables, column nullable with time zone, only approved links get a free month, safe to run twice, downgrade), settings cases in `test_owner_fee_rules.py`.
- [x] `models/facility_owner.py` (`paid_until`), `models/base.py` (`LinkStatus`), `core/config.py` (3 settings), `core/months.py`, Alembic `d3e5f7a9b1c2_owner_fee_paid_until.py`.

## Phase 2: paying
- [x] Tests first: `test_owner_fee_payment.py` (start, amount from the setting, signed webhook once, early/late/lapsed/ending/removed, status, receipt, list).
- [x] `services/owner_fee_service.py`, `owner_fee_mail.py`, `api/routes/payments.py`, `providers.py`, `schemas/payment.py`, repositories (access rule `_link_may_manage`), registration and claim now `awaiting_payment`.

## Phase 3: lapse, renewal, cancel
- [x] Tests first: `test_owner_fee_access.py`, `test_owner_fee_job.py`, `test_owner_fee_cancel_refund.py` (cancel part).
- [x] `jobs/owner_fee.py`, `services/owner_fee_upkeep_service.py`, `.github/workflows/nightly-jobs.yml` (job `owner-fee`).

## Phase 4: refunds and receipts
- [x] Tests first: `test_paystack_refund.py`, `test_owner_fee_cancel_refund.py` (reject, pending refund, withdraw), `test_owner_fee_job.py` (retry).
- [x] `integrations/paystack.py` (`create_refund`), `owner_link_service.reject`, receipts by email and `GET /provider/payments`.

## Phase 5: screens (functional; the legal wording waits)
- [x] Tests first: `OwnerFee.test.tsx` (19), changes to the `ListYourFacility`, `OwnerRequests` and `MyFacilities` tests and to the e2e spec text.
- [x] `PayOwnerFee`, `FeeComplete` (+ page `/provider/fee-complete`), `MyFacilities`, `MyPayments`, register/claim success, `OwnerRequests` refund words.
- [ ] Playwright at 360 and 1280 px, Light and Dark, Lighthouse accessibility on the changed pages: **not run** (memory); see validation.md.

## Not in scope
Live payments, real money, tax handling, a Paystack subscription, bundles with Featured, charging staff, new page wording about the fee (lawyer first), cleaning up draft listings of requests that are never paid.
