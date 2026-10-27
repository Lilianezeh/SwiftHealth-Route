# SwiftRescue contacts screen: requirements

Requested by the owner on 2026-10-26: "an admin screen to add, edit and remove SwiftRescue emergency contacts per group (no phone numbers added by you)". Related: FR-15 (the groups), FR-19 (nothing paid in SwiftRescue), FR-31, FR-32, FR-38. UI spec 3.13; API spec section 5, "SwiftRescue contacts for staff".

## What it is

One staff screen, `/admin/emergency-contacts`, with one section per SwiftRescue group (the nine of the SwiftRescue page, in its order). Each group shows its contacts **of every status** and has **Add a contact to {group}**; each contact has **Edit** and **Remove**. 112 is not a listing and is not on the screen.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| E1 | The screen is for **editors and admins** (the same "review" area as the reports and the owner requests), not only admins. | Editors already publish, hide and reopen listings; the API checks the role again on every call. If you want it admin only, it is one line (`require_role`) and one gate area. |
| E2 | **Remove is hiding**: `POST /listings/{id}/hide` with a reason, after a question. The listing, its phones, checks and history stay, and Edit stays on the card. Nothing is deleted. | You asked for no deletes; a contact that closed must also leave the public list at once. |
| E3 | **Add** opens the normal new-listing editor with the group's category already chosen (`?category=`). The new contact is a draft: it appears in SwiftRescue only after our team verifies and publishes it, like every listing. The screen says so. | The trust rule (a call and a visit before anything is public) is the product. A contact that skips it would be the one place in SwiftRescue nobody had checked. |
| E4 | The groups, their names and their order come from `emergency_service.GROUPS`, the same list the SwiftRescue page uses. | One source, so the screen and the page cannot disagree. |
| E5 | **No phone number was added by me**: the seed, the migrations and the tests add none. The tests use made-up numbers. | Your rule. The screen shows only what the database holds. |
| E6 | A group shows at most 100 contacts and says the real total in its heading. | The staff list page size is 100; a group has a handful today. |

## Out of scope

Reordering contacts or groups; adding a tenth group (that needs a category and a change to `GROUPS`); bulk import (the CSV import exists); any change to what the public sees.
