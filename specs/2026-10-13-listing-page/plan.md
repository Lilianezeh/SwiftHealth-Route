# Plan: the listing page (phase 6b)

Spec: [requirements.md](requirements.md). Validation: [validation.md](validation.md). Branch `feature/listing-page`.
**Nothing below is built yet.** The plan starts only after the owner reviews the requirements and answers the open questions
(button look, official icon file, cards, help page, share message, 24-hour listings). Boxes are ticked with their commit hash at the end of
the feature, once, together with the roadmap and `LOG.md`.

Files that will change or appear (frontend unless written otherwise):
- `components/listings/DirectionsIcon.tsx` (new), `DirectionsButton.tsx` (uses it): the road-sign icon, everywhere.
- `lib/formatters/whatsapp.ts` (new): the number for wa.me, the contact link, the share links.
- `lib/formatters/hours.ts` (new): 12-hour times, the 7 rows, today in Lagos time. `lib/formatters/fees.ts` (new): the fee line.
- `lib/api/listing.ts` (new): `getListing(slug)` through `requestJson`; `types/api.ts`: `ListingDetail`, `Phone`, `OpeningHours`, `Service`.
- `components/listing/` (new folder): `ListingDetailView` (client), `ListingSkeleton`, `ListingNotFound`, `ReportedNotice`, `ContactButtons`,
  `WhatsAppButton`, `OtherPhones`, `HoursTable`, `ServicesFees`, `EntrancePhoto`, `ShareButtons`.
- `app/(public)/listing/[slug]/page.tsx` (the existing placeholder becomes the shell), `styles/globals.css` (`whatsapp-dark`, `whatsapp`),
  `public/images/brand/` (the official WhatsApp glyph, unmodified: from the owner).
- `backend/seed/whatsapp_fixture.py` (new, local only) and its test in `backend/tests/`.
- `tests/unit/` for each piece and `tests/end-to-end/listing-page.spec.ts` (Playwright).
- Docs (after the owner's review): `specs/frontend/ui-spec.md` section 2.4, `specs/roadmap.md`, `LOG.md`.

## Tasks (tests first in every task)

### Task 0: the spec
- [x] `requirements.md`, `plan.md`, `validation.md` written (the three feature files only, 2026-10-13); the owner reviews.
- [ ] After the owner's review and answers: update `specs/frontend/ui-spec.md` section 2.4 (it still has the older text), mark decision 9 of
  `specs/2026-10-11-listing-detail-api/requirements.md` as replaced by D2 and D4 here, and update the roadmap's 6b block. Spec first, then code.

### Task 1: the Directions icon (D5)
- [ ] Tests first: `DirectionsIcon` is 24 × 24, `currentColor`, `aria-hidden`, a diamond and an arrow, no other file imports lucide `Route`
  for Directions; `DirectionsButton`, `ListingCard` and `MapPopup` render the new icon; the button's name is unchanged.
- [ ] Draw the SVG, render it at 24, 32 and 64 px on white and on the `pine` button, **show the owner, wait for approval**, then wire it into
  `DirectionsButton` (cards, popups and the page get it at once).

### Task 2: pure helpers (D2, D4, D6)
- [ ] Tests first, then code: `toWhatsAppNumber` (plus, local, bare, spaces and dashes, wrong lengths, a non-Nigerian number gives none),
  `whatsAppContactUrl` (the exact message), `whatsAppShareUrl`, `shareLink(slug, origin)` (never a query or a hash);
  `formatTime12` (midnight, noon, 9:05, 23:59), `hoursRows` (7 rows, past midnight "(next day)", closed, today in Africa/Lagos, near midnight in
  Lagos while the device is elsewhere), `formatFee` (range, equal, minimum only, none, with and without the date).
- [ ] Open the WhatsApp help page in a browser (owner or me), confirm the number-format sentence, and quote it in the test's comment.

### Task 3: the API call and the types (D8, D9)
- [ ] Tests first: `getListing` requests `/listings/<slug>` with the slug URL-encoded and **no query string**, maps 404 to a "not found" result
  and the other errors as `/search` does (timeout, network, server); the "waking up" and "Retry" times are the existing 5 s and 45 s.

### Task 4: the components (D1, D2, D6, D7)
- [ ] Tests first for each: `ContactButtons` (Call always; WhatsApp only when `is_whatsapp`; the primary first; other phones each with their
  own buttons; Directions hidden for a position that is not real, as today), `WhatsAppButton` (the link, the name, the colour classes of the
  option the owner picked, the contrast pairs in `design-tokens.test.ts`, the glyph is an `<img>` with empty alt), `HoursTable` (12-hour, today
  marked with a word, "Open 24 hours"), `ServicesFees` (the five fee cases, the estimate words once, no date), `ReportedNotice` (the words, `role="note"`,
  amber, not red), `EntrancePhoto` (https only, alt, lazy, fixed size, vanishes on error), `ShareButtons` (the link, the clipboard fallback,
  "Link copied" `role="status"`), `ListingNotFound` (the words, the button).
- [ ] Add `whatsapp-dark` (and `whatsapp` for the fallback) to `globals.css` and the token tests.

### Task 5: the page (D8, D9, D10)
- [ ] Tests first: the shell shows the skeleton; the page shows a listing from a mocked answer (every field of FR-09); a 404 shows "Listing not found"
  with the Search button; a slow answer shows the waking notice; a failure shows Retry; the title changes; the page asks for nothing but
  `/listings/<slug>`; a position in `sessionStorage` never appears in any link or message; every link has `prefetch={false}`; the page's source
  imports no Leaflet and no `next/image`.
- [ ] Wire `ListingDetailView` into `app/(public)/listing/[slug]/page.tsx`.

### Task 6: the local fixture (D11)
- [ ] Tests first (backend, pytest): the fixture adds one listing with the fictional slug, two phones (one WhatsApp), the five fee cases, a
  past-midnight day, a closed day and two reports; running it twice changes nothing; it refuses when `APP_ENV=production`; it touches no
  other row; `seed.seed` and the production demo data still have `is_whatsapp = false` everywhere. Then the code. (This is the only backend
  change, so `Backend CI` will run on this pull request.)

### Task 7: real browser
- [ ] `tests/end-to-end/listing-page.spec.ts` against the fixture: at 320, 375, 768 and 1024 px no sideways scroll; the WhatsApp button only on
  the marked number; the Call button is the largest; 12-hour hours with today marked; the notice; the photo; the share and copy buttons
  and the exact shared link; the 404 page; no script with "leaflet" and no request with a position in it (the network log is searched
  for the fixture's coordinates and for `lat=` and `lng=`).

### Task 8: wrap-up
- [ ] `npm run lint`, `typecheck`, the whole suite, the build (First Load JS for the route at or under 115 kB, own JS under 8 kB) and the
  backend tests and `ruff`, one at a time, in the containers.
- [ ] Update the UI spec 2.4 (done in Task 0), the roadmap and `LOG.md` once; fill `validation.md`; open a **draft** pull request that stays a draft
  until the merge checklist is ticked; wait for the owner's check of the preview.
