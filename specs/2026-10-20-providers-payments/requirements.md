# Providers and featured listings (Phase 12): requirements

A provider edits their own listing, pays for a 30-day featured listing with Paystack **in test mode only**, and one featured listing shows first in matching
searches with the label "Sponsored". How we build it is in [plan.md](plan.md); how we know it is done is in [validation.md](validation.md). Branch:
`feature/providers-payments`, stacked on `feature/reports-queue-dashboard` (PR #32) in the unattended run of 2026-10-17.

## Requirements

[prd.md](../prd.md): **FR-43** (a provider logs in like staff and views and edits only their own listing; a change to phones or hours triggers an urgent re-check),
**FR-44** (a 30-day featured listing paid with Paystack, test mode in the MVP; payment is confirmed only by a verified Paystack webhook), **FR-45** (at most one
featured listing first in matching search results, labelled "Sponsored", never in SwiftRescue), **FR-46** (every payment in the audit log with its Paystack
reference; a repeated webhook never applies twice), **FR-19** (nothing sponsored in SwiftRescue or the blood pages), **FR-38**, **NFR-06**, **NFR-10**.
Source of truth: [api-spec.md](../backend/api-spec.md) (sections 3, 7, 8 and the phase 12 rules) and [ui-spec.md](../frontend/ui-spec.md) (4.1 to 4.4).
No new table and no new package. **Nothing live or paid is switched on:** the code refuses a Paystack live key.

## In scope

- **12a:** `GET /provider/listing`, `PATCH /provider/listing`; the screens `/provider` and `/provider/edit`.
- **12b:** `POST /payments/featured`, `GET /payments/verify/{reference}`, `POST /payments/webhook`; the screens `/provider/featured` and `/provider/payment-complete`.
- **12c:** the sponsored slot in `GET /search`.

## Out of scope

- Live payments, refunds, invoices, a payment history screen, recurring billing, and the real price (the owner sets `FEATURED_PRICE_NAIRA`).
- Privacy and Terms wording about payments: it is legal text, so I did not write it (see the LOG pre-launch list).
- Any change to Render, Netlify or the Paystack dashboard (the owner steps are in the LOG row).

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| I1 | **`GET /provider/listing`** answers the staff detail of the caller's own listing plus `featured_price_naira` (a string such as "5000.00", so the Get featured page can show the price before paying). No listing linked to the account: 404 "No listing is linked to your account." | A separate price endpoint |
| I2 | **A provider's edit goes live at once**, as the PRD says (FR-43), with no review step. Only `description`, `services`, `opening_hours` and `phones` are accepted; any other field is 422 and nothing changes. Each changed field writes an audit entry. A change to phones or hours also sets `next_check_due` to now (an urgent re-check) and writes one more audit entry (field `next_check_due`, reference `provider-change`); the listing stays published and visible with `verification_due: true`. | Send a provider edit to `pending_review` |
| I3 | **Test mode only.** A `PAYSTACK_SECRET_KEY` that starts with `sk_live_` is refused with 503 "Live payments are switched off." before any call; with no key, 503 "Payments are not set up yet." The calls follow Paystack's documentation (Initialize Transaction, `https://paystack.com/docs/api/transaction/`; webhooks, `https://paystack.com/docs/payments/webhooks/`). **They are tested with a mock transport only, never against Paystack:** check them once against the real test dashboard. | Allow any key |
| I4 | **No payments table.** A payment exists as an audit entry: action `payment`, the listing, field `featured_until`, old and new value, **reference = the Paystack reference**. `GET /payments/verify/{reference}` reads that entry. | A table (not allowed without your word) |
| I5 | **The reference** is made by us: `SH-<listing id>-<unix seconds>` (as in the API spec). The webhook accepts only a reference of this shape whose listing id equals `metadata.listing_id`. | Paystack's own generated reference |
| I6 | **The webhook** checks the `x-paystack-signature` header (HMAC SHA-512 of the raw body with the secret key, compared in constant time): missing or wrong is 401 and nothing changes. A valid call for any event except `charge.success` is ignored with 200. For `charge.success` it also needs `data.status` "success" and `data.amount` (kobo) at least `int(price * 100)`; otherwise it is ignored with 200 and only the reference is logged. The body, the customer email and the card details are never logged or stored. | Accept any amount |
| I7 | **A repeated webhook applies once.** Inside one transaction a Postgres advisory lock on the reference is taken, then the audit entries are searched for that reference; if one exists nothing changes and the answer is 200. | A unique column (needs a schema change) |
| I8 | **Featured period:** `featured_until` = the later of now and the current `featured_until`, plus 30 days. | Restart from now |
| I9 | **`GET /payments/verify/{reference}`** does not call Paystack: it answers `success` (with `featured_until`) when the webhook has been applied, else `pending`. A reference of another provider's listing is 404. | Ask Paystack to verify |
| I10 | **`POST /payments/featured`**: provider only; their listing must be `published` (else 400); `plan` must be `"monthly"`; the amount is `FEATURED_PRICE_NAIRA` as a Decimal, sent in kobo as `int(price * 100)`; the customer email is the provider's login email; the callback is `<web address>/provider/payment-complete`, where the web address is `WEB_APP_URL` or, when empty, the first `CORS_ORIGINS` value (so production needs no new setting). Paystack unreachable or not accepting: 502 "Could not start the payment. Try again." Every call makes a new reference; nothing is charged until the provider pays on Paystack's page. | Fixed callback setting |
| I11 | **The sponsored slot.** In `GET /search`, among the results that match every filter (and the radius), the **first listing in the normal order** whose `featured_until` is in the future and whose category is **not an emergency category** is moved to the top with `sponsored: true`; it is not repeated lower down; `total` does not change. Paging works on the whole ordered list, so the slot is on page 1 only. Nothing is sponsored in `/emergency`, `/blood/*` or the listing page (they are unchanged). With several featured listings the nearest (or first by name) wins; there is no rotation. | Rotate between featured listings |
| I12 | **Screens.** `/provider` (dashboard), `/provider/edit`, `/provider/featured`, `/provider/payment-complete` are for the provider role only (the gate says "Your role cannot open this page." to anyone else). The staff bar of a provider has Dashboard, Edit my facility, Get featured and Log out. The edit screen reuses the Phones, Opening hours, Services and Description sections of the staff editor. | A separate form |
| I13 | **Payment complete** reads the reference from `?reference=` (or `?trxref=`) in the address (it is not secret), asks `GET /payments/verify/{reference}` every 3 seconds for up to 30 seconds, and then shows "Payment confirmed. Featured until 6 Nov 2026." or "Still confirming. You can leave this page; we will update your listing." | A longer wait |

## Owner steps (outside the code, I changed none of them)

1. On Render, set `PAYSTACK_SECRET_KEY` to a **test** key (`sk_test_...`) and `FEATURED_PRICE_NAIRA` to the price you want.
2. In the Paystack **test** dashboard, set the webhook URL to `<Render address>/payments/webhook`.
3. Make a provider account in `/admin/staff`, link it to a published listing, log in as that provider and pay with a Paystack **test card**; check `/provider/payment-complete`.
4. Before any real payment: the Privacy and Terms pages need your lawyer's wording about payments, and a live key needs a new decision (the code refuses it today).
