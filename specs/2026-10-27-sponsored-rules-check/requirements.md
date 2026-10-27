# Sponsored rules check: requirements

Requested by the owner on 2026-10-26: "Sponsored rules check with tests: always labelled, paying never changes verification, nothing paid on /emergency or above 112, only published verified listings can be featured." Related: FR-19, FR-44, FR-45, FR-46, FR-08, and the PRD line "Paying never buys the verified badge".

## The four rules

The rules are written once, in `specs/backend/api-spec.md` section 8, "Sponsored rules". In short:

1. **Always labelled.** The one featured listing in the sponsored slot of `GET /search` has `sponsored: true`; nothing else does. The web app writes "Sponsored" wherever it draws such a result (card, map popup) and nowhere else.
2. **Paying never changes verification.** A confirmed payment changes `featured_until` and its audit entry only.
3. **Nothing paid in SwiftRescue or above 112.** `/emergency` is the same with or without a payment; 112 is first.
4. **Only published, verified listings can be featured.** To start a payment and to take the slot, a listing must be published, have been verified, and not be overdue for its re-check.

## What was found

Rules 1 to 3 already held and had tests spread over `test_search_sponsored.py`, the payment tests and the emergency tests. Rule 4 held only for "published": a published listing with **no** verification date, or one **overdue** for its re-check, could start a payment and take the sponsored slot. That is the gap this change closes (decision S1).

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| S1 | "Verified" means `last_verified_at` is set and `next_check_due` has not passed. An overdue listing stays visible with "Verification due" (as before) but cannot start a payment and cannot take the slot. | A listing that is late for its check must not get the best place on the page by paying; this is the plain reading of "paying never changes verification". |
| S2 | A payment that was confirmed for a listing that is no longer eligible (hidden or overdue after the person paid) is still recorded, with its audit entry and `featured_until`, but shows nothing until the listing is eligible again. | The money was taken; the webhook must stay safe to repeat and must not refuse a real payment. Refunds are outside this change (and Paystack is in test mode only). |
| S3 | The web app asks the same question before it shows "Get featured" or "Pay with Paystack", and says why when the answer is no. | The person should not meet the refusal after clicking. The API still refuses, with the same two sentences. |

## Out of scope

Any change to the price, the 30-day period, the webhook, the label wording, or how many listings are sponsored (still one).
