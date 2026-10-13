# Requirements: the listing page (phase 6b)

Branch `feature/listing-page`. Status: **spec written, waiting for the owner's review. No code yet.**
Roadmap: phase 6b (6a, the API `GET /listings/{slug}`, is merged: PR #20). Frontend and one local-only seed fixture; no API change.

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| US-02 | Call a facility with one tap | Must |
| US-03 | Get directions to a facility | Must |
| US-06 | See services, hours and estimated fees | Must |
| US-07 | See when a listing was last verified | Must |
| FR-09 | The page shows name, category, address, landmark, phones, opening hours by day, services, fee ranges with the date collected, entrance photo, last-verified date | Must |
| FR-10 | A Call button for each phone number; a Directions button (Google Maps, from the listing's GPS pin) | Must |
| FR-11 | Fees are always labelled "Estimate — confirm with the facility" | Must |
| FR-12 | Share the listing via WhatsApp or copy the link | Should |
| FR-13 | The disclaimer on every listing | Must |
| FR-47 | A WhatsApp button beside Call for each number marked as WhatsApp (wa.me link, no location in the message) | Should |
| FR-22 | A contact reported "not working" by 2 people in 7 days is flagged: the page warns, the listing is still shown | Must |
| NFR-01 | Small and fast: this page must not load the map | Must |
| NFR-07 | Privacy: no location in any address or message | Must |
| NFR-10 | 48 px targets, 16 px text, contrast, screen readers | Must |
| NFR-12 | Each listing has its own address (the page exists; Google rendering waits for the Render upgrade, `LOG.md`) | Should |

The API (`GET /listings/{slug}`, `specs/backend/api-spec.md`) already returns everything: `ListingDetail` = the summary (`name`, `category`,
`area`, `address`, `latitude`, `longitude`, `is_open_now`, `is_24_hours`, `hours_note`, `last_verified_at`, `verification_due`, ...) plus
`landmark`, `description`, `entrance_photo_url`, `phones[]` (`number`, `label`, `is_primary`, `is_whatsapp`; the primary first),
`opening_hours[]` (always 7, Monday first, `opens_at` / `closes_at` as "HH:MM", `is_closed`), `services[]` (`name`, `fee_min_naira`,
`fee_max_naira`, `fee_collected_at`), `recently_reported_not_working`, `disclaimer`. A slug that is unknown or not published answers
404 `{"detail": "Listing not found"}`. **This phase changes no API and no table** (still 9 tables).

The owner's earlier decisions for 6b are in `specs/2026-10-11-listing-detail-api/requirements.md` ("Owner's decisions for phase 6b", 1 to 10).
This file keeps them, and **replaces decision 9** (the icon and the message of the WhatsApp button) and decision 3's message (see D4 and D7).

## Decisions

### D1. The buttons: Call stays the main button
- **Call** is the big primary button (the existing `CallButton`, `bg-pine`, white text, 56 px high on this page) for the **primary phone**,
  which the API returns first. It never moves, never changes colour, and nothing is more prominent than it.
- **WhatsApp** (D2) sits **beside** Call, only for a phone whose `is_whatsapp` is `true`. **Directions** (D5) comes next (full width
  below Call and WhatsApp). A phone that is not marked gets Call alone.
- **Other phones** (`phones[1..]`) each have a line with the label ("Front desk"), the number and **their own Call button** (and a WhatsApp
  button if that number is marked). All buttons are at least 48 px high with 16 px text.
- Layout: the buttons wrap (`flex-wrap`, each at least 8.5 rem wide), so on a 320 px screen WhatsApp drops under Call instead of
  being squeezed. No sideways scroll (a real-browser check).

### D2. The WhatsApp button (FR-47), with two looks for the owner to choose from
**Link.** `https://wa.me/<number>?text=<message>` with the number in international form, digits only (no `+`, no spaces, no dashes, no
leading zero): a stored `+2348030000000` and a local `08030000000` both give `2348030000000`. The function that converts is new, pure and
tested on its own (the `+234` form, the local `0803` form, the bare `234` form, spaces and dashes, and wrong lengths give no button).
It is built on the existing `toE164` rule: a Nigerian number is `234` and ten digits. The link opens in a new tab with
`rel="noopener noreferrer"`. Its accessible name is "WhatsApp <facility name> (opens in a new tab)".
**Message** (exactly, URL-encoded): `Hello, I found you on SwiftHealth Route.` (the name comes from `config/brand.ts`). It never holds a
position, a slug, a name or anything else.

**Official source for the link format** (CLAUDE.md: never invent another service's fields):
WhatsApp Help Center, "How to use click to chat": <https://faq.whatsapp.com/5913398998672934>. As summarised by a search of that page on
2026-10-13: the link is `wa.me/<number>`; the number is the full phone number in international format; zeroes, brackets and dashes are
left out; a prefilled message is `https://wa.me/<number>?text=<urlencodedtext>`; the number must have an active WhatsApp account. **Caveat:**
that page is drawn by JavaScript and its full text could not be fetched here, so before Task 2 the owner or I open it in a browser and
confirm the sentence about the number format; the unit tests then quote it. (Meta also documents `wa.me/message/<code>` short links for
businesses, which hide the number, but those need a WhatsApp Business setup per listing and are not used here.)

**The icon: what WhatsApp's brand guidelines say.** Page: "WhatsApp brand assets and guidelines" (Meta Brand Resource Center),
<https://www.whatsappbrand.com/> (it redirects to <https://www.meta.com/en-gb/brand/resources/whatsapp/whatsapp-brand/>). Read on 2026-10-13:
- Only the official assets may be used: "You can only use the official WhatsApp Brand Resources that are available from the WhatsApp Brand
  Resources website", and "you may not modify the WhatsApp Brand Resources in any way" (no recolouring: "You shouldn't modify any colours in
  our logos"). They may be scaled "as long as they are not the most distinctive or prominent feature on your web page".
- Do not "combine the WhatsApp name or logos ... with any other logo, company name, mark or generic terms"; do not "use an image
  confusingly similar to the WhatsApp telephone logo"; do not imply "partnership, sponsorship or endorsement by WhatsApp"; write the
  name "WhatsApp" with a capital W and A, never abbreviated, in the same font size and style as the text around it.
- The page gives no hex value, no clear-space rule and no minimum size, and says nothing specific about a "chat on WhatsApp" button
  (search results mention a branded "Chat on WhatsApp" button in green and white on the help centre, which I could not open).
- **So the official icon may be used to link to a chat, if it is the official, unmodified file.** That is the plan: the **official WhatsApp
  glyph, unchanged**, with the label "WhatsApp" (plain text, same size as the other buttons' labels).
- **Needs the owner:** I cannot download the official files (the brand site serves them behind its own download page). The owner
  downloads the glyph (the green one, and the white one if Option B is chosen) from the brand resources site and gives me the files; I
  add them **unmodified** as `<img>` files under `frontend/public/images/brand/` (no recolouring, no inline editing). The owner also reads
  the site's terms before launch (NFR-13); this spec makes no legal claim about them.
- **Fallback, only if the owner cannot or does not want to use the official file:** a plain green chat bubble (lucide `MessageCircle`,
  never a handset, so not "confusingly similar to the WhatsApp telephone logo") in `#25D366` (the green commonly used for WhatsApp; the
  brand pages I could read do not state a hex value), with the label "WhatsApp". The button works the same.

**The look: the button must be green. Two options for the owner to pick.** Contrast is computed (WCAG: text 4.5:1; a button edge or an
icon next to its label 3:1 is enough, and the label carries the meaning).

| | Option A: white button, green icon, dark text | Option B: dark green button, white text |
| --- | --- | --- |
| Button | white background, 2 px border `#075E54` (7.67:1 on white), 12 px radius, like the secondary button | background `#075E54`, no border |
| Icon | the official green glyph (about 1.98:1 on white: it is a picture beside the label, not text) | the official glyph in the variant meant for a dark background, if the asset pack has one (to confirm); else white |
| Label "WhatsApp" | `ink` `#1D2421`: **15.83:1** on white (or `pine-dark` 8.92:1) | white: **7.67:1** on `#075E54` |
| Hover / press | background `open-bg` `#E7F6ED` (label stays 15:1) | background `#054740`; white on it 10.6:1 |
| Looks like | the existing secondary buttons, with a green accent | a strong green block, as prominent as Call |
| Risk | the glyph's green is only a small accent; it reads as "WhatsApp" because of the icon and word | being as heavy as Call can compete with it (the brand page also asks that WhatsApp is not the most prominent thing) |

My recommendation: **Option A.** Call stays the clear main button (decision D1) and the official glyph keeps its own colours, which the
brand rules ask us not to touch. Plain `#25D366` with white text is **not** an option: white on it is only 1.98:1.
New tokens if chosen: `whatsapp-dark` `#075E54` (both options), `whatsapp` `#25D366` (the fallback icon only); `design-tokens.test.ts`
checks every pair above.

### D3. WhatsApp on the search result cards: a proposal, to be decided by the owner
The cards and the map popups have only `primary_phone` (a string): `ListingSummary` has no `is_whatsapp`, so today they cannot know.
- **Proposal: not in this phase.** A card would need an API change (`primary_phone_is_whatsapp` on `ListingSummary`, filled by the same
  query that fills `primary_phone`; search, emergency and blood results share the shape) and a third 48 px button on a card that already has
  Call and Directions (on a 320 px screen it would not fit in one row; it would have to be an icon-only button with the accessible name
  "WhatsApp <name>"). The result list is the page that has to stay light and calm.
- **Alternative, if the owner wants it:** a small icon-only WhatsApp button (48 × 48, the official glyph) after Call and Directions on
  the cards (the popups stay as they are), as its own small phase with a backend change, tests first.
- **Question for the owner:** keep WhatsApp on the listing page only (recommended), or add the small card button as a follow-up?

### D4. Share (FR-12) and the link that is shared
- Two buttons under the contact buttons: **"Share via WhatsApp"** and **"Copy link"** (secondary buttons, 48 px; lucide `Share2` and
  `Link` icons, decorative). The share button is plain text with a neutral icon, not the WhatsApp glyph, so WhatsApp's mark appears once on the
  page (the brand rule about prominence).
- The shared link is **only** `<site address>/listing/<slug>`: built with `new URL("/listing/" + slug, window.location.origin)`, so it never
  carries a query, a hash, a position or anything else even if the visitor opened the page with one. "Share via WhatsApp" opens
  `https://wa.me/?text=<message>` (no number: WhatsApp then asks who to send it to, per the help page) in a new tab with
  `rel="noopener noreferrer"`; the message is `<facility name> on SwiftHealth Route: <the link>` (URL-encoded). "Copy link" uses
  `navigator.clipboard.writeText`; when it is not available or refuses, the link is shown in a read-only field to copy by hand. A line that
  says "Link copied" (`role="status"`) confirms.
- Tests check the link is exactly `/listing/<slug>` for a page opened with `?lat=6.45&lng=7.5#x`, and that neither message holds a coordinate.

### D5. Directions: a new road-sign icon, everywhere
- A diamond road sign with a right-turn arrow, **drawn in code** as one small component of our own (`DirectionsIcon`): 24 × 24,
  `currentColor`, a rounded diamond outline with the arrow inside, `aria-hidden`, not Google's icon, and not a copy of any lucide icon.
  `lucide-react` 1.47.0 has `Diamond` and `CornerUpRight` separately but no such icon (checked 2026-10-11).
- It replaces the lucide `Route` icon in the one shared `DirectionsButton`, so it changes **everywhere at once**: the result cards, the
  map popups and the new page. The word "Directions" and the accessible name ("Directions to <name> (opens in a new tab)") do not change.
- **The owner sees the drawn icon before it is used** (as with the logo): Task 1 draws it, renders it at 24, 32 and 64 px on white and on
  the `pine` button, and shows it; only then is it wired in.
- The Directions link uses the **facility's** latitude and longitude as the destination, never the visitor's position (privacy, D9).

### D6. Opening hours, fees, notice, disclaimer, verification
- **Hours table (FR-09, US-06):** seven rows, Monday first, in 12-hour time: `8:00 AM – 5:00 PM`; midnight is `12:00 AM`, noon `12:00 PM`;
  a shift past midnight reads `8:00 PM – 2:00 AM (next day)`; a closed day reads `Closed`. When `is_24_hours` is true the section says
  **"Open 24 hours"** instead of the table. **Today's row is highlighted** (a stronger weight and a "Today" word, not colour alone), today
  being the day in **Africa/Lagos** time, not the visitor's device time. The API sends `HH:MM`; a pure function converts (tested: noon,
  midnight, 9:05, past-midnight, closed).
- **`hours_note`** ("Closes 9:00 PM", "Opens Monday 7:30 AM") and the `OpenNowBadge` show at the top, as on the cards.
- **Fees (FR-11, owner decision 5):** per service a line: both limits `₦1,500 – ₦3,000`; equal limits `₦1,500`; only a minimum
  `From ₦1,500`; no fee hides the fee line; with `fee_collected_at` the line adds "collected 28 Sep 2026", without it the date is hidden.
  The words **"Estimate — confirm with the facility"** always show once above the services. Money arrives as strings ("1500.00") and is
  formatted as text; it is never turned into a float for calculation.
- **The notice (FR-22, decision 6):** when `recently_reported_not_working` is `true`, the top of the page shows
  **"Recently reported as not working. Call before you go."** in the amber notice style (the tokens `amber-ink` on `amber-wash`, 5.3:1, with a
  lucide `TriangleAlert` icon; never red, which belongs to emergencies). It is a `role="note"`; the listing, the Call button and the
  rest stay as they are.
- **Last verified (US-07):** the existing `VerifiedDate` ("Verified 3 days ago") and, when `verification_due` is `true`, the "Verification
  due" label of the cards.
- **Disclaimer (FR-13):** the API's `disclaimer` text, at the bottom, 16 px.
- **Report link:** "Report a problem with this listing" to `/report/<id>` (that page is a placeholder until its phase).
- **No medical advice anywhere** (CLAUDE.md); the page says what the facility is and when it is open, nothing else.

### D7. The entrance photo
Shown only when `entrance_photo_url` starts with `https://` (anything else, including `http://` and `javascript:`, shows nothing). A plain
`<img>` (not `next/image`: its `remotePatterns` wait for the Cloudinary phase) with fixed `width` and `height` (so the page does not
jump), `loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`, a rounded frame, and **always alt text**:
"Entrance of <facility name>". If the photo fails to load, the frame disappears. No photo means no empty box.

### D8. How the page loads: in the browser, like `/search`; a friendly "not found"
- The route `app/(public)/listing/[slug]/page.tsx` is a small server page that renders the shell and a client component
  (`ListingDetailView`) which calls `GET /listings/{slug}` through the existing `requestJson` helper: **a skeleton** at once,
  "The service is waking up" after 5 s, a **Retry** after 45 s (owner decision 1; the free API can take a minute, Netlify gives up on a
  server page after about 30 s). The request has **no query string at all**. Server rendering for Google waits for the Render upgrade (`LOG.md`).
- **404 from the API** shows a friendly page, not a blank or an error: the heading **"Listing not found"**, the text "This listing isn't
  available. It may be under re-verification.", a button **"Search for care"** to `/search` and a link to the home page. The HTTP status
  of the page itself stays 200 (it is a browser-loaded shell); the words and the buttons are what the visitor sees.
- Other failures (network, timeout, 5xx) show the same "could not load" message with Retry as `/search` does.
- The tab title becomes "<facility name> | SwiftHealth Route" once loaded (`document.title`), and "Listing not found | SwiftHealth Route"
  for the 404 page.

### D9. Privacy (NFR-07): no location in any address or message
- The page never reads the visitor's position (it does not touch `sessionStorage`'s position) and the API request has no `lat` or `lng`
  (so `distance_km` is `null` and the page does not show a distance).
- No address the page builds holds a position: the page's own address, the share link, the WhatsApp contact link and the WhatsApp share
  message are all fixed shapes (D2, D4). The Google Maps link holds only the **facility's** coordinates.
- Tests: the request URL has no `?`; the four links above contain no digits that look like a coordinate (a test renders the page with a
  position in `sessionStorage` and checks it does not appear anywhere).

### D10. Small and fast (NFR-01), and no map
- No Leaflet, no chart code, no `next/image` client code on this page. The page's own JavaScript stays under **8 kB** sent
  (`/search` is 7.5 kB as built; this page has less to do), and `npm run build`'s First Load JS for the route stays at or under
  **115 kB**. The WhatsApp glyph is an `<img>` file (no JavaScript). Every link on the page has `prefetch={false}` (the same rule as the
  home page), so the page downloads no other page's code before it is asked for.
- A real-browser check (Playwright, on a production build) loads the page and fails if any script contains "leaflet" or comes from the
  search page's chunk.
- The header and footer come from the `(public)` layout (server components), as for every public page.

### D11. Demo data stays honest; a clearly fictional fixture for local testing
- The seed and the production demo listings keep `is_whatsapp = false` for every number (no change).
- A **local-only fixture**, `backend/seed/whatsapp_fixture.py` (run with `docker compose exec backend python -m seed.whatsapp_fixture`),
  adds **one** listing marked fictional in its name and description ("TEST FIXTURE (fictional): WhatsApp demo clinic"), with a unique slug
  `test-fixture-whatsapp-clinic`, one primary number that is a WhatsApp number and a second that is not, fees of every kind (a range, a single value, a
  minimum only, none), a past-midnight day, a closed day, `recently_reported_not_working` set through two fictional reports, and an
  `https` entrance photo from a neutral placeholder. The numbers use the same impossible form as the main seed (`+234` then zeros, which
  can never be real, so a wa.me link cannot reach a real person). It refuses to run when `APP_ENV` is `production`. It does not touch any
  other row, and it is **not** part of `seed.seed` or the production demo data. It adds no table.
- Because the fixture numbers are impossible numbers, WhatsApp will say the number is not on WhatsApp when the owner taps the button locally:
  that is expected; the owner checks the link and the look, not a chat.

## Out of scope for 6b
Server rendering for Google (after the Render upgrade); the report form's real page; a map on this page; editing; featured placement;
distance on this page; photos upload (Cloudinary phase); the card WhatsApp button (D3, unless the owner asks); Igbo.

## Open questions for the owner (this review)
1. **Button look:** Option A (white, green icon, dark text; recommended) or Option B (dark green, white text)?
2. **Official icon:** please download the official WhatsApp glyph file(s) from the brand resources site and hand them over (or tell me to use
   the fallback bubble). I cannot download them.
3. **Cards:** WhatsApp on the listing page only (recommended), or also a small card button as a follow-up (needs an API field)?
4. **Help page:** open <https://faq.whatsapp.com/5913398998672934> once in a browser and tell me if the number-format sentence matches (I could not read it here).
5. **Share message:** "<name> on SwiftHealth Route: <link>" is fine, or other words?
6. **24-hour listings:** "Open 24 hours" instead of the table is fine, or show the seven rows anyway?
