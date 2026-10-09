# SwiftHealth: Figma design reference (Find page + listing card)

Source: Figma Make file "SwiftHealth Design System"
(https://www.figma.com/make/FrqCx3ZEmPF6swdDRrgreA/SwiftHealth-Design-System), read on 2026-10-09.
This is a visual reference only. Where it differs from `specs/frontend/ui-spec.md`, the UI spec wins.
All data in the design is fictional.

## 1. Colour tokens

| Token | Hex | Use |
|---|---|---|
| teal-950 | #073d3b | Hero background, brand text, active chip text |
| teal-800 | #0b5c57 | Secondary button text, verified badge text, link text |
| teal-700 | #08766f | Primary button, brand mark, eyebrow text |
| teal-100 | #dff3ef | Verified badge background, spinner track |
| teal-50 | #f0faf8 | Facility icon tile, empty-state icon background |
| ink | #172321 | Main text, headings |
| ink-soft | #4b5c59 | Secondary text |
| line | #d7e1df | Card borders, dividers |
| surface | #ffffff | Cards, search box, area select |
| canvas | #f5f8f7 | Page background |
| green | #147a48 | "Open now" text |
| green-bg | #e7f6ed | "Open now" background |
| grey-bg | #edf1f0 | "Closed" background, skeletons, empty "near you" box |
| closed text | #465451 | "Closed" text |
| amber | #8b5c00 | "Verification due" text, error icon |
| amber-bg | #fff4d6 | "Verification due" background, error icon background |
| red | #b4232c | SwiftRescue only: emergency buttons, Rescue link and nav item |
| red-dark | #8c1820 | Emergency button hover, emergency eyebrow |
| red-bg | #fff1f1 | SwiftRescue panel background |
| muted text | #61706d / #647471 | "Last checked", icons in card details |
| focus ring | #82cfc3 | 3px outline, 2px offset, on every interactive element |

Rule: red is used only for SwiftRescue and emergency actions. The error state uses amber.

## 2. Typography

- Font: system stack (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`). No web font download.
- h1 (hero): clamp(30px, 9vw, 46px), line-height 1.08, letter-spacing -0.035em.
- Section heading h2: 24px, line-height 1.2.
- Card title h3: 18px, line-height 1.3.
- Body, card details, buttons, inputs and selects: 16px (16px inputs also stop phones zooming in).
- Secondary text: 14px (area line, near-you card meta, location message, chips, location and filter buttons).
- Smallest text: 13px (badges, "Last checked", eyebrows, bottom-nav labels). Eyebrows are uppercase, letter-spacing 0.08em, weight 800.
- One leftover at 12px: the "Showing fictional example listings" note. Raise it to 13px when building.

## 3. Spacing, radius, shadow

- Page side padding: 16px (12px under 350px wide; 24px from 720px). Max content width: 1120px.
- Card padding: 18px 16px 16px. Card radius: 16px. Gap between cards: 14px (near-you cards: 12px).
- Radius: buttons 11px; search box 14px; location button, Filters button and area select 12px; chips and badges fully rounded.
- Card shadow: `0 2px 12px rgba(7, 61, 59, 0.07)`.

## 4. Tap targets

- Buttons: 50px min height. "Use my location": 52px. Area select and Filters: 50px.
- Category chips: 48px. Header brand and Rescue link: 48px. Bottom-nav items: 56px. Search box: 56px.

## 5. Components and text

**Header** (sticky, white, 64px tall; 72px from 720px): teal square brand mark with a white plus, "SwiftHealth"; on the right a red "SwiftRescue" text button with the rescue icon.

**Hero (Find controls)**, on teal-950:
- Location line: pin icon, "Enugu, Nigeria", pill "LAUNCH AREA".
- h1 "Find trusted care near you"; subtitle "Verified hospitals, pharmacies and labs across Enugu."
- Search box: search icon + input, placeholder "Search name, area or service" (screen-reader label "Search by name, area or service").
- "Use my location" button (outlined, white text): under the search box on mobile, beside it from 720px.
- Row: "Or choose an area" select (white field) + "Filters" button.
- Location message line (14px): "Finding your location…", "Using your current location.", "We could not use your location. Choose an area instead.", "Location is unavailable. Choose an area instead."
- Category chips, horizontal scroll with snap: All, Hospital, Pharmacy, Laboratory, Clinic, Blood, More. Active chip: white with teal-950 text. (The real list comes from GET /meta.)

**Near you section** (eyebrow "NEAR YOU", h2 "Open places nearby"):
- Two cards. Eyebrow "Closest open pharmacy" / "Closest open 24-hour place"; title; "1.2 km · New Haven"; "Open now" badge; hours line; Call (primary) + Directions (secondary).
- Full-width secondary button "See all open places near me" (auto width from 720px).
- Empty version: grey box, "No open pharmacy found nearby" / "Try a wider search across Enugu.", underlined link "Search all places".
- Two columns from 720px.

**Listing card**:
- Top: 48px facility icon tile + eyebrow "Hospital · 1.2 km" + title.
- Badges: "Verified" (shield icon), or "Verification due" (clock icon, amber) when overdue; plus "Open now" (green dot) or "Closed" (grey dot).
- Divider, then details: pin + address with "Area, Enugu" under it (14px); clock + hours text ("Open 24 hours", "Closes 9:00 PM", "Opens 7:30 AM tomorrow").
- "Last checked 18 Jun 2026" (13px).
- Actions: two equal columns, Call (primary, phone icon) and Directions (secondary, route icon).
- Grid: one column on mobile, two from 720px.

**Buttons**: primary (teal-700 bg, white), secondary (white bg, #a9bab7 border, teal-800 text), emergency (red bg, white). 16px, weight 750, icon + label, 8px gap.

**States**:
- Empty: centred card, search icon in a teal-50 circle, "No places found", "Try another name, area, or category.", full-width "Clear search".
- Loading: a message card with a spinner, "Finding care near you" + "The service is waking up, this can take up to a minute.", then two skeleton cards. Spinner stops under prefers-reduced-motion.
- Error: centred card, "!" in an amber circle, "We could not load places", "Check your connection and try again.", full-width "Try again".

**SwiftRescue panel** (opens from the header link or bottom nav): red-bg card with a red left border, red icon tile, eyebrow "SWIFTRESCUE", h2 "Emergency contacts", "Call the right service quickly. Calls use your phone network.", two red buttons, "Verified · Last checked …". Built in Phase 7, not 5B-1.

**Bottom navigation** (mobile only, hidden from 720px): Home, Search, Rescue (red). Respects safe-area insets.

**Desktop (980px+)**: left aside "BROWSE CARE" / "Simple, current and verified" with a trust note "Look for the check: Every result shows when it was last verified."

## 6. Known differences to resolve against the UI spec

- Filters: the design toggles the category chips inline; the spec says a native `<dialog>` bottom sheet with open now, category, area, service (pick-from-list), radius and sort. Spec wins.
- Waking-up text: the design shows it straight away; the spec shows it after 5 s. Spec wins.
- Directions: the design searches Google Maps by address; prefer latitude/longitude from the API.
- Header uses `backdrop-filter: blur`, which can be slow on low-end phones. Consider a solid background.
- SwiftRescue panel, bottom navigation and the desktop aside are outside 5B-1 unless the UI spec includes them. List them in the "Design differences" table rather than building them.
