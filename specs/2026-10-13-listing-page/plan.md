# Plan: the listing page (phase 6b)

Spec: [requirements.md](requirements.md). Validation: [validation.md](validation.md). Branch `feature/listing-page`.
**Built on 2026-10-13, waiting for the owner's preview check.** The owner answered the six questions (see `requirements.md`), approved the
Directions icon at 24 px, and Tasks 1 to 7 are done in these commits: Task 1 `8be3083`; Tasks 2 and 3 `11ac28b`; Task 4 `0ab68aa` (the
building blocks) and `630ea4a` (the components); Task 5 `54c9b45`; Task 6 `da4e8a2` and `e5d85e3`; the disclaimer rename `54dcf65`; Task 7
`57618d3`. As with the home page, the boxes below are ticked with their commit hash only after the owner has checked the preview (Task 8).

Files that will change or appear (frontend unless written otherwise):
- `components/listings/DirectionsIcon.tsx` (new), `DirectionsButton.tsx` (uses it): the road-sign icon, everywhere.
- `lib/formatters/whatsapp.ts` (new): the number for wa.me, the contact link, the share links.
- `lib/formatters/hours.ts` (new): 12-hour times, the 7 rows, today in Lagos time. `lib/formatters/fees.ts` (new): the fee line.
- `lib/api/listing.ts` (new): `getListing(slug)` through `requestJson`; `types/api.ts`: `ListingDetail`, `Phone`, `OpeningHours`, `Service`.
- `components/listing/` (new folder): `ListingDetailView` (client), `ListingSkeleton`, `ListingNotFound`, `ReportedNotice`, `ContactButtons`,
  `WhatsAppButton`, `OtherPhones`, `HoursTable`, `ServicesFees`, `EntrancePhoto`, `ShareButtons`.
- `app/(public)/listing/[slug]/page.tsx` (the existing placeholder becomes the shell), `styles/globals.css` (`whatsapp-dark`, `whatsapp`),
  `public/images/brand/whatsapp-glyph-72.png` (the owner's `whatsapp.png`, only scaled to 72 × 72 with `sharp`; no recolouring or editing).
- `backend/seed/whatsapp_fixture.py` (new, local only) and its test in `backend/tests/`.
- `tests/unit/` for each piece and `tests/end-to-end/listing-page.spec.ts` (Playwright).
- Docs (after the owner's review): `specs/frontend/ui-spec.md` section 2.4, `specs/roadmap.md`, `LOG.md`.

## Tasks (tests first in every task)

### Task 0: the spec
- [x] `requirements.md`, `plan.md`, `validation.md` written (the three feature files only, 2026-10-13); the owner reviews.
- [x] After the owner's answers (2026-10-13): `specs/frontend/ui-spec.md` section 2.4 updated, decision 9 of
  `specs/2026-10-11-listing-detail-api/requirements.md` marked as replaced by D2 and D4 here, and the roadmap's 6b block updated. Spec first, then code.

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
- [ ] The unit tests quote the owner's two sentences from the click-to-chat help page (<https://whatsapp.com/faq/en/general/26000030>, in `requirements.md` D2)
  and the leading-zero rule; there is no open caveat.

### Task 3: the API call and the types (D8, D9)
- [ ] Tests first: `getListing` requests `/listings/<slug>` with the slug URL-encoded and **no query string**, maps 404 to a "not found" result
  and the other errors as `/search` does (timeout, network, server); the "waking up" and "Retry" times are the existing 5 s and 45 s.

### Task 4: the components (D1, D2, D6, D7)
- [ ] Tests first for each: `ContactButtons` (Call always; WhatsApp only when `is_whatsapp`; the primary first; other phones each with their
  own buttons; Directions hidden for a position that is not real, as today), `WhatsAppButton` (the link, the name, Option A: white, a `#075E54`
  border, `ink` label; the contrast pairs in `design-tokens.test.ts`; the glyph is the scaled copy as an `<img>` with empty alt and a fixed 24 px size), `HoursTable`
  (12-hour, today marked with a word, "Open 24 hours, every day" for a 24-hour listing), `ServicesFees` (the five fee cases, the estimate words once, no date), `ReportedNotice` (the words, `role="note"`,
  amber, not red), `EntrancePhoto` (https only, alt, lazy, fixed size, vanishes on error), `ShareButtons` (the link, the clipboard fallback,
  "Link copied" `role="status"`), `ListingNotFound` (the words, the button).
- [ ] Add `whatsapp-dark` (`#075E54`) to `globals.css` and the token tests. Make `public/images/brand/whatsapp-glyph-72.png` from the owner's
  `whatsapp.png` with `sharp` `resize` only, and a test that it is 72 × 72, one colour `#25D366`, with transparency (so it was not recoloured).

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
