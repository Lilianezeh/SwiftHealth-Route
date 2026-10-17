# Requirements: Find by type and home page wording

Branch `feature/find-by-type`. Status: **spec updated with the owner's answers (2026-10-15). No code yet.** Nothing is built until the owner has
confirmed the two short lists at the end (the type words and the empty-results words), confirmed the Magnific credit (D6), and said go on the plan.
Roadmap: "Find by type and home page wording" (after phase 6b). **Frontend only**: the search API already filters on the exact category slug, so there
is no backend change, no new table, no new package.
Source: the owner's points 1 to 11 in `LOG.md` ("To do later", "Next feature after the listing page"), and the owner's answers of 2026-10-15 (the
five plural headings, `clinic.jpg` and `laboratory.jpg` approved, `hospital.jpg` and `maternity.jpg` to be replaced, the banner is the last task).

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| US-01 | Find pharmacies open now near me (the results page must make a chosen type obvious) | Must |
| US-05 | Search by service or type and get only what matches | Must |
| US-13 | Use the site on a slow connection (the home page and the results page stay light) | Must |
| FR-01 | The Find page: a search box and category shortcuts | Must |
| FR-03 | The Find page "Near you" cards (the duplicate-place fix) | Must |
| FR-04 | Search by name, category or service, tolerant of misspellings (a typed type word applies the type) | Must |
| FR-05 | Filters: category, service, open now, 24 hours, distance (the chosen category is shown and removable) | Must |
| FR-06 | Results sort by distance; each result shows name, category, distance, status, Call and Directions | Must |
| NFR-01 | Small and fast: the banner downloads only for the chosen type; no new script | Must |
| NFR-04 | Works from 320 px; the search box still works as a plain form | Must |
| NFR-07 | Privacy: the visitor's position is never in an address or a message | Must |
| NFR-10 | Accessibility: tap targets of 48 px, text of 16 px, screen readers (the chip, the heading, the focus) | Must |
| NFR-13 | Liability: the licence and the credit of the Magnific photos are checked by the owner before they are shown | Must |

## Where each of the owner's points went (nothing is missed)

| LOG.md point | What it says, in short | Decision | Plan task |
| --- | --- | --- | --- |
| 1 | Rename "Browse by type" to "Find by type" | D1 | Task 1 |
| 2 | A type tile shows only that type (already true; keep it, and prove it with a test) | D1 | Task 1 |
| 3 | A type word typed in the search box applies that type's filter (the word list) | D5 | Task 3 |
| 4 | A slim photo banner for the chosen type, with its heading, the Magnific credit, one config file, new file names | D6 (and the heading in D3) | Task 8 (the last task) |
| 5 | "Why SwiftHealth Route" heading and the four cards | D7 | Task 6 |
| 6 | The facility owners section words | D7 | Task 6 |
| 7 | The hero, the Overview and the page description | D7 | Task 6 |
| 8 | Empty search results: the first line, the second line with the city | D8 | Task 4 |
| 9 | Every new headline, line and card fits at 320, 360 and 768 px | D10 | Task 7 |
| 10 | The "Near you" cards never show the same place twice | D9 | Task 5 |
| 11 | A chosen type is clearly visible: the heading "Pharmacies near you" and the "Pharmacy ✕" chip | D2, D3, D4 | Task 2 |
| Owner, 2026-10-15 | The five headings: Hospitals / Clinics / Maternity homes / Pharmacies / Laboratories near you | D3 | Task 2 |
| Owner, 2026-10-15 | Photos: `hospital.jpg` and `maternity.jpg` must be replaced first, `pharmacy.jpg` optional, the banner last, no banner for a type without an approved photo | D6 | Task 8 |

## Decisions

### D1. The home section "Find by type", and the tiles (points 1 and 2)
- The section heading `h2` reads **"Find by type"** (it reads "Browse by type" today). The component `BrowseByType.tsx` becomes `FindByType.tsx` and the
  words key `HOME_WORDS.browse` becomes `HOME_WORDS.findByType`, so the code uses the same words as the page.
- The five tiles stay: **Hospital, Clinic, Maternity, Pharmacy, Laboratory**, each a link to `/search?category=<slug>`
  (`hospital`, `clinic`, `maternity`, `pharmacy`, `laboratory`), at least 48 px high.
- **A tile shows only that type.** Checked on 2026-10-13: the API filters on the exact slug (live: hospital 4, clinic 2, maternity 2, pharmacy 6,
  laboratory 2, each only its own type). A test keeps it true: the request made for `/search?category=pharmacy` carries `category=pharmacy`, and a
  mocked answer with only pharmacies shows only pharmacies. The Find page shortcuts (Hospitals, Clinics, Pharmacies, Maternity, Labs) go to the same addresses.

### D2. The chosen type is one thing: the `category` in the address (point 11)
- The type that is "chosen" is the `category` slug in the page address. It comes from a tile, a Find shortcut, a shared link, the Filters sheet or a
  typed type word (D5, which turns the word into `category` in the address). The heading (D3), the chip (D4), the banner (D6), the Filters sheet and the
  API request all read this one value, so they can never disagree.
- One config file, `src/config/types.ts`, holds for each of the five types: the slug, the chip label (singular), the heading (plural, D3) and the
  photo entry (D6). A test checks that its slugs are the ones of the tiles and of the Find shortcuts, and that no slug is missing.
- A category that is not one of the five (for example `?category=ambulance` from a shared link; the emergency categories are not offered in the Filters
  sheet but stay selected when they come from a link): the heading stays "Search results", and the chip still shows, with the category's real name from
  `GET /meta` (and the slug itself if even that is not known), so a filtered page never looks unfiltered.

### D3. The heading (points 4 and 11)
- With a chosen type, the page `h1` changes from **"Search results"** to:
  **"Hospitals near you"**, **"Clinics near you"**, **"Maternity homes near you"**, **"Pharmacies near you"**, **"Laboratories near you"**
  (the owner's words, 2026-10-15). With no type, or a type that is not one of the five, it stays **"Search results"**.
- **"near you" only when it is true** (owner, 2026-10-15). With a chosen type, the heading depends on where the results are anchored; the first row that applies wins:

| The results are... | Heading | Example |
| --- | --- | --- |
| filtered to an **area** (`area` in the address, from the Filters sheet) | **"<Type> in <Area>"** | **Pharmacies in Ogui** |
| sorted from the visitor's **position** (no area filter) | **"<Type> near you"** | Pharmacies near you |
| neither (no position shared, no area) | **"<Type>"** alone | Pharmacies |

  "<Type>" is the plural of the table above (Hospitals, Clinics, Maternity homes, Pharmacies, Laboratories). The area's name is rendered as text, exactly as
  `GET /meta` gives it. The position itself is never in the heading or the address.
- The heading is written by the client part of the page (the address is read in the browser, as the results are), so the `h1` moves from `page.tsx`
  into a small client component inside the existing `<Suspense>`. While the address is being read the page shows a **grey placeholder bar** of the same
  height (with the words "Loading results" for screen readers only), **not** the words "Search results", so a visitor on a slow connection never sees
  the plain heading for a few seconds before it changes. The tab title does not change in this feature.
- The heading never depends on a photo: it is the same with or without the banner (D6).

### D4. The chip (point 11)
- Whenever a category is chosen, a **chip** shows **under the search box**: the type's name and a ✕, for example **"Pharmacy ✕"**. The label is the
  singular name (Hospital, Clinic, Maternity, Pharmacy, Laboratory; D2 for other categories).
- **One tap removes the type.** The address loses `category` and keeps everything else (the typed text, area, service, open now, 24 hours, distance,
  `view=map`). The address is replaced, with no history entry, as for every filter change. The heading goes back to "Search results" and the
  results to all types.
- The chip is a real `<button>`, at least **48 px** high, text **16 px**, in the existing colour tokens (no red). The ✕ is an icon hidden from screen
  readers. The accessible name is **"Remove the Pharmacy filter"** (the type's name). It is a normal tab stop with the visible focus ring.
- **Focus and announcement.** After the chip is used it is gone, so focus goes to the page heading (the `h1`, made focusable with `tabindex="-1"`), and a
  polite live region says "Pharmacy filter removed". Nobody is left with focus on nothing.
- Only the category gets a chip (the owner's request). The other filters stay in the Filters sheet as today.
- No position and no new field in the address: the chip adds nothing to what the search already sends (NFR-07).

### D5. Typed type words (point 3)
- **When the whole query is a type word, the type's filter is applied**, as if the visitor had tapped the tile. "pharmacy ogui" is not a type word and
  stays a text search.
- **How a word is matched** (one pure function, `resolveTypeWord(text)`, in `lib/search/typeWords.ts`, with the words in `config/typeWords.ts`):
  1. Keep only letters and digits, lower case ("Drug store", "drug-store", "DRUGSTORE" and " drug  store " are the same).
  2. Compare with the list below, written without spaces. If that is not in the list, try again without a final "s", and with a final "ies" turned
     into "y" (so "pharmacies" finds "pharmacy"). The list also holds the words that end in "s" on purpose, such as "diagnostics".
  3. No match: nothing changes and the text is searched as before (the fuzzy text search still handles typing mistakes).
- **The words (proposed for Nigerian usage; the owner reviews this list in the spec review):**

| Type | Words that apply it |
| --- | --- |
| pharmacy | pharmacy, pharmacies, chemist, chemists, chemist shop, drug store, drugstore, patent medicine, PPMV |
| hospital | hospital, hospitals, general hospital, teaching hospital, medical centre, medical center |
| clinic | clinic, clinics, health centre, health center, PHC, primary health centre, dispensary |
| maternity | maternity, maternity home, maternity centre, maternity center, midwife, antenatal, birth centre, birth center (the last three added by the owner, 2026-10-15) |
| laboratory | lab, labs, laboratory, laboratories, medical lab, diagnostic, diagnostics, diagnostic centre, diagnostic center |

- **Not mapped on purpose:** ambulance, police, fire and blood. They belong to SwiftRescue and the Blood page, not to everyday search.
- **What happens in the address.** The results page works out the filters from the address **first**, with the type word already turned into
  `category` and `q` removed, so there is **one search request, not two**. Then it replaces the address (no history entry) so that it reads
  `/search?category=pharmacy`: the chip, the heading, the Filters sheet and a shared link all agree, and the search box is empty.
- **A type word on top of a chosen type.** If a category is already chosen and the visitor types a type word, the typed type replaces it (the visitor
  said it last). The same type again only clears the text. (The owner confirms this in the review.)
- This works from the Find page too: its search box is a plain form that goes to `/search?q=pharmacy`, so it works before any script has loaded and the
  results page does the rest.

### D6. The photo banner (point 4) — the last task
- **When it shows.** A slim photo banner at the top of the results, **only** when a type is chosen **and** that type has a photo marked
  **`approved: true`** in the config. A type without an approved photo shows **no banner and no credit**; its heading and chip work exactly the same
  (D3, D4). The photos are approved by the owner, one by one, in `config/types.ts`. The originals are in `/mnt/c/Users/Lilian/Desktop/IMAGES/`.
  **The owner's answer of 2026-10-15: use the Magnific photos we already have, approved for now; hospital and maternity may be replaced later.**
  One exception, from the owner's own rule ("if the licence is unclear, keep the hospital banner off"):

| Type | File | `approved` in the config | Why |
| --- | --- | --- | --- |
| clinic | `clinic.jpg` | **true** | approved by the owner (no faces, no brand names found) |
| laboratory | `laboratory.jpg` | **true** | approved by the owner (no faces, no brand names found) |
| pharmacy | `pharmacy.jpg` | **true** | approved by the owner for now (the hands look a little unnatural, it may be AI-made) |
| maternity | `maternity.jpg` | **false** | **off for now (owner, 2026-10-15, after the spec review)**: a doctor consultation with a pill bottle, not a maternity scene, and it shows a person; to be replaced later, then switched on |
| hospital | `hospital.jpg` | **false** | a patient's face is clearly visible, and Magnific's rules on people shown in a way that could harm or imply endorsement could not be read in full (see "Magnific's rules" below); it is also a tall 9:16 portrait that needs a hand-made 3:1 cut. **No hospital banner until the owner has read the rules and sets it to `true` (or replaces the photo)** |

  **As built:** the config has `photo: null` for hospital and maternity (no file is made for them), and an entry with `approved: true` for the other three
  (an entry can also be written with `approved: false` to keep a ready photo off). Switching hospital or maternity on later is one new file and one entry
  in `config/types.ts`, with no other code. A type with no approved photo shows no banner and no credit, and its heading and chip work as for every type.
- **What the banner is.** One `<img>` of one WebP file for the chosen type, **960 × 320 (3:1)**, **about 40 kB or less**, with a fixed `width` and
  `height`, alt text and no text inside the picture. It fills the content width. **Size (revised by the owner after the preview check, 2026-10-17):**
  on a **phone (below 768 px)** it is the whole 3:1 picture as before (about 114 px high at 343 px wide); **from 768 px (tablet and laptop)** it is
  **140 px high** (about half the old 224 px) and **cropped** with `object-fit: cover`, keeping the part named by a per-photo `focus` (CSS
  object-position, in `config/types.ts`: clinic `50% 40%`, pharmacy `50% 35%`, laboratory `50% 30%`, so each face stays in view). The same files are used,
  so no new file names. The heading is **above** it, as plain text, so no text sits on the photo and contrast never depends on the picture. The order on the page is:
  heading, banner, credit, then the search box with the chip under it, then the Filters button and the results. **Only the chosen type's photo downloads**: one `<img>` whose `src` is the chosen file, never five loaded
  and hidden (the same rule as the Phase 10 idea in `LOG.md`).
- **The files.** Made by a new `scripts/optimize-type-banners.mjs` (the style of `scripts/optimize-home-images.mjs`; `sharp` is not in `package.json`)
  from the originals in `frontend/image-sources/` (not committed), cut to 3:1 by hand where needed, each under its budget. Written to
  `public/images/types/`. A **replaced photo gets a new file name** (`banner-<slug>-1.webp`, then `-2`...) because `netlify.toml` caches `/images/*` for
  a year (`immutable`): the name in the script and the `src` in the config change together. A test checks that `width` and `height` are the real size of
  each file and that each file is under its budget (like `homeImages.test.ts`).
- **Alt text** is written after looking at each converted photo: short, factual, no medical claim, no brand name.
- **The credit.** **"Designed by Magnific"**, a link to **<https://www.magnific.com>**, shows **under the banner** (next to the photo it credits), on the
  search page only, and **only while a Magnific photo is showing**. The text and the link address are in the same config file as the photos, so Unsplash
  photos can replace them later (an Unsplash photo has its own credit entry, or none). The link opens in a new tab with `rel="noopener noreferrer"`
  and says "(opens in a new tab)" to screen readers, in a visible colour (never hidden or tiny). **Revised by the owner, 2026-10-17: it sits tight under the
  photo** (no gap, a hair of space above the text) **and stays 16 px text (NFR-10; the owner chose this over 14 px)**; its 48 px tap area reaches down below the text.
  - **Where this comes from.** In the git history of PR #21 the footer credit was `{ text: "Images designed by Magnific", href: "https://www.magnific.com" }`
    (commit `c5d2758`, `config/site.ts`; it was removed in `1f1cdcc` on 2026-10-12 when the photos were replaced). The wording the owner gave for this
    feature is "Designed by Magnific"; Magnific's help page "Licenses and attribution" is reported by search results (see "Magnific's rules" below) to ask for
    **"Designed by Magnific" with a link to magnific.com**, in a visible spot next to the resource, or else in the site footer. So the plan uses
    **"Designed by Magnific" under the banner** (the preferred place), not the old footer wording. The owner confirms this on the live page before Task 8.
- **Photo rules.** No readable brand names. The licence and attribution terms of the Magnific photos are the owner's to check (NFR-13); this repo makes no
  legal claim about them. A photo of an identifiable person is the case to look at twice (the hospital photo, and the doctor in the maternity photo).
- **Magnific's rules (what I could and could not read, 2026-10-15).** Magnific's own pages <https://www.magnific.com/ai/docs/licenses-attribution> and
  <https://www.magnific.com/ai/docs/usage-rights-general-rules> answered **403 Forbidden** to my tools (a bot block), so **I could not read them and
  cannot quote them word for word**; I did not try to get round the block. What search results report, as a summary and not a quotation: the free licence
  **always requires attribution** ("Designed by Magnific" with a link to magnific.com, visible, next to the resource where possible, otherwise the footer
  or a credits page; a hidden or hard-to-read credit does not count); Magnific content must not be used in a way that is defamatory, obscene or offensive,
  or in a context that could harm the reputation of the author, Magnific or **the people depicted**, including **implying that a depicted person endorses
  a product, service or cause without consent**; attribution does not cure that. **Nothing I found says that health or medical contexts are allowed or
  forbidden.** Because the answer about a patient's face on a hospital directory is therefore unclear, the hospital banner is off (the table above).
  The owner reads the two pages in a browser and the licence file of each downloaded photo.
- **Slow data.** The banner never delays the results: the results and the chip do not wait for the picture, and the picture has its size reserved, so
  nothing jumps when it loads (no layout shift).

### D7. The home page words (points 5, 6 and 7)
These are the owner's words, exactly. They replace the text in `config/home.ts`; the brand name comes from `config/brand.ts` (`brand.name`).

| Part | Today | New (exact text) |
| --- | --- | --- |
| Hero heading (`h1`) | Find open care near you, fast. | **Find care that's open now, near you.** |
| Hero line | Hospitals, pharmacies and emergency help, open near you. | **Verified hospitals, clinics, pharmacies and labs, with phone numbers, opening hours and directions.** |
| Hero button and note | Find care near me · Free to use · No sign-up needed | unchanged |
| Overview heading | Overview | **What is {brand.name}?** (renders "What is SwiftHealth Route?") |
| Overview text | {brand.name} helps you find hospitals, clinics, pharmacies, labs and emergency contacts that are open right now. Every listing is checked by our team, so the number you call and the hours you see are ones you can trust. | **{brand.name} is a healthcare directory built for Nigeria. Find hospitals, clinics, maternity homes, pharmacies and laboratories near you, see which are open right now, and call or get directions in one tap. Our team checks every listing before it goes live and re-checks it regularly.** ("Built for Nigeria" stays: the owner's decision.) |
| "Why" heading | Benefits | **Why {brand.name}** (renders "Why SwiftHealth Route") |
| Card 1 | Verified listings: We check every listing before it goes live. | **Verified information**: Our team checks each listing before it goes live and re-checks it regularly. |
| Card 2 | Open now means open now: Hours follow local time, including late-night places. | **See what's open now**: Find places open right now, including late-night and 24-hour services. |
| Card 3 | Works on slow data: Light pages that load on a weak connection. | **Built for mobile data**: Light pages built for a weak connection. |
| Card 4 | Your location stays private: Your position stays in your browser and is used only to find places near you. | **Your location stays private**: Your location is used only to show places near you. We don't store it. |
| Owners heading | Run a hospital, clinic or pharmacy? | **Own or manage a healthcare facility?** |
| Owners text | List your facility for free and help people find you when they need you. We verify every listing before it goes live. | **List your facility on {brand.name} so people nearby can find you, call you and get directions. Listing is free during our launch, and every listing is checked by our team before it goes live.** |
| Owners button | List your facility | unchanged (the page behind it is still "Coming soon", phase 10) |
| Page description (the home page) | the site-wide one: "SwiftHealth Route: Emergency, Hospital & Pharmacy Finder. Verified listings and one-tap calling." | **proposed:** "{brand.name} is a healthcare directory built for Nigeria. Find hospitals, clinics, maternity homes, pharmacies and laboratories near you." (the owner's answer 4: fine when it matches the agreed Overview wording, which it does: the Overview's first sentence and the first part of its second one, word for word; a test compares them) |

- **Checked facts.** "Your location ... We don't store it": the position is kept in the browser tab and sent to the API for each search; the API does not
  store it and scrubs `lat` and `lng` from its logs (api-spec, "Privacy (NFR-07)"). "Free during our launch" is the owner's decision, recorded in
  `specs/prd.md` (Open questions).
- **No city on the home page.** None of these texts names a city (the 2026-10-12 rule), and none says "Enugu only".
- The four cards keep their icons, in the same order (BadgeCheck, Clock, Signal, Lock); the headings keep their ids.
- **Not changed here** (`LOG.md`, Overview notes): the sentence "If a number doesn't work, you can tell us so we can fix it." comes back when the
  report form is live (roadmap Phase 9a). **The WhatsApp wording stays out** (owner's answer 3, 2026-10-15): the Overview keeps "call or get directions in
  one tap" until real listings have WhatsApp numbers.
- **A risk, not a decision.** The new hero line and the cards say "Verified" while the live site still shows four fictional demo listings. That is already
  in `LOG.md` ("Before public launch: remove or clearly mark the demo listings"); this feature does not change it.

### D8. Empty search results (point 8)
- Two lines, both inside the existing note box of `SearchStatus`:
  - **A filter is on** (any of: text, type, service, area, open now, 24 hours, distance): **"No matches. Try removing a filter or widening the distance."**
  - **No filter** (a plain `/search`): **"No places found near you yet."**
  - **Second line, in both cases: "We're starting in {launchCity} and adding more places soon."** The city comes from `siteConfig.launchCity`
    (today "Enugu"); the words "Enugu" are never written into the component, so nothing is tied to Enugu only. A test fails if the component names the
    city. The search page may name the city; the home page does not.
- Not changed: the "Near you" card empty messages ("No open pharmacy found nearby", "No 24-hour place found nearby", "Try a wider search.") keep their words.
- The owner confirms the exact words from the short list at the end of this file.

### D9. "Near you" never shows the same place twice (point 10)
- Seen on the live site: the same listing was both "Closest open pharmacy" and "Closest open 24-hour place". Today each card loads on its own with
  `limit=1`, so neither knows what the other shows.
- **Rule.** The pharmacy card asks for 1 result, the 24-hour card asks for **2** (the API allows a limit of up to 100). The 24-hour card shows the first of its
  results that is **not** the pharmacy card's listing.
  - Different first listings: two cards, as today.
  - The same listing first, and a second 24-hour listing exists: the 24-hour card shows the **second** one.
  - The same listing and **no** other 24-hour place: **one card carrying both labels** ("Closest open pharmacy" and "Closest open 24-hour place"),
    spanning both columns of the grid (`sm:col-span-2`), instead of two identical cards. Its accessible name holds both labels.
  - The 24-hour card never shows a listing that the pharmacy card shows.
- **Independence is kept.** The two requests still go out at the same time. A failure or an empty answer in one card does not change the other: if the
  pharmacy card fails or is empty, the 24-hour card shows its first result; if the 24-hour card fails, the pharmacy card shows alone with its Retry for
  the other. A Retry on one card re-works out the pair.
- **No flicker.** The 24-hour card does not show a listing until the pharmacy answer is in (its skeleton stays), so it never shows a place and then
  replaces it.
- With only an area (no position) the same rule applies, with no distance shown. **No position in any address**, as today (NFR-07).
- Code: the hook becomes `useNearbyListings(filters, position, area, limit)` and returns up to `limit` listings; `NearbySuggestions` does the comparison.
  The UI spec 2.2 item 6 is updated in the same change.

### D10. It all fits (point 9)
Every new headline, line, card, chip and note is checked in a real browser at **320, 360 and 768 px**: no text cut off, no sideways scrolling, the hero
heading and line wrap, the chip wraps instead of overflowing, the four cards and the owners section keep their layout. The home page keeps its
first-load weight under 500 KB (NFR-01), and the results page's own JavaScript stays small: the First Load JS of `/search` stays at or under **120 kB**
(it is 118 kB today, with the map in a separate chunk), and the banner is not JavaScript. (The layout checks depend on the browser's fallback font:
`LOG.md`, "The layout checks depend on the browser's fallback font"; this feature's checks use the same setup as the listing page's.)

### D11. Documents
Spec first, then code: after the owner's review, `specs/frontend/ui-spec.md` is updated (2.1 the home page words and the section name, 2.2 item 6 the
"Near you" rule, 2.3 the heading, the chip, the empty text and the banner), and the roadmap and `LOG.md` once, at the end of the feature (the banner is the
last task, in the same pull request).

## Out of scope for this feature
- Chips for filters other than the type (service, area, open now...): they stay in the Filters sheet.
- Typed words for emergency types (ambulance, police, fire, blood).
- A WhatsApp button on the result cards, the pricing decision, removing or marking the demo listings, the Total Blocking Time of the home page: separate
  items in `LOG.md`.
- Photos on the facility owner sign-up and login pages (the Phase 10 idea): the same five photos will be reused there later, with the same approval.
- Changing the tab title for a chosen type, any API change, any analytics of the search term.

## The owner's answers (2026-10-15)
1. **Photos:** use the Magnific photos we already have for all five types, approved for now; hospital and maternity may be replaced later. **Applied in D6,
   with one exception:** the hospital banner is off (`approved: false`) because Magnific's rules on people could not be read in full (the owner's own
   rule: "if it is not allowed or unclear, keep the hospital banner off"). The owner reads the rules and switches it on, or replaces the photo.
2. **Magnific credit:** found in the git history (commit `c5d2758`, removed in `1f1cdcc`): "Images designed by Magnific" linking to <https://www.magnific.com>.
   **Proposed for the banner: "Designed by Magnific", linking to <https://www.magnific.com>, under the banner** (D6). The owner confirms before Task 8 starts.
3. **Overview:** keep "call or get directions in one tap" until real listings have WhatsApp numbers (D7 already says so).
4. **Home page description:** fine if it matches the agreed Overview wording. It is the Overview's first sentence and the first part of its second one, word for word, with
   "built for Nigeria" and no city (D7); a test compares the two texts.
5. **Type words and empty-results wording:** the owner confirms them from the short list below, then they are final.
6. **No position:** just "Pharmacies" (no "near you"), and with a chosen area "Pharmacies in Ogui" (D3).
7. **One pull request:** the banner is in this same pull request, as the last task (Task 8). The pull request is not merged until Task 8 is done.
8. **A typed type word replaces the current type chip** (D5).

## Approved by the owner (2026-10-15, second review)
- **Go ahead with the plan, tests first.** The type words (with "antenatal", "birth centre" and "birth center" added to Maternity), the empty-results
  wording and the heading rules are approved as written below and in D3, D5 and D8.
- **The credit is confirmed:** the owner checked <https://www.magnific.com/ai/docs/licenses-attribution>: the text must read **"Designed by Magnific"**
  with a link to **www.magnific.com**, **next to the resource**. D6 uses exactly that, under the banner.
- **Hospital and maternity banners stay off for now** (`approved: false` for both); clinic, laboratory and pharmacy are `approved: true`.

## The short lists (approved)

**Type words** (capitals, spaces, hyphens and dots are ignored; a plural is accepted; the whole query must be the word):
- Pharmacy: pharmacy, pharmacies, chemist, chemists, chemist shop, drug store, drugstore, patent medicine, PPMV
- Hospital: hospital, hospitals, general hospital, teaching hospital, medical centre, medical center
- Clinic: clinic, clinics, health centre, health center, PHC, primary health centre, dispensary
- Maternity: maternity, maternity home, maternity centre, maternity center, midwife, antenatal, birth centre, birth center
- Laboratory: lab, labs, laboratory, laboratories, medical lab, diagnostic, diagnostics, diagnostic centre, diagnostic center
- Not mapped: ambulance, police, fire, blood.

**Empty search results** (the first line depends on whether any filter is on, text included; the second line always follows):
- A filter is on: "No matches. Try removing a filter or widening the distance."
- No filter: "No places found near you yet."
- Second line, both cases: "We're starting in Enugu and adding more places soon." (the city comes from `siteConfig.launchCity`, never written into the component)
