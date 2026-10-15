# Listing detail API (Phase 6a): requirements

What `GET /listings/{slug}` must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it is
done is in [validation.md](validation.md). This is the backend half of phase 6; the page is phase 6b
(`feature/listing-page`, started after this one is merged).

## Requirements

- **FR-09** ([prd.md](../prd.md)): the data of a listing page: name, category, address, landmark, phone numbers, opening hours
  by day, services, estimated fee ranges with the date collected, entrance photo, last-verified date.
- **FR-10:** the phone numbers (`+234…`) and the position for the Call and Directions buttons. The buttons are phase 6b.
- **FR-47** (Should): which phone numbers are on WhatsApp (`is_whatsapp`), for the WhatsApp button of phase 6b. The owner added
  this requirement on 2026-10-11 ([prd.md](../prd.md)); FR-10 keeps its original wording. This phase adds the flag and
  returns it; the button is 6b.
- **FR-11:** fees are estimates. The API sends the fees and the date collected as stored; the label is the page's.
- **FR-13:** the directory disclaimer, in the answer of every listing.
- **US-06** and **US-07:** services, hours and fees as a dated range; the last-verified date.
- **FR-08** and **NFR-08:** a published listing past its re-check date is still returned, with `verification_due: true`.
- **FR-22:** a listing that 2 different reporters called "not working" in 7 days is hidden from search but not from its own
  page, which gets a flag to show a notice (decision 3). Setting the flag from reports is phase 9b; this phase only reads it.
- **NFR-07:** no personal data is returned: nothing about reporters, no staff ids.
- **NFR-12:** each listing has its own address. The page is built in 6b.

Source of truth: [api-spec.md](../backend/api-spec.md) (`ListingDetail`, `GET /listings/{slug}`, the trust rules),
[prd.md](../prd.md). Branch: `feature/listing-detail-api`. Every commit and test references these IDs.

Fit with the project: [mission.md](../mission.md) wants a resident to call or get to a verified place quickly, and this is the
verified detail behind a card. [tech-stack.md](../tech-stack.md) is unchanged. No new package and no new table: the project keeps
exactly 9 tables. The one change to the data model is a new column, `phone_numbers.is_whatsapp`, with its migration (decision
10). The data is in `listings`, `categories`, `phone_numbers`, `opening_hours`, `services` and `user_reports`.

## In scope

- `GET /listings/{slug}` and the `ListingDetail` shape, with the changes listed in decisions 1 to 10.
- The `is_whatsapp` column on `phone_numbers`: model, an Alembic migration (safe on a table that already has rows), and the
  field in each phone of `ListingDetail`.
- A repository function that loads the listing and everything that belongs to it in a fixed number of queries.
- A service that builds the answer: the 7 opening-hours entries, the primary phone first, the open-now flag, `hours_note`, the
  overdue flag and the "recently reported" flag, using the existing rules of `search_service` and `hours`.
- The api-spec text for all of it (Task 0).

## Out of scope (planned elsewhere)

- **The page** (`/listing/[slug]`), the Call, Directions, Share and Report buttons, the 12-hour display, the fee wording and the
  notice text: phase 6b. The owner's decisions for it are recorded below so they are not lost.
- **Creating the reports** that set `recently_reported_not_working` (`POST /reports`, FR-20, FR-21) and the urgent flag for
  staff (FR-22): phase 9. Until then the field is `false` for real data and is tested with rows made by the tests.
- **Staff and provider listing endpoints** (`GET /listings`, `GET /listings/id/{listing_id}`, create, edit, publish): phase 10.
  That includes the screens and the payloads that set `is_whatsapp`. Until then every number is `false`.
- **Listing views as an analytics event** (the PRD's "Analytics" section): not built yet; the endpoint writes nothing.
- **Server-rendered listing pages for Google** (NFR-12): after the Render upgrade (`LOG.md`).

## Decisions (owner, 2026-10-11)

1. **`hours_note` is filled.** The detail uses the same function as `/search`, so the page can show "Closes 9:00 PM".
2. **A day with no hours is closed.** A missing row, a closed row and a row without times all come back as
   `is_closed: true` with null times. `opening_hours` always has 7 entries, Monday first. Reason: the page needs one rule and
   a seven-row table; "not recorded" and "closed" look the same to a resident who needs the place now.
3. **A reported listing stays reachable, with a flag.** A listing hidden from search by 2 reports in 7 days still opens from a
   direct link. The answer carries `recently_reported_not_working: true` so the page can warn. The field is new in the
   api-spec; it uses the search rule (same window, same count, different reporters only), through the same query, so the two
   cannot disagree. A 404 was considered and left out: someone with the link needs the number, and the warning is the safe
   part.
4. **Times are `HH:MM` in the API.** The 12-hour form belongs to the page.
5. **The primary phone first, then by `id`.** The number of the first primary phone is `primary_phone`. (`/search` also uses the
   primary flag; with two primary numbers it did not choose between them, the detail does, by `id`.)
6. **Fees as stored.** Strings with 2 decimals or `null`; the API does not fill a missing maximum.
7. **Published only, and the same 404 for everything else.** Draft, pending, hidden, re-check due and unknown slugs return
   `404 {"detail": "Listing not found"}`, so the public learns nothing about unpublished listings.
8. **Read only.** No audit entry, no write, no log of who looked.
9. **Layers.** Route (HTTP only) calls `listing_service`, which calls `listing_repository`. The report rule is the query
   `flagged_listing_ids` of `search_repository`, used by one new listing function (a small coupling between two repositories;
   phase 9 moves it to a report repository). The window (7 days) and the count (2) are the constants of `search_service`.
10. **`is_whatsapp` on each phone (owner, 2026-10-11; FR-47).** A new boolean column on `phone_numbers`, `NOT NULL`, default `false`.
    - **Migration:** a new Alembic revision adds the column with a server default of `false`, so the rows that already exist
      (production has demo listings) become `false` and the migration can run on a filled table. The downgrade drops the
      column. The model declares the same default, so `alembic revision --autogenerate` finds no difference afterwards.
    - **Seed and demo data keep `false`.** Even a fictional number can belong to a real person who uses WhatsApp, so no
      seeded or demo number is ever marked as a WhatsApp number, and the seed code does not set the field. A test checks it.
      Tests that need a WhatsApp number create their own row.
    - **Nothing is guessed.** The flag is only what staff or the provider said; it is not worked out from the number.
    - **Its own task,** before the repository work (the plan, Task 1), because it changes a model and the database.

## Owner's decisions for phase 6b (recorded now; they go into the UI spec in 6b, Task 0)

1. **The page loads in the browser,** like `/search` (skeleton, "waking up" after 5 s, Retry after 45 s), because the free API can
   take a minute to wake and Netlify gives up on a server page after about 30 s. Server rendering for Google comes after the
   Render upgrade (`LOG.md`).
2. **The entrance photo is a plain `<img>`,** shown only when `entrance_photo_url` starts with `https://`, with fixed width and
   height, lazy loading, and always alt text. `next/image` and its `remotePatterns` wait for the Cloudinary phase.
3. **Share (FR-12):** a WhatsApp link and a copy-link button. The shared link is only ever the page's own `/listing/<slug>` (the
   site address and that path: no filters, no position, no query).
4. **Times on the page are 12-hour,** like the cards: "8:00 PM – 2:00 AM (next day)". Today is highlighted in Lagos time.
5. **Fees:** only a minimum shows "From ₦1,500"; equal minimum and maximum shows "₦1,500"; no fee hides the line; no date hides
   the date; the label "Estimate — confirm with the facility" always shows.
6. **The notice:** when `recently_reported_not_working` is `true`, the top of the page says "Recently reported as not working.
   Call before you go."
7. **Primary phone first** with the big Call button; the other numbers each have their own Call button.
8. **404 page:** "This listing isn't available. It may be under re-verification." with a link to search (UI spec 2.4).
9. **WhatsApp button (owner, 2026-10-11; FR-47, a Should).** *(Replaced on 2026-10-13 by D2 and D4 of `specs/2026-10-13-listing-page/requirements.md`:
   the official glyph (the owner's file) instead of a generic bubble, Option A, and the message "Hello, I found you on SwiftHealth Route." The rest below still holds.)*
   - Beside **Call**, for the numbers with `is_whatsapp: true` only. Call stays the primary (filled) button; WhatsApp is a
     secondary button. A number that is not marked gets Call alone. The listing page only: a card or a map popup has just
     `primary_phone`, with no flag, and does not change.
   - The icon is a generic chat bubble (lucide `MessageCircle`), never the WhatsApp logo. The word "WhatsApp" is the label.
   - The link is `https://wa.me/<number>?text=<message>`, the number in international form with no `+`: a stored
     `+2348030000000` gives `2348030000000`, and a local `08030000000` gives `2348030000000`. Anything that is not a Nigerian
     number of 10 digits after `234` (or after the leading `0`) gives no button. The function that converts is tested on its
     own (the plus form, the local form, the plain form, spaces and dashes, and the wrong lengths).
   - The pre-filled message is exactly "Hello, I found you on SwiftHealth." (URL-encoded). It never holds a position, a
     slug or anything else. The link opens in a new tab with `rel="noopener noreferrer"`.
   - Before building, check the `wa.me` format against WhatsApp's own "click to chat" help page, and write the page's address in
     the 6b requirements (CLAUDE.md: never invent another service's fields).
10. **A new Directions icon, everywhere (owner, 2026-10-11).** A diamond road sign with a right-turn arrow, on the cards, in
    the map popups and on the listing page. `lucide-react` 1.47.0 has no such icon (it has `Diamond` and `CornerUpRight`
    separately: checked on 2026-10-11), so it is drawn in code as a small component of our own: a diamond outline with a
    right-turn arrow inside, 24 × 24, `currentColor`, hidden from screen readers like the other icons. It is not Google's
    icon. The button's word "Directions" and its accessible name do not change.
