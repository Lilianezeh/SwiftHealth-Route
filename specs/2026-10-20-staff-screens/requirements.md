# Staff screens and "List your facility" (Phase 10): requirements

What the staff API and screens and the public "List your facility" form must do, and the decisions behind them. How we build it is in
[plan.md](plan.md); how we know it is done is in [validation.md](validation.md). Branch: `feature/staff-screens`, stacked on
`feature/reports` (PR #26) in the unattended run of 2026-10-17. This is the largest phase; it covers roadmap 10a to 10e. Every decision I had to make
alone is in "Assumed owner decisions".

## Requirements

[prd.md](../prd.md): **US-10** (a verifier records a call or visit on a phone), **FR-30** (staff log in with a password and a one-time code),
**FR-31** (add and edit listings, GPS pin from the phone), **FR-32** (verification log), **FR-33** (re-check cycle per category), **FR-36** (a failed
re-check of a published listing hides it and tells the editors), **FR-37** (submissions from "List your facility" arrive as drafts), **FR-38** (audit entry
for every change), **FR-41** (admin manages staff accounts and roles), **FR-42** (the admin panel works on a phone), **NFR-06** (role-based access, rate
limit), **NFR-07**, **NFR-10**. The listing statuses and who may move a listing between them are the table in [prd.md](../prd.md).

Source of truth: [api-spec.md](../backend/api-spec.md) (sections 3 "POST /facility-submissions", 5, 9, 11) and [ui-spec.md](../frontend/ui-spec.md)
(2.9, 3.1, 3.3 to 3.5, 3.8). Fit with the project: [mission.md](../mission.md) (every listing is checked by a person), [tech-stack.md](../tech-stack.md)
unchanged. **No new table and no new package.** The roles rules are the ones of CLAUDE.md: the role and `is_active` are read from the database on every
request, a verifier edits only drafts they created.

## In scope

- **10a:** the staff login screen `/admin/login` (password, then the code) and the staff session in the browser.
- **10b:** `GET /listings`, `GET /listings/id/{id}`, `POST /listings`, `PATCH /listings/{id}`; the screens `/admin/listings` and the editor
  `/admin/listings/new` and `/admin/listings/[id]`, with services picked from a controlled list (no new table).
- **10c:** `POST` and `GET /listings/{id}/checks`, `POST /listings/{id}/submit`, `/publish`, `/hide`, `/reopen`, `POST /uploads/sign`; the screen
  `/admin/listings/[id]/checks`.
- **10d:** `POST /facility-submissions` and the public form `/list-your-facility`.
- **10e:** `GET`, `POST`, `PATCH /admin/users` and the screen `/admin/staff`.
- A small staff home at `/admin` that sends each role to its list (the dashboard with numbers is phase 11).

## Out of scope

- The dashboard numbers, the re-check list, the reports queue and the nightly job: phase 11. CSV import and export: phase 14.
- The provider screens and the provider's own edit endpoint: phase 12 (`/provider` stays a placeholder).
- Resetting a forgotten staff password by email: not in the MVP (an admin sets a new password in `/admin/staff`).

## Decisions with the spec (no owner choice needed)

1. The public sees only published listings; staff endpoints are the only way to read the others. A staff endpoint answers 401 without a token, 403 for a role that
   may not do it, 404 for an unknown listing.
2. Every change to a listing writes an audit entry (FR-38), including the status moves and the checks.
3. Money stays a `Decimal` with two places and is sent as a string; phones are stored as `+234…`.

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| C1 | **Services are picked from a fixed catalogue** kept in code (`core/service_catalogue.py`, like the areas): the services of the seed data, the 8 blood groups, "Blood bank", "Blood donation" and a few general ones. The API refuses a name outside it (422) and stores the catalogue's spelling, so "x ray" and "X-ray" cannot both exist. To add a name, the catalogue is extended (a code change). This needs no table. The names I added beyond the seed are only labels of what a facility offers (no medical advice): **Emergency care, Dental care, Vaccination, Surgery, Physiotherapy, Pharmacy dispensing**; please check them. | A new table (needs your approval) or the distinct names in use |
| C2 | The staff **session token is kept in `sessionStorage`** (gone when the tab closes), not `localStorage` and not a cookie. A verifier who closes the tab logs in again. | `localStorage` (stays 12 hours, easier on a phone, readable by any script of the site) |
| C3 | A **verifier may log a check on any listing** and read any listing; editing stays limited to their own drafts. Editors and admins do everything. | A verifier logs only on their own drafts |
| C4 | **"Hide" stores the reason in the audit entry's `reference`**, with action `hide`, field `status`. | A new column (the table list is fixed) |
| C5 | A **facility submission becomes a draft with the centre of the pilot city as its map pin** (a constant in `core/config.py`), because `listings.latitude` and `longitude` cannot be empty; the verifier must set the real pin in the editor. The editor shows a warning while the pin is still the default. | Reject submissions without a pin (owners cannot give one) |
| C6 | **The submitter's name, email and notes are kept in an audit entry** (action `submission`, field `contact`), not in the listing's `description` as the api-spec first said, because `description` is shown to the public once the listing is published and would publish the owner's personal data (NDPA). Staff see it in the editor as "Submission details". The api-spec is changed accordingly. | Keep it in `description` as the spec said |
| C7 | A **submission** takes only the everyday categories (not the emergency ones, which staff add), needs a phone number, and is rate-limited to **3 per IP per day** in memory (like the report limit). | Allow every category |
| C8 | **Photo upload** goes straight from the phone to Cloudinary with a signature from `POST /uploads/sign`. I wrote the signing from Cloudinary's documented rule (SHA-1 of the sorted `key=value` pairs joined by `&`, plus the API secret) and could not test it against a real account. Without `CLOUDINARY_URL` the endpoint answers 503 "Photo upload is not set up" and the screen says so. The 5 MB limit and image-only rule need an **upload preset** in your Cloudinary account (setting `CLOUDINARY_UPLOAD_PRESET`); that is for you to create. A `photo_url` is accepted only if it is an `https://res.cloudinary.com/` address. | Upload through our API |
| C9 | A **failed check of a published listing** hides it at once and sends the editors an email, as FR-36 says; the alert uses the same best-effort sender as phase 9 (nothing is sent without Resend keys). | Only mark it for review |
| C10 | **Staff accounts:** an admin can create users of any role (including admin), edit them, deactivate them (never themselves), and set a new password (at least 10 characters, hashed like the login password). A provider is linked to a listing with `listing_id`. Emails are checked with a simple pattern (the email package is not installed). The list answers `{ "items": [...], "total": n }`. | A separate invite flow |
| C11 | **`/admin` for now** sends a verifier to `/admin/listings?mine=true` and every other staff role to `/admin/listings`; a provider is sent to `/provider`. Phase 11 replaces it with the dashboard. | A dashboard in this phase |
| C12 | **Phone, hours and the map pin in the editor:** the pin is typed as two numbers or taken with "Use my current location" (asked after the tap, exact, not stored anywhere else); hours are seven rows with open, close and a Closed box (a closing time earlier than the opening time runs past midnight). There is no map in the editor (a map widget is a later improvement). | A Leaflet map to drop a pin |
| C14 | **The staff list is a card list on every width** (two columns from 768 px), not a table from 768 px as the ui-spec 3.3 said: one layout to test and to keep readable on a phone. | A real table on a wide screen |
| C15 | **Small choices made while building:** the check history answers `{ "items": [...], "total": n }`; the masked number of the code step is shown as `0*** *** 0001` (the API's mask has lost the middle digits, so "0803 *** 0001" cannot be made); the editor disables Submit, Publish and Hide while there are unsaved changes; a check is saved with Call or Visit and Pass or Fail both chosen (no default); the staff pages `/admin/*` are not linked from the header or footer; an admin cannot give up their own admin role (not only deactivate themselves). | Other wording or rules |
| C13 | **Unsaved changes:** the editor warns on leaving (browser prompt on closing or reloading the tab and a confirm on the Cancel link); it does not block in-app navigation links. | Block all navigation |

## What the owner should check on a phone

Open `/admin/login`, log in with a staff account (the code is sent by SMS only when a Termii key is set; locally it is in the API log), add a draft listing, log a call and a visit,
submit it, publish it as an editor, and see it in the search. Open `/list-your-facility`, send the form and find the draft in the staff list. As admin, add a staff user.
Check that a verifier cannot publish and cannot edit another verifier's draft. Production needs this PR merged and Render redeployed; Cloudinary and the SMS need their keys.
