# Plan: owner fee (NOT APPROVED: nothing here starts until the owner says "yes")

Requirements: [requirements.md](requirements.md). Branch for the work, when approved: `feature/owner-fee`, stacked drafts per phase.

## Before any code
- [ ] Owner answers Q1 to Q10 of requirements.md and says **yes**.
- [ ] Lawyer reviews L1 to L8 (the texts). The page wording changes only after that.
- [ ] Update `prd.md` (new FR rows), `api-spec.md` and `ui-spec.md` first, then the code (CLAUDE.md).

## Phase 1: schema and settings (needs Q8)
- Tests first: `facility_owners.paid_until`, statuses `awaiting_payment` and `lapsed`, settings `OWNER_FEE_NAIRA` (Decimal, 2 places), `OWNER_FEE_GRACE_DAYS`, `OWNER_FEE_REMINDER_DAYS`; Alembic migration reversible; still 10 tables.
- Files: `models/facility_owner.py`, `core/config.py`, `alembic/versions/...`, `repositories/facility_owner_repository.py`.

## Phase 2: paying (start, webhook, status)
- Tests first (Paystack mocked, TEST keys only): amount from the setting never from the request; kobo is `int(amount * 100)`; a live key is refused; only the owner of the link can start; the webhook with a wrong or missing signature changes nothing; a good one moves `awaiting_payment` to `pending` and sets `paid_until`; a repeated webhook applies once; an audit entry with the reference; the claim is invisible to staff before payment.
- Files: `services/owner_fee_service.py`, `repositories`, `api/routes/payments.py` (second reference shape in the existing webhook), `schemas/payments.py`, `integrations/paystack.py`.

## Phase 3: lapse, renewal, cancel
- Tests first: calendar-month arithmetic (31 Jan to 28/29 Feb, early payment loses nothing), reminders at 7/3/1 days (once each), grace 7 days then `lapsed`, a lapsed owner cannot edit and cannot buy Featured, the listing is unchanged, paying restores `approved` without staff, cancel keeps access to `paid_until`, grandfathering of existing links.
- Files: `jobs/owner_fee.py` (added to `.github/workflows/nightly-jobs.yml`), `services/owner_fee_service.py`, `services/access_service.py` (the edit check), `integrations/resend.py` use.

## Phase 4: refunds and receipts
- Tests first: staff reject refunds in full and records `refund` with the reference; a failed refund is retried and shown as pending; receipt email content (no secrets, amount `₦10,000.00`, period, reference); the payments list shows only the owner's rows.
- Read Paystack's refund documentation before writing the call; no field names from memory.

## Phase 5: screens (after the lawyer's wording)
- Tests first (Vitest, then Playwright at 360 and 1280 px, Light and Dark): pay step, Fee card, payments list, lapsed banner, staff reject-with-refund, texts of L1 to L8, nothing sponsored in SwiftRescue, text 16 px or more, targets 48 px or more.

## Not in scope
Live payments, real money, tax handling, bundles with Featured, changing Featured rules, charging staff.
