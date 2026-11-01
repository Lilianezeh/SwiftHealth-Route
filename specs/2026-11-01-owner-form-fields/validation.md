# Validation: Facility owner form, part (a)

Spec: [requirements.md](requirements.md). Plan: [plan.md](plan.md). Boxes are ticked with the evidence at the end of the feature, after the owner
has looked at the preview. Check this file before saying the feature is done.

## Build results

(filled in with the real numbers from the final runs, see the pull request)

## Checks

- [ ] The form shows the fee words before the first field, with the amount from `OWNER_FEE_NAIRA`, and no longer says "Listing is free during our launch".
- [ ] The fee words are marked "not reviewed by a lawyer" in `LOG.md` (decision F3).
- [ ] Description (at most 200), landmark, phone numbers with "This number has WhatsApp", opening hours with "Open 24 hours" and "Closed", services,
      and the optional email are all saved and come back when the request is opened again.
- [ ] "Save as draft" asks for no payment; staff see nothing of the draft in Owner requests or in the listings; it is not public.
- [ ] The next save of a draft goes to the same request; "Send" asks for the first month.
- [ ] A request that needed changes can be edited and sent again, goes back to "Waiting for review" and asks for no new payment.
- [ ] The owner sees the five statuses: Draft, Waiting for payment, Waiting for review, Changes requested, Published.
- [ ] The owner's email is in the staff detail and in no public answer (search, listing page).
- [ ] Another provider cannot read or change a request (404); a request with our team cannot be edited (409).
- [ ] Every changed field of a draft is an audit entry.
- [ ] The migration adds only `listings.email` (nullable); there are still exactly 10 tables; the downgrade drops only the column.
- [ ] Text is 16 px or more, targets 48 px or more, nothing runs past the screen at 320 px (real browser).
- [ ] Backend tests and `ruff check .` pass; frontend `lint`, `typecheck` and `npm test` pass.

## Open for the owner

- Choices F4 to F9 in `requirements.md`.
- A withdrawn `draft` or `awaiting_payment` request leaves its draft listing without a live link (flagged in `requirements.md`).
- Part 1(b) follows: exact location, entrance photo, staff review with a map, "Request changes".
