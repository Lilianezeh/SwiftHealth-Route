# SwiftRescue groups: new names, five always shown, three new groups: requirements

**Status: approved by the owner on 2026-10-22 ("Yes, with these answers"). Nothing is built. I wait until the owner says the #39 changes are in `main`; then I update this branch from `main`, edit the shared specs (plan task 0b) and build, tests first.**

## The owner's answers (2026-10-22), which win over the proposal where they differ

1. **The category rows are renamed too**, display names only: `fire` "Fire" → **"Fire service"**, `emergency-unit` "24-hour emergency unit" → **"Hospital emergency (24 hours)"**, `roadside-assistance` "Roadside assistance" → **"Road accidents"**. **Ids and slugs stay.** The **downgrade restores the old names.** No deletes. (This replaces "the rows keep their old names" below: the migration is "additive + three display-name updates", not additive only, by the owner's decision.)
2. The order of the optional groups is OK (Security, then the three new ones). 3. The three slugs are OK. 4. A 14-day re-check is OK for all of them.
5. **Merge order:** #39 first, then this feature, then the home-photos work. The owner is opening a new pull request from `feature/blood-only-on-blood-page` into `main` (the first #39 was merged into `feature/swiftrescue-order` by mistake). #38 will be closed (the login link moves to the header in the accounts work); #40 will be merged.

**How the rename works (same revision as the three new rows):** for each of the three slugs, `UPDATE categories SET name = :new WHERE slug = :slug AND name = :old` (only a row that still has the old name is touched, so a name that staff already changed by hand is never overwritten; running it twice changes nothing; the `id`, `slug`, `is_emergency`, `recheck_days` and every listing that points to the row are untouched). `downgrade` runs the reverse updates (`new` → `old`, same guard) and **deletes nothing**, not even the three new rows (reference data; if a listing already uses one, removing it would orphan it). The seed uses the new names, so a fresh database has them from the start.
How we build it: [plan.md](plan.md). Branch: `feature/swiftrescue-groups`, from `main` (which has #37; #39 is still open, see "Merge order"). Owner's request of 2026-10-22.
Requirement IDs: FR-14, FR-15 (changes), FR-16, FR-17, FR-18, FR-19, FR-26, NFR-03, NFR-10, US-04, US-09, US-14.

## What the owner asked

1. **Rename three headings:** "Fire" becomes **"Fire service"**, "24-hour emergency units" becomes **"Hospital emergency (24 hours)"**, "Roadside assistance" becomes **"Road accidents"**. "Ambulance", "Police" and "Security" stay.
2. **Always shown, even with no contact** (each then says "No contacts added yet. In danger, call 112."), in this order: **Ambulance, Fire service, Police, Hospital emergency (24 hours), Road accidents**. **Security is shown only when it has contacts.**
3. **Three new groups, shown only when they have contacts:** **"Disaster and flooding"**, **"Sexual and gender-based violence support"**, **"Mental health crisis support"**.
4. The **ambulance and fire photos** of the home-photos work stay under their groups. **112 stays first.** The **shared WhatsApp/SMS list**, the **offline copy**, the **API**, the **specs and the tests** are updated. **Additive migration only; existing data is kept.**
5. **I add no phone number.** No demo or real contact is created for the new groups (nor for the renamed ones). Staff add verified contacts later, in the listing editor.

## The page after this change (UI spec 2.5, point 5)

Top to bottom: the 112 card, the FR-26 sentence, Share my location, Share emergency list, then the groups:

| # | Heading | Slug (category) | Shown |
| --- | --- | --- | --- |
| 1 | Ambulance | `ambulance` | always |
| 2 | Fire service | `fire` | always |
| 3 | Police | `police` | always |
| 4 | Hospital emergency (24 hours) | `emergency-unit` | always |
| 5 | Road accidents | `roadside-assistance` | always |
| 6 | Security | `security` | only with a contact |
| 7 | Disaster and flooding | `disaster-flooding` (new) | only with a contact |
| 8 | Sexual and gender-based violence support | `gbv-support` (new) | only with a contact |
| 9 | Mental health crisis support | `mental-health-crisis` (new) | only with a contact |

Then the "Need blood urgently?" card (unchanged). An empty always-shown group shows its heading and the line "No contacts added yet. In danger, call 112." (K1 of `specs/2026-10-22-swiftrescue-order/`). When **every** group is empty, the line "We are still adding verified contacts. In danger, call 112." stays above the groups (K2), now above five empty ones instead of two. Cards, Call buttons, distance and verified dates are unchanged; nothing is sponsored (FR-19).

**The headings live in the frontend too** (one list by slug: heading, always shown or not). Reason: an old saved offline copy, and the old API during the minutes before Render redeploys, still say "Fire" and "Roadside assistance"; the page must show the new headings from either. The frontend list wins; the name in the answer is the fallback for a slug it does not know (so a group added later by the API still shows).

## The API (`GET /emergency`, api-spec)

- `groups` always lists **all nine groups, in the order of the table**, each with its `category` (slug and heading) and `contacts` (empty `[]` when none). Which ones the page draws is the page's job (as today for Security).
- Headings come from `GROUPS` in `emergency_service.py` (as today), not from the category rows. No new field, no new endpoint, no change to the trust rules, distance or ordering inside a group.
- **Blood banks** are not in this list: they leave `GET /emergency` in #39. If #39 is not merged when this is built, `blood-bank` stays last in the answer and the page keeps ignoring it, as it does now.

## The database: additive migration only

- **One new Alembic revision after `a54b67ca04df`** that **inserts three rows** into `categories`, `ON CONFLICT (slug) DO NOTHING` (the style of `f6184e303abb_all_spec_categories.py`):

| name | slug | is_emergency | recheck_days |
| --- | --- | --- | --- |
| Disaster and flooding | `disaster-flooding` | true | 14 |
| Sexual and gender-based violence support | `gbv-support` | true | 14 |
| Mental health crisis support | `mental-health-crisis` | true | 14 |

  Emergency contacts are re-checked every 14 days (FR-33). The names are the headings. **No table is added, merged or removed (still the 9 tables); no column changes; no row is deleted.** The same revision also renames the display names of three existing rows (see "The owner's answers", point 1). `downgrade` restores those three names and deletes nothing. Safe to run twice.
- **The seed** (`backend/seed/seed_data.py`) gets the same three category rows, **and no listing, no phone number** for them. Its existing fictional demo contacts stay as they are. (The test that keeps the seed and the migration list in step is extended to the new revision.)
- The three new categories are `is_emergency`, so they are **not** in the Filters sheet, `/search` still finds their listings by their exact slug in the address, a "List your facility" submission cannot choose them (as for every emergency category), and **staff can pick them in the listing editor** (the editor lists all categories from `GET /meta`; to be checked by a test).

## The saved offline copy, the shared list

- **Offline copy** (`swiftrescue-saved-contacts`): stores the groups of the last answer as before; the page shows the headings of its own list by slug, so a copy saved before this change shows the new headings and the five always-shown groups (the missing ones empty) without a new visit. A copy that has a group the page does not know (a slug added later) still shows it, with the name it was saved with. Still no position, no distance, no picture data in it.
- **Share emergency list** (WhatsApp/SMS plain text): 112 first, then **each group that has at least one contact with a number**, in the order of the table, with the new headings; empty groups are left out (as today); the new groups appear there only once they have a contact with a number. A test checks the text for a case with Fire service, Hospital emergency and Mental health crisis support.

## The photos (home-photos work)

`ambulance` and `fire` go under the **Ambulance** and **Fire service** groups, as specified in `specs/2026-10-22-home-photos/requirements.md` part 6 (small lazy fixed-height WebP, "Designed by Magnific" under each, 112 and Call 112 never wait for them, the two files kept offline by the worker). **They are not built yet** (that feature waits for #38 to #40). This feature only makes sure the slots are by slug (`ambulance`, `fire`) and that the heading text can change without touching them. Whichever of the two features is merged second adds the photos to the other's code.

## Rules that stay

112 first; the FR-26 sentence unchanged; no sponsored content in SwiftRescue; no medical advice; every text 16 px or more; every tap target 48 px; no red cross; red only for the Call 112 button and emergencies; tidy at 320 px (eight to nine headings are short; the longest, "Sexual and gender-based violence support", wraps in two lines at 320 px: a test checks it is not clipped).
**Phone numbers: none are added by this feature, in any file** (a test scans the migration and the seed for the new slugs and finds no phone).

## Merge order and conflicts

- **#39** (blood banks only on `/blood`) changes the same lines: `GROUPS` in `emergency_service.py`, `EmergencyGroups.tsx`, the group list in `specs/backend/api-spec.md`, `specs/prd.md` FR-15 and `specs/frontend/ui-spec.md` 2.5. I **recommend that the owner merges #39 first**; then this branch is updated from `main` and the spec lines are edited once (plan, task 0b). Until then only the new feature folder exists in this branch, so nothing conflicts.
- The home-photos work (`feature/home-photos`) also changes `EmergencyGroups.tsx` (its photos). **Recommended order: #39, then this feature, then home-photos' part 6.**

## Questions for the owner (please answer with the "yes")

1. **Category names in the database.** I change the **headings** (API list and page). The category **rows** keep their old names ("Fire", "24-hour emergency unit", "Roadside assistance"); they show in the staff listing editor and as the category on a listing's page. Renaming the rows would be an UPDATE of existing data (not additive). OK to leave the rows, or rename them too?
2. **Order of the optional groups.** I put Security first, then your three in the order you wrote them. OK?
3. **The three slugs** `disaster-flooding`, `gbv-support`, `mental-health-crisis` (they appear in addresses such as `/search?category=...`). OK?
4. **Merge order.** #39 first (recommended), then this? Or build now and resolve the conflicts myself afterwards?
5. **Support lines vs. emergency contacts.** Groups 8 and 9 are "support" lines. They get the same 14-day re-check and the same Call button as the rest. OK, or a different re-check period for them?
