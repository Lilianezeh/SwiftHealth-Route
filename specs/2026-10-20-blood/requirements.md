# Blood (Phase 8): requirements

Find blood and Donate blood: two endpoints and two pages. How we build it is in [plan.md](plan.md); how we know it is done is in
[validation.md](validation.md). Branch: `feature/blood`, stacked on `feature/launch-readiness` (PR #29) in the unattended run of 2026-10-17.

## Requirements

[prd.md](../prd.md): **US-15** (find the nearest blood bank and the blood groups it usually supplies), **US-16** (find where and how to donate), **FR-27**
(blood banks and hospitals with blood bank services, nearest first, groups stored as services with the date confirmed, hours, Call and Directions, and the
note "Stock changes daily; call to confirm before you go"), **FR-28** (donation centres with donation hours, Call and Directions), **FR-29** (basic donor
eligibility and preparation guidance, based on National Blood Service Agency guidance and reviewed by the medical advisor, ending with "The blood bank will
confirm if you can donate"), **FR-08**, **FR-19** (nothing sponsored), **FR-20** (a Report link on every contact), **NFR-01**, **NFR-07**, **NFR-10**.
Source of truth: [api-spec.md](../backend/api-spec.md) ("GET /blood/banks", "GET /blood/donation-centres") and [ui-spec.md](../frontend/ui-spec.md) (2.6, 2.7).
No new table, no new package. Blood groups are rows of `services` (CLAUDE.md).

## In scope

- **8a:** `GET /blood/banks`, the page `/blood` with blood group chips.
- **8b:** `GET /blood/donation-centres`, the page `/blood/donate`, the tab switch between the two.

## Out of scope

- Live stock, groups a donation centre needs, a donor registry (all "With partners" in the roadmap); ambulance requests.
- The donor guidance **text**: it is medical wording and needs the medical advisor (see F3).

## Assumed owner decisions

**Please read F3 first: the donor guidance is medical wording.** My instruction was to stop and ask for medical wording. I did not write any, so the page has the place for
it and the closing sentence of FR-29, and says the guidance is being prepared with the medical advisor.

| # | Decision I made | Alternative |
| --- | --- | --- |
| F1 | **A blood bank, for `GET /blood/banks`, is a published listing in the category `blood-bank`, or any published listing (a hospital, for example) that has a service named "Blood bank" or at least one blood group among its services** (matched by the same-service rule; the demo hospital in the seed has groups only). The listings flagged by FR-22 are left out, as in search and SwiftRescue. | Only the category |
| F2 | **Blood groups of a listing** are its services whose name is one of the eight groups (matched by the same rule, returned in the order A+, A-, B+, B-, AB+, AB-, O+, O-). **The date confirmed** is the newest `fee_collected_at` among those rows (the seed already stores it there); `null` if none has a date. | A new column |
| F3 | **The donor guidance (FR-29) is not written.** `config/donorGuidance.ts` holds the list of guidance points, empty until the medical advisor supplies reviewed text; while it is empty the page says "Donor guidance is being prepared with our medical advisor." followed by the required closing sentence "The blood bank will confirm if you can donate." A test fails if guidance is added without the sentence "Reviewed by our medical advisor" and a date, so unreviewed text cannot slip in. | Draft text from me (I should not) |
| F4 | **A donation centre is a published listing with a service named "Blood donation"** (same rule). It returns its week of opening hours as `donation_hours` (the 7 entries of the listing page). | A separate category |
| F5 | Both lists are **nearest first with a position, A to Z without**, with no distance limit, paged 20 at a time (`limit`, `offset`, max 100), and `blood_group` that is not one of the eight is a **422**. | A radius |
| F6 | Both pages ask for the position **only after a tap** (like Find) and keep it for the tab; there is no area picker (the API has no area filter for blood). | An area list |
| F7 | **Find blood | Donate blood** is a pair of links at the top of both pages (`aria-current="page"` on the current one), not a client tab widget, so each page works alone and the address shows which is open. | A tab widget |
| F8 | **No seed change is needed:** the fictional demo blood banks of the local seed already have the "Blood donation" service and their groups. Production's demo listings are not touched (a fake blood bank must never reach the real SwiftRescue). | A seed change |
| F9 | Each card has the **Report a problem** link (FR-20) and never a "Sponsored" tag (FR-19). | None |
