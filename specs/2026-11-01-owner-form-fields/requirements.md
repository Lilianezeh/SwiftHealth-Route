# Requirements: Facility owner form, part (a): fields, draft, statuses, fee text

Branch `feature/owner-form-fields`. Status: **spec written (2026-11-01); built tests first; draft pull request.** Part 1(a) of the owner's request of
2026-11-01 (Part 2, maps, is pull request #85). Part 1(b) follows on its own branch: exact location (use my location, drag pin, paste a link or
coordinates), the entrance photo, the staff review with a map, and "Request changes" by staff.

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| US-17 | A facility owner lists their facility with a complete, accurate form | Must |
| FR-50 | Register a facility through a provider account; staff check it | Must |
| FR-23 | Every field is checked in words in the browser and again by the API | Must |
| FR-31 | Every listing change writes an audit entry | Must |
| NFR-06 | Nothing is public until staff publish; a provider reaches only their own requests | Must |
| NFR-07 | Privacy: the owner's email is for staff only | Must |
| NFR-10 | 16 px text, 48 px targets, works at 320 px | Must |

## What the owner asked (Part 1, items for this part)

On the "List your facility" form (logged in as a facility owner):

1. An optional **short description**, at most 200 characters.
2. **Services** chosen from the service list.
3. **Opening and closing hours for each day**, with "Open 24 hours" and "Closed".
4. A **landmark**.
5. **One or more phone numbers**, each with "This number has WhatsApp".
6. An optional **email** (staff only).
7. **Save as draft.** Nothing is public until staff publish.
8. The owner sees the status of the request: **Draft, Waiting for payment, Waiting for review, Changes requested, Published**.
9. At the top of the form: "Managing your facility on SwiftHealth Route costs ₦10,000 a month. You pay after submitting; if our team can't approve it, you
   get a full refund." (the amount from `OWNER_FEE_NAIRA`). It replaces "Listing is free during our launch" **on this form**.

Not in this part: the exact location, the entrance photo, the staff view of every field with a map, the "Request changes" button (all Part 1(b)).

## Decisions (owner, 2026-11-01)

| ID | Decision |
| --- | --- |
| F1 | The owner's **email** is kept on the listing (`listings.email`, an additive nullable column: no new table) and is **staff only**; it is never in a public answer. |
| F2 | Two new **link states**, `draft` and `changes_requested`, are plain text in `facility_owners.status` (no enum migration). A staff note for "changes requested" is kept in the audit log (written in Part 1(b)). |
| F3 | The fee sentence is marked **"not reviewed by a lawyer"** in `LOG.md`. |

## Choices made in this part (for the owner to confirm)

| ID | Choice |
| --- | --- |
| F4 | **A draft needs the same required fields as a sent request** (name, category, area, address, one phone). "Save as draft" differs in one thing: no payment is asked and staff do not see it. The address of a listing cannot be empty, and a half-empty draft would only move the checks to later. |
| F5 | **"Open 24 hours"** is one box for the whole facility (the `is_24_hours` field of the listing); when it is ticked the daily hours are not asked. Otherwise each day has an opening time, a closing time, or "Closed". Hours past midnight (open 8 PM, close 2 AM) are allowed as for staff. |
| F6 | **Phones:** the first number is the main one (the one staff phone); up to 4 more can be added. Each has an optional label and "This number has WhatsApp". |
| F7 | **Editing a request:** a request in `draft` or `changes_requested` can be edited by its owner. In `awaiting_payment` and `pending` it cannot (staff or Paystack may be acting on it). Sending a draft makes it `awaiting_payment`; sending a `changes_requested` request makes it `pending` again at once (the first month is already paid). |
| F8 | The map pin stays at the default centre in this part; staff move it (as today). Part 1(b) adds the owner's own pin. |
| F9 | A draft is not touched by the 14-day clean-up of unpaid requests (it is not a request yet). Old drafts are a follow-up to decide. |

## Flagged (found while reading, not changed here)

- Withdrawing a request that is `awaiting_payment` sets the link to `removed` but leaves its draft listing, which staff may then see as a draft
  nobody made. The same happens for a withdrawn `draft`. Closing such a listing (as the unpaid clean-up does) is a small follow-up.
