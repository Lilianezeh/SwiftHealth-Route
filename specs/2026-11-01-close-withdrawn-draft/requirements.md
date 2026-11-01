# Requirements: Close the listing of a withdrawn draft or unpaid request

Branch `fix/close-withdrawn-draft`. Status: **built (2026-11-01); draft pull request.** The owner's answer of 2026-11-01, after the finding in
`specs/2026-11-01-owner-form-fields/requirements.md` ("Flagged"): *"Close a withdrawn draft or unpaid request's listing the same way as the unpaid
clean-up (closed, never deleted)."*

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| FR-50 | Register a facility through a provider account; staff check it | Must |
| FR-53 | A closed listing is hidden, never deleted | Must |
| NFR-06 | Staff see only requests that reached them | Must |

## What changes

- When an owner **deletes a saved draft** (link `draft`) or **withdraws a request that was never paid** (link `awaiting_payment`) through
  `POST /provider/links/{id}/cancel`, the draft listing that only that request made is **closed**: status `hidden`, `closed_at` set,
  `closed_reason` "unpaid". It is never deleted. One audit entry `close` (`draft` to `hidden`, `reference` "withdrawn", `user_id` the owner).
- It is the same rule as the nightly clean-up of unpaid requests (`close_unpaid_requests`), now one shared function
  (`owner_fee_upkeep_service.close_listing_made_by_request`).
- **Never touched:** a listing staff made (`created_by` set), a published listing someone only asked to claim, a listing that is not a draft,
  one already closed, and a draft another person still has a live link to.
- Because `closed_reason` is "unpaid", staff never see it (`not_an_unpaid_request`) and the same phone number can be registered again.

## Not changed (for the owner)

- A request that **was paid** (`pending`, `changes_requested`) and is then withdrawn gives the payment back as before, but its draft listing is
  **not** closed: staff already saw it and the listing is part of their record. Say if you want it closed too.
- No new table, column, route or package.
