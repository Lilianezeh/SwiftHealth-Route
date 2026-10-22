# Blood banks only on /blood: requirements

SwiftRescue stops listing blood banks. `/blood` is the only place that lists them; SwiftRescue keeps the "Need blood urgently?" card that links to it.
Branch: `feature/blood-only-on-blood-page`. Owner's decision of 2026-10-22 ("Yes to task 2"). **Stacked on `feature/swiftrescue-order` (PR #37)**, because it
builds on the group logic and the blood card of that pull request, which was not yet in `main` when this was written. Tests: [validation.md](validation.md).

## Requirements

[prd.md](../prd.md): **FR-15** (the groups of emergency contacts: Blood banks removed from the list), **FR-27** (Find blood lists the blood banks), **US-04**, **US-15**,
**NFR-10**. Source of truth: [api-spec.md](../backend/api-spec.md) `GET /emergency`, [ui-spec.md](../frontend/ui-spec.md) 2.5.

## Where blood banks come from (explained to the owner)

Both places read the one `listings` table, so staff entered a blood bank only once (a listing in the category "Blood bank"). The SwiftRescue group showed only that category;
`/blood` shows that category and also any listing with a "Blood bank" or blood-group service (a hospital, for example), with the groups and the date they were confirmed. The
data is therefore already one source of truth; this change makes the **presentation** one too.

## What changes

1. `GET /emergency` has **six groups** (Ambulance, Fire, Police, 24-hour emergency units, Roadside assistance, Security). No `blood-bank` group, and a blood bank is nowhere in the answer.
2. The page, the saved offline copy and the shared WhatsApp/SMS list **ignore a `blood-bank` group** if an older API or an older saved copy still has one.
3. SwiftRescue keeps the "Need blood urgently?" card to `/blood` (unchanged).

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| M1 | The `blood-bank` **category stays** in the database and the seed (it is how `/blood` finds blood banks and what staff pick); only the SwiftRescue group goes. | Rename or remove the category |
| M2 | **Blood bank numbers are not on SwiftRescue offline any more.** The saved copy of `/emergency` has no blood banks. `/blood` gets its own saved copy in a separate pull request (the same way as `/emergency`), so blood bank numbers are still there offline, on `/blood`. | Keep the numbers in the SwiftRescue copy |
| M3 | An older API answer (or an older saved copy) that still holds a `blood-bank` group is **ignored**, not shown, so nothing breaks in the minutes between the two deploys and a visitor's old saved copy never shows a list that has moved. | Show it |
| M4 | **This changes the API** (a smaller `groups` list). Previews call the production API, so a preview still gets the old answer until this is merged and Render has redeployed; the page copes with both. | None |
