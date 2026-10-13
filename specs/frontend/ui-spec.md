# SwiftHealth UI specification

What every screen shows, which API it uses, and how it behaves. Build from this file; if something is
unclear or missing, update the spec first, then the code. Endpoint details are in `specs/backend/api-spec.md`.
Sketches go in `docs/screens/`.

---

## 1. Global rules

### Brand and naming
- App name **SwiftHealth Route** (owner, 2026-10-13; it was SwiftHealth). It is written in one file, `frontend/src/config/brand.ts` (`name`, and the two parts of the wordmark `main` = "SwiftHealth" and `accent` = "Route"), and every text on screen takes it from there: the header logo, the footer, the page title and description, the manifest and the Overview text. Emergency section and button **SwiftRescue** (unchanged, also in `brand.ts`). The repo, the folders and the Netlify address keep the old name.
- Tagline: *Emergency, Hospital & Pharmacy Finder*.

### Layout (every page, from `src/app/layout.tsx`)
- **Header** (new design, 2026-10-11, see 2.1): the **SwiftHealth logo** on the left (links to `/`): a map pin with a plus inside, drawn as an inline SVG, then the word SwiftHealth; then **Find care** (`/find`), red **SwiftRescue** (`/emergency`) and **For facilities** (`/list-your-facility`). **On the home page only, "Find care" is not shown** (in the bar and in the phone menu), because the hero's button does the same; it is on every other page (owner, 2026-10-12). **The logo:** the pin is the same shape as the pins of the results map, in the bright blue `accent` with a white plus and a thin white edge, so it is visible on the `forest` header (a `forest` pin would vanish on it); the SVG is hidden from screen readers, the word names the link. The pin alone is the favicon (`src/app/icon.svg`, `forest` blue with a white plus, which Next.js serves as the tab icon). No red cross, and no other symbol. `forest` background with a 4 px `accent` line under it. **On the home page only, the header is transparent** (owner, 2026-10-12): no background and no line, white logo word and white links, positioned on top of the hero (above its photo; a dark veil over the top of the photo keeps the white links readable, see 2.1). The red SwiftRescue button is the same. The header reads the address, so it is a client component. **Every width has either the links or the Menu button, inside the screen, and the page never scrolls sideways** (sixth revision, checked in a real browser): on a phone the wordmark is 16 px (18 px from 640 px), SwiftRescue and Menu have 12 px at the sides (16 px from 640 px), and below 400 px only the pin is drawn, with the word kept for screen readers. On a phone the bar shows the wordmark, the red SwiftRescue button (always visible, FR-02) and a **Menu** button; the menu opens a panel with Find care and For facilities. From tablet width (768 px) all links are in the bar. The menu button is at least 48 px, has the word "Menu" beside its icon, and says whether it is open (`aria-expanded`); Esc closes the panel.
- **Footer:** About · How we verify · Privacy · Terms · Contact · List your facility; then "© 2026 SwiftHealth Route". The links and the © line are inside the same container as the section headings (`max-w-6xl`, 16 px at the sides), not at the far left edge (owner, 2026-10-12). On the home page the footer comes straight after the last part: no top margin (it showed an empty beige band) and no line above the links; on every other page it keeps the 4 rem gap and the thin line. It reads the address, so it is a client component. No photo credit and no outside link: no photo of the site needs one (owner, 2026-10-12; the Magnific credit was removed when the photos were replaced).
- Mobile-first; content max width 720 px on public pages, 1200 px in admin.

### Design tokens (in `src/styles/globals.css`)
| Token | Value | Use |
| --- | --- | --- |
| forest | `#1B6F93` | Header, headings, links, the focus ring. Main blue (owner's colour change, 2026-10-10; was dark green `#12302a`) |
| pine | `#1B6F93` | Primary buttons, button borders. Main blue, the same value as `forest` (was green `#2f7d6b`); the two names are kept so no component changes |
| pine-dark | `#134F6A` | Hover and active state of buttons (white text on it: 8.9:1) |
| accent | `#1A9FD2` | Decoration only (the line under the header). Never behind text and never a text colour: white on it is only 3.0:1 |
| amber | `#e8913a` | Highlights, "Sponsored" tag background (dark `ink` text on it). Not the focus ring: amber is only 2.2 to 2.5:1 on light backgrounds |
| paper | `#f6f3ec` | Page background |
| ink | `#1d2421` | Body text |
| emergency | `#b3261e` | SwiftRescue button, 112 card only |
| ink-soft | `#4b5c59` | Secondary text (area line, "Verified 3 days ago"); 6.4:1 on paper |
| line | `#d7e1df` | Card borders and dividers |
| pine-100 | `#DCECF4` | Background of the "Verified" label (light blue tint of the main blue) |
| pine-50 | `#EEF6FA` | Light panels (the empty "near you" box, empty-state icon circle) (lighter blue tint) |
| sky | `#1A7CAD` | The light end of the home page hero gradient (the other end is `pine-dark`). Owner, 2026-10-12: it was `#A9DDF3` with dark text; the owner then asked for white text, which needs 4.5:1, and white on `#A9DDF3` is only 1.47:1, so the value was deepened to the lightest sky blue that passes: white on it is 4.64:1 (on `pine-dark` 8.92:1, so everything between them passes) |
| open | `#147a48` on open-bg `#e7f6ed` | "Open now" and "Open 24 hours" label (4.8:1) |
| closed | `#465451` on closed-bg `#edf1f0` | "Closed" label (7.0:1) |
| amber-ink | `#8b5c00` on amber-wash `#fff4d6` | "Verification due" label and the error icon (5.3:1); the plain `amber` is too light for small text |
| shadow-card | `0 2px 12px` of forest at 7% | Card shadow |

Components use these tokens (Tailwind classes such as `bg-pine`, `text-ink-soft`), never a hex value. Ten colours were
added on 2026-10-09 from the owner's Figma Make reference (`docs/design/figma-find-page-design.md`); every pair of text and
background colour is checked by `tests/unit/design-tokens.test.ts` to be at least 4.5:1 (NFR-10). Read the table with the
rule that the spec tokens win over the Figma colours: Figma's teal-950 is `forest`, teal-700 is `pine`, its page
background is `paper`, its red is `emergency`.

**Colour change, 2026-10-10 (owner's decision):** the green palette became blue. `forest` and `pine` are `#1B6F93`,
`pine-dark` `#134F6A` is for hover and active states, `accent` `#1A9FD2` is decoration only, and the two light tints
(`pine-100`, `pine-50`) became light blues. The open (green), closed (grey), amber and emergency (red) colours, and
`paper`, `ink`, `ink-soft` and `line`, did not change. The main blue is 5.6:1 on white and 5.1:1 on `paper`, so it passes
for small text on both (the old `pine` did not on `paper`).

### Buttons and text
- **Primary** (Call, Retry): `pine` background, white text; `pine-dark` on hover and press. **Secondary** (Directions,
  See all, Clear filters): white background, `pine` border, `forest` text; `pine-50` background and `pine-dark` border on
  hover, `pine-100` on press. **On dark** (the home page hero button, 2026-10-12): white background, `pine-dark` text (8.9:1),
  `pine-50` on hover and `pine-100` on press; the `pine` button would vanish on the dark hero. **Emergency** (SwiftRescue only): `emergency` background, white text. 16 px text,
  semi-bold, at least 50 px high (never under 48 px), radius 12 px.
- Every piece of text is 16 px or larger, including badges, the area line and "Verified 3 days ago" (NFR-10). Card titles
  are 18 px. The system font stack is used; no web font is downloaded.
- Cards: white, 1 px `line` border, 16 px radius, `shadow-card`, 16 px inside.
- Status is shown with words as well as colour ("Open now", "Closed", "Verification due").

### Accessibility and performance (NFR-01, NFR-04, NFR-10)
- Tap targets at least 48 × 48 px; body text 16 px or larger; visible focus ring.
- **Focus ring** (owner's decision, 2026-10-09): 3 px, 2 px offset. `forest` on light backgrounds (5.6:1 on white, 5.1:1 on
  `paper`); `paper` on a `forest` background (5.1:1). A container with a `forest` background has the class `on-dark`, which
  switches the ring for everything inside it (the header and the Find page hero). Both are at least 3:1 (WCAG 2.2, 1.4.11).
  A test in `tests/unit/design-tokens.test.ts` checks it.
- **Icons** (owner's decision, 2026-10-09): from `lucide-react`, imported one by one by name (never the whole set, never a
  dynamic icon). They are decorative (`aria-hidden`) and always sit next to a text label; an icon is never the only content
  of a button or link, and it never carries information alone.
- Works from 320 px wide; no sideways scrolling.
- Pages are server components unless they need interaction; only maps, forms and filters are client components.
  One exception: the results list of `/search` is a client component too. It loads in the browser with a 45 second limit
  (see "Standard states"), because the free API can take about a minute to wake and the hosting gives up on a server page
  after about 30 seconds. This means results need JavaScript (revisit after the Render upgrade, `LOG.md`).
- A visitor's position is kept in `sessionStorage` for the tab only, rounded to 3 decimals. It is never in a page address,
  a cookie, `localStorage` or a log, and it is sent only as `lat` and `lng` to `GET /search`.
- Images compressed; no large libraries on public pages except Leaflet on the map view.

### Standard states (every data screen)
| State | Show |
| --- | --- |
| Loading | Skeleton cards (grey blocks), never a blank screen |
| Empty | Plain message + next step, e.g. "No open pharmacies within 10 km. Try a wider area." with a button |
| Waking up | On data screens loaded in the browser (`/search`, the near-you cards): after 5 seconds without an answer, "The service is waking up. This can take up to a minute." (announced to screen readers; the skeleton stays) |
| Error | "We couldn't load this. Check your connection and try again." + Retry button. Also shown 45 seconds after a request started without an answer |
| Offline | On `/emergency`: show the cached list with "Offline — showing saved contacts from [date]" |

### Reusable components (`src/components/`)
| Component | Purpose |
| --- | --- |
| `ListingCard` | Top line "Category · 1.4 km" (no distance when none), name (a link to `/listing/[slug]`), `VerifiedDate` and `OpenNowBadge`, the address with the area under it, then **the hours line** (a `Clock` icon and the `hours_note` text of the API, for example "Closes 9:00 PM" or "Opens 7:30 AM tomorrow", in `ink-soft`, 16 px; nothing at all when `hours_note` is `null`, which it is for a 24-hour listing and for one with no hours recorded), then Call + Directions side by side; "Sponsored" tag when `sponsored`. No Call button when the listing has no phone number |
| `CallButton` | `tel:+234…` link labelled "Call", primary button |
| `DirectionsButton` | Secondary button labelled "Directions"; opens `https://www.google.com/maps/dir/?api=1&destination=lat,lng` (from the listing's latitude and longitude) in a new tab |
| `OpenNowBadge` | "Open now" (green) / "Closed" (grey) / "Open 24 hours" (green, wins over Closed) |
| `VerifiedDate` | "Verified 3 days ago" (a `pine-100` label); when `verification_due`, an amber "Verification due" label with "Verified 45 days ago" next to it, so the date is always shown (FR-08, US-07) |
| `Disclaimer` | Directory / not medical advice text |
| `ResultsMap` | Plain Leaflet (no wrapper package) with OpenStreetMap tiles; one pin per result that has a real position, and a dot for the visitor's own position when there is one. Client component, loaded only when the map is shown (see 2.3, "Map view") |
| `MapPopup` | The content of a pin's popup: name (a link to `/listing/[slug]`), "Category · 1.4 km", `OpenNowBadge`, the "Sponsored" tag when `sponsored`, then `CallButton` and `DirectionsButton` side by side (no Call button when the listing has no phone number) |
| `ViewToggle` | **List** \| **Map**: two buttons in one group, the current one marked with `aria-pressed`; each at least 48 px high |
| `ShareLocationButton` | Gets location with permission, opens WhatsApp/SMS with a Google Maps link |
| `ReportLink` | "Report a problem" → `/report/[id]` |

---

## 2. Public screens

### 2.1 Landing page — `/`
**Redesigned 2026-10-11, simplified 2026-10-12** (owner's brief and then the owner's review of the preview; feature
`specs/2026-10-11-home-redesign/`). **Purpose:** show a resident, a partner or a facility owner what SwiftHealth is, in one
phone-sized scroll. Seven parts, two photos (changed again on 2026-10-12: new photos, an Overview part, "Benefits"; then a hero like the reference site: a gradient, a transparent header, a side photo; "How it works" removed).
**API:** none; the page is static. (The old API-status line and
the old outline with "the problem", "how we verify" and "pricing" are gone: the featured-listing price belongs on the facility page.)

**Rules for the whole page.** Phone first, from 320 px, no sideways scrolling. Blue palette (tokens only) and the system fonts.
**Red is only for SwiftRescue and emergencies**: on this page it appears once, in the header's SwiftRescue button (which is on every
page). No slideshow, no animation, no statistics, no testimonials. Text is 16 px or larger everywhere, "small" lines included.
Every photo is a `next/image` (or its `getImageProps` for the hero `<picture>`) with fixed `width` and `height`, `unoptimized`
(the files are final) and alt text; the hero loads at once and the other photo loads lazily. **No text of the page, and no
page description, names a city**: the home page does not say where SwiftHealth is live (owner, 2026-10-12). One `h1` (the hero
heading); each following part has an `h2`.

**Parts, top to bottom** (the words below are the exact text):
1. **Header** — see "Layout" above. On this page it is transparent and sits on top of the hero.
2. **Hero** — a **sky blue gradient** background (owner, 2026-10-12, to be like the reference site): from the `sky` token
   (`#1A7CAD`, the lighter side, top right) to `pine-dark` (`#134F6A`, the deeper side, bottom left); no flat colour. The hero is
   tall **from 1024 px, in the side-by-side layout only**: at least 85% of the screen height (`lg:min-h-[85svh]`); below 1024 px it has no forced height (the photo band, then the text with normal spacing: no large empty gap on a tablet; owner, 2026-10-12). `h1` **"Find open care near you, fast."** (large: 36 px on a phone,
   48 px from 768 px, 60 px from 1024 px, with balanced line breaks so no word is left alone on a line) Line: **"Hospitals, pharmacies and emergency help, open near you."** One button: **"Find care near me"**
   (the on-dark button: white, `pine-dark` text, to `/find`). Small line (18 px): **"Free to use · No sign-up needed"**. All
   the text is **white**, in the **lower left** of the hero (on a phone, below the photo band). No red button and no second button
   in the hero: the red SwiftRescue button is in the header, on every page. **Text contrast (computed 2026-10-12):** white on
   `sky` 4.64:1 (the lightest point of the gradient), on `pine-dark` 8.92:1, so every point passes 4.5:1.
   - *One large photo,* `hero3.webp` (a stethoscope and a blood pressure gauge on white sheets; 1:1, 1200 × 1200, cut from a portrait
     photo with both objects kept). *Desktop (1024 px and up; it was 768 px until the fifth revision, R28):* it **fills the whole right half of
     the hero, from top to bottom and to the right edge of the screen** (`object-cover`), with a **slanted left edge** (a `clip-path`
     polygon: the top edge starts 15% in, the bottom edge at 0), **no rounded corners**, and **no part below the hero**: nothing
     overlaps the next part, so there is no white gap. The text stays on the left half, inside the page width, so the photo is never
     under it. *Phone and tablet (up to 1023 px):* the photo is a **band at the top of the hero**, the full width of the screen, 16 rem
     high on a phone and 18 rem from 768 px (sixth revision: it was 18 and 24 rem and pushed the heading down), with a **slanted bottom edge** (a `clip-path` polygon: the right side ends at 85% of the
     height, the left at 100%); the white text is below it, at the full width of the page, on the gradient. The heading wraps at every width from 320 to 1023 px and is never clipped (the text column has an explicit full width there).
   - *The veil:* the header's white links sit on top of the photo (white sheets), so the top 6 rem of the photo has a veil:
     `pine-dark` at 80% opacity down to 50% of its height (3 rem, which covers the header's text), then a gentle fade to nothing over the
     other 3 rem. It is decoration (`aria-hidden`). Worst case, with a pure white photo under it, white on it is **5.26:1** (computed
     2026-10-12), so the links pass 4.5:1. (Before: 8 rem, 85%, solid to 4.8 rem, 6.02:1; the owner found it grey and smudgy.)
   - *The file:* the hero is one `<picture>` whose `<source media="(max-width: 767px)">` has `srcset="hero3-phone.webp 640w"` and
     `sizes="100vw"` (the small version, 640 × 640, under 50 kB), and whose `<img>` is `hero3.webp` (1200 px) for wider screens, on
     tablets and desktops. So a phone downloads only the small file. The hero is loaded at once (`loading="eager"`,
     `fetchPriority="high"`), without `priority`, so no big file is preloaded on a phone.
3. **Overview** — `h2` **"Overview"**; text **"SwiftHealth Route helps you find hospitals, clinics, pharmacies, labs and emergency contacts
   that are open right now. Every listing is checked by our team, so the number you call and the hours you see are ones you can
   trust."** (the owner's words). A white part right after the hero with the normal `py-12` space (the photo no longer overlaps it).
   *"How it works" (three step cards) was removed on 2026-10-12 at the owner's request.*
4. **Benefits** (was "Why SwiftHealth"; renamed on 2026-10-12) — a **full-width band in the header blue** (`forest`), with **white**
   text and **white icons** (each icon in a `pine-dark` circle; white on `forest` is 5.61:1, on `pine-dark` 8.92:1). `h2` "Benefits".
   Four items with icons: **Verified listings** ("We check every listing before it goes live."), **Open now means open now**
   ("Hours follow local time, including late-night places."), **Works on slow data** ("Light pages that load on a weak
   connection."), **Your location stays private** ("Your position stays in your browser and is used only to find places near
   you."). Each item has a thin white line (30% white) around it.
5. **Browse by type** — `h2` "Browse by type". Simple icon tiles, no photos: **Hospital, Clinic, Maternity, Pharmacy,
   Laboratory**, each a decorative `lucide` icon (`Hospital`, `Stethoscope`, `Baby`, `Pill`, `FlaskConical`) in a light blue circle
   over the label, the whole tile one link to `/search?category=<slug>` (`hospital`, `clinic`, `maternity`, `pharmacy`,
   `laboratory`), at least 48 px high. Two columns on a phone, five from desktop width.
6. **For facility owners** — `hero4-portrait.webp` (2:3, 800 × 1200, the whole photo of a smiling health worker holding a blister
   pack, **uncropped**, keeping its portrait shape) and `h2` **"Run a hospital, clinic or pharmacy?"**; text **"List your
   facility for free and help people find you when they need you. We verify every listing before it goes live."**; button **"List
   your facility"** (to `/list-your-facility`). *Phone:* the photo is the full width of the content. *Tablet and desktop (768 px and up):* it is
   **26 rem high** (about 17.3 rem wide: it keeps its 2:3 shape, never stretched and never cut) and the text is **right beside it**
   with a 2.5 rem gap, both **vertically centred**, the text at most 36 rem wide, so there is no big empty space between them.
7. **Footer** — see "Layout" above.

**Removed on 2026-10-12** (owner's review of the preview): the SwiftRescue photo band ("In an emergency, every second counts."
with the ambulance and fire photos), the About part, the red "Emergency help" button of the hero, the second hero photo, the
photo cards of "Browse by type", and every mention of a city.

**Images** (in `frontend/public/images/home/`, made by `scripts/optimize-home-images.mjs`; two Unsplash photos, changed on
2026-10-12): `hero3` (1200 × 1200) under 150 kB, `hero3-phone` (640 × 640) under 50 kB (the same photo, smaller, for phones),
`hero4-portrait` (800 × 1200) under 100 kB. First-load weight of the page stays under 500 KB (NFR-01): only the hero photo counts
(the small one on a phone), because the portrait photo is lazy. Alt text is short and factual and was written after the converted
photos were looked at. There is no photo credit in the footer: the owner states that these photos need none. The favicon is
`src/app/icon.svg` (see "Layout").
**Known gap:** `/list-your-facility` and `/about` are still "Coming soon" pages (phases 10 and 13b). `/emergency` has the minimal
page of 2.5 until phase 7.

### 2.2 Find home — `/find`
FR-01, FR-03. **Purpose:** the app's start screen.
1. Heading **"What do you need?"**
2. Two large buttons side by side (stacked on small screens): **Find a healthcare facility** (scrolls to search) · **Get emergency help** (`/emergency`, red).
3. Search box: "Search hospitals, pharmacies, labs…" → `/search?q=…`. It is a plain form (a GET to `/search`), so it works before any script has loaded.
4. Category shortcuts (plain links): Hospitals `/search?category=hospital` · Clinics `clinic` · Pharmacies `pharmacy` · Maternity `maternity` · Labs `laboratory` · Blood (→ `/blood`, a "Coming soon" page until phase 8).
5. "Open now near me" button → asks for the position (after the tap), then `/search?open_now=true`. The position is not in the address.
6. **Near you** (once there is a position or a chosen area; before that, a "Show places near me" button and the area list): two cards, **Closest open pharmacy** (`category=pharmacy&open_now=true&limit=1`) and **Closest open 24-hour place** (`is_24_hours=true&limit=1`), each a `ListingCard`, then a button **See all open places near me** (`/search?open_now=true`). With an area and no position, the same two calls use `area=` and show no distance. The two cards load independently. A card with no result says "No open pharmacy found nearby" or "No 24-hour place found nearby" with a link to search all places, never an empty card; a failed card shows its own error and Retry.
**Location:** the browser asks for permission only after a tap on a button, and only once per tab (a refusal is remembered for the tab). If refused, show an area dropdown (from `GET /meta`).
**A stored position is used only while the browser still allows it** (found in the phone test, 2026-10-10: a tab opened from a page gets a copy of its `sessionStorage`, so a position stored before the visitor blocked the site was still used). Before using a stored position, the pages ask the browser for the permission with `navigator.permissions.query({ name: "geolocation" })`. If it says `denied`, the stored position is deleted, the refusal is remembered for the tab, and the page behaves as for a refusal (the message "We could not use your location. Choose an area instead." and the area list); a chosen area is kept. `granted` and `prompt` keep the stored position. If the browser has no permission check, or the check fails, nothing changes: the stored position is used as before. Until the check has answered, results wait for it (one search, not two).

### 2.3 Search results — `/search`
FR-04 to FR-08, US-01, US-05. **API:** `GET /search`, `GET /meta`.
1. Search box (pre-filled) and a **Filters** button opening a sheet (a native `<dialog>` styled as a bottom sheet; **Esc, a tap on the backdrop outside the sheet, Close, Apply and Clear filters all close it, and focus goes back to the Filters button**; a press that starts inside the sheet and ends outside does not close it): category (the categories of `GET /meta` that are **not** emergency categories, `is_emergency: false`, in the order of the Find shortcuts: Hospital, Clinic, Pharmacy, Maternity, Laboratory, then any other everyday category in the order `GET /meta` gives; the emergency categories belong to SwiftRescue and Blood has its own page, so they are not offered here. A category that is already selected from a shared link, such as `/search?category=ambulance`, stays in the list with its real name from `GET /meta` and stays selected, so the sheet never says "Any category" while the results are filtered), service (pick from the `services` list of `GET /meta`, with "Any service"), area (from `GET /meta`), open now, 24 hours, distance (5 / 10 / 20 km; only usable when there is a position, otherwise disabled with a hint). **Apply** and **Clear filters**.
2. Toggle: **List** | **Map** (`ViewToggle`; the map is phase 5B-2, see "Map view" below). The list is the default and always complete.
3. Result count: "12 places, nearest first" with a position, "12 places, A to Z" without one.
4. List of `ListingCard`s; sponsored card (if any) first with "Sponsored" tag.
5. "Load more" button (pagination, 20 at a time; page state, not in the address).
**URL holds all filters** (`/search?category=pharmacy&open_now=true`) so results can be shared, but **never the position** (`lat`, `lng`): it is read from `sessionStorage`. Applying filters replaces the address without adding history entries. A shared link opens with the filters set and, for the receiver, no position. The address may also hold `view=map` (see "Map view"); it is not a filter.
**States:** skeleton cards while loading; after 5 seconds "The service is waking up. This can take up to a minute."; error with Retry after 45 seconds or on an error answer.
**Empty:** "No matches. Try removing a filter or widening the distance."

**Map view** (phase 5B-2, FR-07; owner's decisions, 2026-10-11). The same results as the list, drawn on a map.
- **View in the address.** `view=map` in the address shows the map; no `view`, or any other value, shows the list. The list is
  the default and is always complete: it is never replaced by the map. The toggle, a new search from the search box and
  Apply or Clear in the Filters sheet all keep `view=map`. Changing the view with the toggle **adds a history entry**
  (owner's decision, 2026-10-11), so Back from the map returns to the list; tapping the view that is already shown does nothing.
  Filters still replace the address without a history entry, as above. **Never in the address:** the map centre, the zoom, the visitor's position. They are not kept in
  `sessionStorage`, `localStorage` or a cookie either; a map always opens fitted to its results.
- **Same data, no new request.** The map shows the results already loaded (a "Load more" adds pins). Changing the view does not
  call the API again. The count line, the loading, "waking up", error and empty states are the same as in the list; the map
  appears only when there is at least one result.
- **Loaded on demand.** Leaflet and its styles load only when the map is shown (a dynamic import with no server rendering), so
  the list view keeps its weight (NFR-01). While it loads, the area shows the skeleton.
- **Tiles and credit.** OpenStreetMap tiles from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. The credit "© OpenStreetMap
  contributors", linking to <https://www.openstreetmap.org/copyright>, is always visible on the map (Leaflet's attribution
  control), at 16 px and wrapping at 320 px. The tile provider is to be reviewed before launch (`LOG.md`).
- **Pins.** Drawn in code as a small inline SVG (a Leaflet `divIcon`), no image files. Blue (`forest`) with a white border and a
  white plus, so it reads on any tile. Never red: red belongs to emergency actions. Every pin looks the same: a sponsored
  result has the same pin (its popup shows "Sponsored"). A result with no real position (not a number, or outside
  -90..90 and -180..180) gets no pin, and the map says "N places have no position on the map. Switch to List to see them."
- **The visitor's position** (only when there is one, from `sessionStorage`): a dark (`ink`) dot with a white ring, round where
  the pins are pointed, never red, not clickable and not a tab stop. A line under the map says "● Your position" so the
  meaning does not depend on colour. With only a chosen area, there is no dot.
- **Opening the map.** It fits all the pins (and the dot when there is one) with some padding; one pin gives a close zoom; the
  map is refitted when the results change (a new search, or "Load more"). The fit is only in memory.
- **Popups and keyboard.** Each pin is a tab stop with the accessible name "Name, Category" and opens its popup with Enter or
  Space (and on a tap). When the popup opens, focus moves into it, to the listing name link, so Call and Directions are one
  Tab away. **Esc** closes the popup and puts focus back on its pin. The popup's close button, the zoom buttons and the pins
  are at least 48 × 48 px; all text is 16 px or larger; the focus ring is the one of "Accessibility and performance". The map
  has an accessible name ("Map of the search results"), and the arrow keys and + / − work on it (Leaflet's keyboard support).
- **Not in this phase.** A "Search this area" button, clustering, a map on the listing page or on SwiftRescue (`LOG.md`, the
  roadmap).

### 2.4 Listing page — `/listing/[slug]`
FR-09 to FR-13, US-02, US-03, US-06, US-07. **API:** `GET /listings/{slug}`.
1. Name, category, `OpenNowBadge`, `VerifiedDate`.
2. Big **Call** button (primary number) and **Directions** button.
3. Address and landmark; entrance photo if available.
4. Other phone numbers, each with its own Call button.
5. Opening hours for the week; today highlighted; past-midnight shown as "20:00 – 02:00 (next day)".
6. Services with fee ranges: "₦1,500 – ₦3,000 · estimate, collected 28 Sep 2026".
7. **Share** (WhatsApp / copy link) and `ReportLink`.
8. `Disclaimer`.
**404:** "This listing isn't available. It may be under re-verification." + link to search.

### 2.5 SwiftRescue — `/emergency`
**Interim version, until phase 7** (owner's addition with the home page redesign, 2026-10-11; FR-14, FR-02): a static page with
the `h1` "SwiftRescue", a large red **Call 112** button (a `tel:112` link, at least 64 px high with 24 px text, the `emergency`
colour with white text), the line **"Our full list of verified ambulance, fire and hospital emergency numbers is coming soon."**,
and the sentence of FR-26, always visible under it: **"SwiftRescue connects you to emergency contacts; it does not dispatch or
guarantee an emergency response. In danger, call 112."** (added at the owner's request, 2026-10-11). Nothing else: no list, no map,
no advice. 112 is the NCC's national emergency number (sources in
`specs/2026-10-11-home-redesign/requirements.md`, decision 18). Phase 7 replaces the whole page with the version below.

FR-14 to FR-19, FR-24 to FR-26, US-04, US-09, US-14. **API:** `GET /emergency`.
1. **112 card** at the top: "National emergency number — 112" with a large red **Call 112** button.
2. **Share my location** button (`ShareLocationButton`).
3. Groups in API order (Ambulance, Fire, Police, 24-hour emergency units, Roadside, Security, Blood banks), each a list of compact cards with Call buttons and distance.
4. **24-hour pharmacies nearby** section.
5. **Share emergency list** button: sends a plain-text list of names and numbers via WhatsApp or SMS.
6. Disclaimer from the API, always visible.
**Rules:** no sponsored content; no search box; one tap to call anything. Cached for offline use after the first visit (service worker).

### 2.6 Find blood — `/blood`
FR-27, US-15. **API:** `GET /blood/banks`, `GET /meta`.
1. Heading "Find blood" + tab switch: **Find blood** | **Donate blood** (`/blood/donate`).
2. Blood group chips (A+ … O−) and "Any".
3. List of blood banks, nearest first: name, distance, blood groups (chips), confirmed date, Call + Directions.
4. Notice on every card: "Stock changes daily; call to confirm before you go."

### 2.7 Donate blood — `/blood/donate`
FR-28, FR-29, US-16. **API:** `GET /blood/donation-centres`.
1. Heading "Donate blood" + same tab switch.
2. Short eligibility guide (content reviewed by the medical advisor, based on National Blood Service Agency guidance): who can usually donate, what to bring, how to prepare. Ends: "The blood bank will confirm if you can donate."
3. List of donation centres: name, donation hours, Call + Directions.

### 2.8 Report a problem — `/report/[id]`
FR-20, FR-21, US-08. **API:** `GET /listings/{slug}` (for the name), `POST /reports`.
1. "Report a problem with **[Listing name]**".
2. Reason as large radio buttons (from `/meta`).
3. Optional comment and optional phone ("only if you want us to follow up").
4. **Send report**. Under 3 taps for the fastest path (reason → send).
**Success:** "Thank you. We'll check this listing." + back to listing. **429:** "You've sent several reports. Please try again later."

### 2.9 List your facility — `/list-your-facility`
FR-37. **API:** `POST /facility-submissions`, `GET /meta`.
Form: facility name, category, area, address, phone, contact name, contact email, notes. **Success:** "Thanks. We'll verify your facility before it's listed."

### 2.10 Information pages
`/about`, `/how-we-verify`, `/privacy`, `/terms`, `/contact` (FR-23). Static content. Privacy explains NDPA handling (minimal data, reporter phone deleted after resolution, location never stored).

---

## 3. Staff screens (admin panel, `/admin`)

All staff screens require login; redirect to `/admin/login` if no valid token. Show only the links a role can use.

### 3.1 Login — `/admin/login`
FR-30. **API:** `POST /auth/login`, `POST /auth/verify-code`.
Step 1: email + password. Step 2: 6-digit code ("Sent to +234******0001"), with "Resend code" after 60 seconds.
On success, store the token and go to `/admin` (staff) or `/provider` (provider).

### 3.2 Dashboard — `/admin`
FR-34. Editor, admin. **API:** `GET /dashboard/stats`.
Stat cards: published, pending review, re-checks due this week, overdue, open reports (urgent in red). Recharts bar chart: checks passed/failed over 30 days. Quick links to the queues.
Verifiers land on `/admin/listings?mine=true` instead.

### 3.3 Listings — `/admin/listings`
**API:** `GET /listings`. Table (cards on mobile): name, category, area, status badge, next check due. Filters: status, area, category, search, "mine". **New listing** button.

### 3.4 Listing editor — `/admin/listings/new` and `/admin/listings/[id]`
FR-31, FR-42. **API:** `POST /listings`, `PATCH /listings/{id}`, `GET /listings/id/{id}`.
Sections: Basics (name, category, area, address, landmark) · Location (map pin + **Use my current location**) · Phones (add/remove, mark primary) · Opening hours (7 rows, closed toggle, past-midnight allowed) · Services and fees · Description.
Action bar by status and role: **Submit for review** (verifier), **Publish**, **Hide**, **Reopen** (editor/admin).
Unsaved-changes warning when leaving.

### 3.5 Verification log — `/admin/listings/[id]/checks`
FR-32, US-10. **API:** `POST /listings/{id}/checks`, `GET /listings/{id}/checks`, `POST /uploads/sign`.
Designed for a phone in the field: method (Call / Visit), result (Pass / Fail), person reached, notes, **Take photo** (uploads to Cloudinary). History below, newest first.

### 3.6 Reports queue — `/admin/reports`
FR-35, US-12. **API:** `GET /reports`, `PATCH /reports/{id}`.
Urgent first (red tag). Each: listing name (link), reason, comment, time ago. Buttons: **Open listing**, **Resolve**, **Dismiss**.

### 3.7 Re-checks — `/admin/recheck`
US-11. **API:** `GET /listings?due=overdue` and `?due=this_week`. Two tabs: Overdue · Due this week. Each row links to the verification log.

### 3.8 Staff and providers — `/admin/staff`
FR-41. Admin only. **API:** `/admin/users`. List, add user (name, email, phone, role, password), edit role, deactivate, link provider to listing.

### 3.9 Import and export — `/admin/import-export`
FR-39, FR-40. Admin only. Upload CSV → show created count and row errors. Download listings or checks CSV.

---

## 4. Provider screens (`/provider`)

### 4.1 Provider dashboard — `/provider`
**API:** `GET /provider/listing`. Shows listing status, last verified date, featured status ("Featured until 6 Nov 2026" or "Not featured"), and buttons: **Edit my facility**, **Get featured**.

### 4.2 Edit my facility — `/provider/edit`
**API:** `PATCH /provider/listing`. Editable: description, services and fees, opening hours, phones. Notice: "Changes to phone numbers or hours are re-verified by our team."

### 4.3 Get featured — `/provider/featured`
**API:** `POST /payments/featured`. Explains: "Featured listings appear first in matching searches with a Sponsored label for 30 days. Never shown in SwiftRescue." Price, then **Pay with Paystack** → redirect to `authorization_url`.

### 4.4 Payment complete — `/provider/payment-complete`
**API:** `GET /payments/verify/{reference}` (polls every 3 s for up to 30 s). Shows "Payment confirmed — featured until [date]" or "Still confirming… you can leave this page; we'll update your listing."
