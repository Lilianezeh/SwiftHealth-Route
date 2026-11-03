# Requirements: Home hero on phones and tablets, and For facilities shown once

Branch `feature/hero-phone-tablet`. Status: **built (2026-11-03); draft pull request.** The owner's request of 2026-11-03, after choosing
option A of two proposed (screenshots at 360, 390 and 768 px in Light and Dark). Laptop (1024 px and up) stays exactly as it is.

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| US-13 | A visitor sees the home page and reaches Find care and SwiftRescue at once | Must |
| NFR-01 | Fast on a slow connection (mobile PageSpeed 90+, CLS 0) | Must |
| NFR-10 | Accessible: 16 px text, 48 px targets, Light and Dark, tidy at 320 px (Accessibility 100) | Must |
| FR-44 | The For facilities page leads owners to Sign up and Log in | Should |

## Decisions (the owner's list)

1. **Taller photo, whole faces.** Under 1024 px the photo box is **85% of the width, at most 32 rem** from 380 px (306 px at 360, 332 px at 390,
   512 px at 768, the whole 3:2 photo), and **75% of the width under 380 px** so that "Find care near me" is on the first screen at 360 x 740
   (owner, 2026-11-03). It was 256 px (288 px from 768 px). Every photo's focus point is checked by maths at 320, 360, 375, 379, 380, 390, 414, 430,
   600, 767, 768, 900 and 1023 px: the whole face stays at least 8 px inside the photo box.
2. **Nothing over the photo.** The header on the home page is the solid brand-colour bar with the accent line, in the flow, above the photo, under
   1024 px. The veil under the header is hidden under 1024 px. The diagonal edge is removed under 1024 px (a straight bottom edge): the photo is
   never cut. From 1024 px the transparent header, the veil and the slanted left edge are as before.
3. **Controls off the photo.** Previous, the six dots, Next and Pause are a centred row right below the photo on a bar of the header's colour, every
   button 48 px: two rows under 480 px (104 px high under 380 px, 120 px from 380 px), one row from 480 px. From 1024 px they are over the photo, low at
   the left, as before.
4. **The text** under 380 px is a little tighter (heading 30 px, line 18 px, less space) so the button fits on the first screen at 360 x 740;
   from 380 px it is as before. The button is also completely on the first screen at 390 x 844 and from 1024 px; on a 375 x 667 phone and on a tablet it is
   one short scroll away (the owner accepted this with the taller photo).
5. **For facilities** shows "Sign up as a facility owner" (while sign-up is open) and "Log in" **once**, near the top. They are removed from the
   end of the page, which keeps "List your facility".

## Found on /emergency (SwiftRescue) on a phone (360 px): reported, not changed

Read-only, with the demo data. Nothing was changed on that page; the owner decides what to change.

- The red **SwiftRescue** button of the header is on the SwiftRescue page itself, right above the `h1` "SwiftRescue" (it is the same on every page by FR-02).
- **"Share my location"** is an `h2` followed at once by a button with the same words; **"Share emergency list"** is an `h2` over the buttons "Share on
  WhatsApp" and "Share by SMS": the heading and the button say the same thing twice.
- Two location actions sit one under the other and look alike: "Share my location" (sends your position in a message) and "Show distances from my location".
- On every card the badge **"Verification due"** and the line **"Verified 27 days ago"** both say the card is overdue (the demo listings are old; a card
  that is not overdue shows only the date).
- **112** is in the card's `h2` ("National emergency number — 112"), the **"Call 112"** button and the disclaimer's last words ("In danger, call 112").
  The disclaimer sentence itself is shown **once**.
- Not duplicates: each card has its own "Call" and "Report a problem" (9 of each with the demo data), which is the normal list shape.

## Choices to know about

- Under 380 px the heading is 30 px instead of 36 px and the line 18 px instead of 20 px, because the photo at 75% of the width alone was not enough
  for the button to fit (measured: the button ended at 819 px of 740; with the tighter controls, text and spacing it ends at 691 px).
- The controls bar is the `bar` colour in both modes (the same as the header), so the white edge of every button stands out (5.4:1 in Light).
- No new table, endpoint, package or setting.
