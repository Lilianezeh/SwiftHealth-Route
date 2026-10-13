# Validation: the listing page (phase 6b)

Spec: [requirements.md](requirements.md). Plan: [plan.md](plan.md). **Nothing is built yet: every box is open.** Boxes are ticked at the end
of the feature, with the evidence, after the owner has checked the preview. Check this file before saying the feature is done.

## Requirements checked by tests

- [ ] **US-02, FR-10, D1:** Call is the primary button; it is the largest; the primary phone is first; each other phone has its own Call button
- [ ] **FR-47, D2:** the WhatsApp button appears only for a phone with `is_whatsapp: true`; none when false; the link is exactly
  `https://wa.me/2348030000000?text=Hello%2C%20I%20found%20you%20on%20SwiftHealth%20Route.` for `+2348030000000` and for `08030000000`
  (the conversion is tested on its own: plus, local, bare, spaces, dashes, wrong lengths give no button); it opens in a new tab with
  `rel="noopener noreferrer"`; its accessible name says the facility and "opens in a new tab"
- [ ] **D2, the icon:** the official WhatsApp glyph is used unmodified as an `<img>` file with empty alt (or, only if the owner chose it, the green
  chat bubble fallback); the label is "WhatsApp"; the glyph appears once on the page
- [ ] **D2, the look and the contrast:** the button is green in the owner's chosen option; every pair in the spec passes in
  `design-tokens.test.ts` (A: `ink` on white 15.83:1, border `#075E54` on white 7.67:1; B: white on `#075E54` 7.67:1, hover 10.6:1); no white text on `#25D366`
- [ ] **US-03, D5:** one `DirectionsIcon` (a diamond road sign with a right-turn arrow, drawn in code) is used by the result cards, the map popups and the
  listing page; no other Directions icon is left; the accessible name is unchanged; the link holds the facility's coordinates only
- [ ] **US-06, FR-09, D6:** hours in 12-hour time; midnight is 12:00 AM and noon 12:00 PM; past-midnight shows "(next day)"; closed days say Closed;
  "Open 24 hours" replaces the table for a 24-hour listing; today's row is marked with a word, by Lagos time (a test with the device clock in another zone
  near midnight in Lagos)
- [ ] **FR-11, D6:** the five fee cases (range, equal, minimum only, none, with and without the date); "Estimate — confirm with the facility" shows once
- [ ] **FR-22, D6:** "Recently reported as not working. Call before you go." shows when the flag is true, in the amber style with an icon, never red;
  the rest of the page is unchanged; it is absent when false
- [ ] **US-07, FR-13, D6:** the verified date, the "Verification due" label when `verification_due`, the API's disclaimer
- [ ] **D7:** the entrance photo shows only for an `https://` address; `http://`, `javascript:` and an empty value show nothing; alt text always; lazy;
  fixed size; the frame disappears if the photo fails
- [ ] **FR-12, D4:** "Share via WhatsApp" and "Copy link"; the shared link is exactly `<origin>/listing/<slug>` even when the page was opened with
  `?lat=6.45&lng=7.5#x`; no message holds a coordinate; the clipboard failure shows the link to copy by hand; "Link copied" is a `role="status"`
- [ ] **D8:** the skeleton, "The service is waking up" after 5 s, Retry after 45 s; a 404 shows "Listing not found", "This listing isn't available. It
  may be under re-verification." and a "Search for care" button; other failures show Retry; the tab title is "<name> | SwiftHealth Route"
- [ ] **NFR-07, D9:** the API request has no query string; a position stored in `sessionStorage` appears in no link, no message and no request
- [ ] **NFR-01, D10:** the page's source imports no Leaflet, no chart code and no `next/image`; every link has `prefetch={false}`; the built route is within
  its budget (own JS under 8 kB, First Load JS at or under 115 kB)
- [ ] **NFR-10:** every button and link is at least 48 px high; text is 16 px or more; the focus ring is visible; one `h1`; the heading levels are in order;
  every icon is hidden from screen readers; the buttons wrap instead of overflowing at 320 px
- [ ] **D11:** the fixture adds the one fictional listing and nothing else; running it twice changes nothing; it refuses when `APP_ENV=production`;
  the seed and the production demo data keep `is_whatsapp = false`

## Real browser (Playwright, on a production build with the fixture)

- [ ] No sideways scrolling at 320, 375, 768 and 1024 px
- [ ] The WhatsApp button is only on the marked number; Call is the biggest button
- [ ] No script downloaded by the page contains "leaflet" or comes from the search page; the network log holds no `lat=`, no `lng=` and none of the fixture's coordinates
  except in the Google Maps link
- [ ] The 404 page for an unknown slug

## Commands (in the containers)

- [ ] `docker compose exec frontend npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- [ ] `docker compose exec backend pytest -q` and `docker compose exec backend ruff check .`

## Merge checklist

- [ ] Lint, typecheck, the unit tests and the build are clean; the numbers are written here
- [ ] On the draft pull request, `Frontend CI` and `Backend CI` are green (the backend part is only the fixture)
- [ ] The UI spec 2.4, the roadmap and `LOG.md` are up to date
- [ ] **The owner checked the preview** (the look of the WhatsApp button in the chosen option, the Directions icon on the cards, the popups and the page, the 12-hour hours,
  the notice, the share buttons, the 404 page) and the pull request stays a draft until every box above is ticked

## Security and privacy checklist

- [ ] No new package; no `dangerouslySetInnerHTML`; every text is rendered as text (the facility's name and description are data from our own API)
- [ ] The photo address is only used when it starts with `https://`
- [ ] External links use `rel="noopener noreferrer"`
- [ ] The official WhatsApp files are unmodified; the owner has read the brand site's terms (NFR-13); this repo makes no legal claim about them
- [ ] No position of the visitor in any address or message (D9)
