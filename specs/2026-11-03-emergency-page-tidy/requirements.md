# Requirements: SwiftRescue (/emergency) tidy-up

Branch `feature/emergency-page-tidy`. Status: **built (2026-11-03); draft pull request.** The owner's request of 2026-11-03, after the review of the
page on a phone (the findings are in `specs/2026-11-03-hero-phone-tablet/requirements.md`). 112 and everything not listed here stay as they are.

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| FR-14 | The SwiftRescue page shows 112 first and always | Must |
| FR-16 | Each contact shows its name, area, distance, Call and last-verified date | Must |
| FR-17 | The SwiftRescue page is kept for offline use after the first visit | Must |
| NFR-01 | Fast on a slow connection, CLS 0 | Must |
| NFR-10 | Accessible: 16 px text, 48 px targets, Light and Dark, tidy at 320 px | Must |

## Decisions (the owner's list, built as asked)

1. **No photos in the groups.** The Ambulance and Fire service groups show contacts only (`GroupPhoto` is removed).
2. **One photo banner under the 112 card.** The ambulance and the fire photo together, side by side on every width, directly below the 112 card (112
   stays first and never waits for the photos). **Height proposed and built:** a 5:3 box on a phone, **96 px high at 360 px** (each photo 160 px wide;
   the box shows 400 × 240 of the 640 × 240 file, with a focus point that keeps each face whole: ambulance `70% 50%`, fire `0% 50%`), and from 640 px
   the whole 8:3 photo (about 124 px high at 672 px). Lazy, a fixed box (CLS 0), full brightness, honest alt text (the same two sentences as before),
   no credit, kept offline by the service worker as before (the saved copy of the contacts holds no picture).
3. **The header's SwiftRescue button is the current page on /emergency:** the same red button, `aria-current="page"`, not a link
   (`EmergencyButton`, a small client part that reads the address, because the header is rendered by the route group and cannot know the page).
4. **No `h2` "Share my location" or "Share emergency list".** The buttons stay, in two named groups (`role="group"`) for a screen reader.
5. **The two location actions are renamed:** "Send my location to someone" (was "Share my location") and "Sort by distance from me" (was "Show
   distances from my location"), with 2 rem between the parts of the page (`gap-8`) and the share-the-list buttons between them.
6. **One verification line per card:** "Verified 27 days ago · check due" (amber when due), "Verified 3 days ago" (green) otherwise. A new component,
   `VerificationLine`, used only by the emergency card.
7. **112 and everything else unchanged.** No red cross anywhere (the header's siren icon is unchanged).

## Choices to know about

- The search cards and the listing page still show the amber "Verification due" label and the date (`VerifiedDate`); the owner asked for the
  emergency cards only. Say if the same one line should go there too.
- The two share buttons "Share on WhatsApp" and "Share by SMS" keep their words; with the heading gone, only the group's name tells a screen reader
  that they share the list. Say if the words should change to "Share the list on WhatsApp" and "Share the list by SMS".
- A `focus` field was added to the two entries of `EMERGENCY_PHOTOS` (`src/config/sitePhotos.ts`).
- No new table, endpoint, package or setting; the two image files are not changed.
