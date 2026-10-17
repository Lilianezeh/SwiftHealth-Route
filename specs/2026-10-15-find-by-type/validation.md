# Validation: Find by type and home page wording

Spec: [requirements.md](requirements.md). Plan: [plan.md](plan.md). **Built (2026-10-17, Tasks 1 to 8); every box below is still open until the owner
has checked the preview.** Boxes are ticked at the end of the feature, with the evidence, after the owner has checked the preview. Check this file before
saying the feature is done. One pull request: stage 1 is Tasks 1 to 7; stage 2 is the photo banner (Task 8, the last task); the pull request is not merged
until both are checked.

## Build results (2026-10-17, before the owner's preview check)

- Frontend, in the container: `npm run lint` clean, `npm run typecheck` clean, **913 unit tests pass** (72 files; 833 on `main`), `npm run build` passes.
- Real browser (Playwright, on the dev site with the local database): `find-by-type.spec.ts` **21 of 21 pass** at 320, 360 and 768 px (tile, chip,
  typed word, empty words, "Near you" merged card, the banner and its order, no banner for hospital, position never in an address). The new home words
  are inside the screen at 320 to 1024 px (`home-layout.spec.ts`, 7 of 7 new checks).
- Size: `/search` is **9.36 kB** of its own JavaScript and **120 kB First Load** (the limit of D10, met exactly; it was 118 kB); `/` 113 kB and
  `/find` 115 kB; `/listing/[slug]` unchanged at 115 kB. The banner files are 11.6, 19.3 and 29.9 kB (clinic, laboratory, pharmacy).
- **Found, not caused by this feature (as in `LOG.md`):** on this machine's wide fallback font the header's Menu button is 11 px too far right between
  344 and 370 px on every page, so the older home-layout checks "fits the screen" (360 px) and "every 4th width" fail; they failed before this feature.
- **Found, caused by the owner's new hero words:** at 320 × 568 the "Find care near me" button ends at 662 px, below the first screen (568 px), in this
  machine's wide font; before it was about 21 px below the screen in the same font (`LOG.md`). On a real phone the font is narrower. The new hero line is
  longer: this is for the owner to judge on a phone (a smaller hero text or less space on small phones would bring the button back).
- One unit test (`SearchPage`, "shows the error with Retry...") failed once in one of three full runs under load and passed alone and in the other two:
  a timing flake of the existing test, not of this feature.
- Not looked at: real phones. The three photos show people (a nurse, a laboratory worker, a pharmacist), not patients; the owner approved them on
  2026-10-15, and Magnific's rules on people stay in the pre-launch checklist (`LOG.md`).

## Requirements checked by tests (stage 1)

- [ ] **D1, FR-01, US-01:** the home section heading is "Find by type" ("Browse by type" is gone from `src`); the five tiles go to `/search?category=<slug>` and are at
  least 48 px high; a results page for `?category=pharmacy` sends `category=pharmacy` to the API and shows only the pharmacies of a mocked answer; the Find shortcuts go to the same addresses
- [ ] **D2:** the type is the one `category` in the address; the heading, the chip and the Filters sheet read it and agree; `config/types.ts` has the same five slugs as the tiles
  and the shortcuts; a category outside the five (`?category=ambulance`) keeps the heading "Search results" and still shows a chip with its real name
- [ ] **D3, point 11:** with a position the headings are exactly "Hospitals near you", "Clinics near you", "Maternity homes near you", "Pharmacies near you", "Laboratories near you"; with no
  position and no area just "Hospitals", "Clinics", "Maternity homes", "Pharmacies", "Laboratories"; with an area "Pharmacies in Ogui" (the area wins over the position); "Search results" with no
  type; while the address is being read a placeholder shows, never the words "Search results"
- [ ] **D4, point 11, NFR-10:** the chip shows "Pharmacy" and a ✕ hidden from screen readers; its name is "Remove the Pharmacy filter"; it is a button at least 48 px high with 16 px text
  and the focus ring; a tap removes only `category` and keeps the text, area, service, open now, 24 hours, distance and `view=map`; the address is replaced with no history entry; the
  heading returns to "Search results"; focus moves to the `h1` and "Pharmacy filter removed" is announced politely; no chip without a type
- [ ] **D5, FR-04:** every word of the table applies its type; capitals, spaces, hyphens and dots are ignored; plurals work; "pharmacy ogui", "ambulance", "police", "fire", "blood", an
  empty text and a typing mistake apply nothing; `?q=pharmacy` makes one request with `category=pharmacy` and no `q`, then the address becomes `?category=pharmacy`; a typed type replaces a
  chosen one; the same type only clears the text; the Find page's plain form still sends `q` before any script has loaded
- [ ] **D7:** the exact home texts of the table (hero heading and line, Overview, "Why SwiftHealth Route" and its four cards, the owners section); the names come from `brand.name`; the old texts are
  gone; no text or description of the home page names a city; the approved page description is in the home page `metadata`; the page is still static and makes no request; one `h1`
- [ ] **D8:** the first line depends on whether a filter is on; the second line "We're starting in Enugu and adding more places soon." takes the city from `siteConfig.launchCity`; the component
  never contains the word "Enugu"; the "Near you" card messages are unchanged
- [ ] **D9, FR-03:** (a) two different answers show two cards; (b) the same first listing shows the second 24-hour listing in the second slot; (c) the same listing and no second one shows one
  card with both labels spanning both columns; (d) the 24-hour card never shows the pharmacy card's listing; (e) a failure or an empty answer in one card does not change the other; (f) no
  flicker: the 24-hour card waits for the pharmacy answer; (g) an empty pharmacy answer leaves the 24-hour card with its first result; (h) Retry works out the pair again
- [ ] **NFR-07:** the address, every request and every message hold no `lat` or `lng` and no position, in the heading, the chip, the type words, the "Near you" cards and the banner
- [ ] **NFR-01:** the First Load JS of `/search` is at or under 120 kB; the home page's first-load weight stays under 500 KB; no new package; no new script on the home page

## Real browser (Playwright, at 320, 360 and 768 px)

- [ ] No sideways scrolling and no text cut off on the home page (the hero heading and line, the Overview, the four cards, the owners section) and on `/search` (the heading, the chip, the empty text)
- [ ] The Pharmacy tile gives "Pharmacies near you", the chip and only pharmacies; the chip removes the filter and keeps the others; a typed "chemist" gives the same page with an empty search box
- [ ] The chip and the Filters button wrap instead of overflowing at 320 px
- [ ] The "Near you" cards: with one 24-hour pharmacy as the only 24-hour place, one card with both labels
- [ ] The hero, the cards and the owners section keep their layout at 768 px

## Commands (in the containers)

- [ ] `docker compose exec frontend npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- [ ] `docker compose exec backend pytest -q` and `docker compose exec backend ruff check .` (once; nothing changes there)

## Merge checklist, stage 1

- [ ] Lint, typecheck, the unit tests and the build are clean; the numbers are written here
- [ ] On the draft pull request, `Frontend CI` and `Backend CI` are green
- [ ] The UI spec 2.1, 2.2, 2.3, the roadmap and `LOG.md` are up to date
- [ ] **The owner checked the preview** (the home words and cards, the Find by type tiles, the heading and chip after a tile and after a typed word, the empty text, the "Near you" cards) and the pull
  request stays a draft until every box above is ticked

## The photo banner (stage 2, Task 8, the last task)

- [ ] **D6:** the banner shows only for a type whose photo is `approved: true`; a type without an approved photo shows no banner and no credit, and keeps its heading and chip
- [ ] **D6:** one `<img>` for the chosen type, none for the others (the network log shows one banner file); `width` and `height` are the real size of the file; each file is 960 × 320 and about 40 kB or less
- [ ] **D6:** alt text is short, factual and written after looking at the converted photo; no text sits on the photo; the order is heading, banner, credit, search box, chip
- [ ] **D6, NFR-13:** the credit "Designed by Magnific" and its link (the owner's address) show under the banner, on the search page only, only while a Magnific photo shows; the link has `rel="noopener noreferrer"`
- [ ] **D6:** a replaced photo has a new file name in the script and in the config; the cache header of `/images/*` is checked on the preview (`curl -I`)
- [ ] **D6, NFR-01:** the results and the chip do not wait for the picture; no layout shift when it loads (checked at 320, 360 and 768 px and on throttled 3G)
- [ ] **Photos (owner):** clinic, laboratory and pharmacy are `approved: true`; **hospital and maternity have `photo: null` and show no banner** until the owner replaces the photos or has read Magnific's
  rules on people and switches them on (a test checks both flags, and that the Hospital and Maternity pages show a heading and chip but no banner and no credit)
- [x] **Credit:** the owner confirmed on 2026-10-15, against Magnific's "Licenses and attribution" page, that the text must read "Designed by Magnific" with a link to www.magnific.com, next to the resource (my tools got 403 from that page; the owner read it)
- [ ] **NFR-13 (owner, before launch):** the Magnific licence and attribution terms read by the owner, with the licence file of each downloaded photo. This repo makes no legal claim about them
- [ ] **Merge checklist, one pull request:** lint, typecheck, tests and build clean; both CIs green; the owner checked the preview; the UI spec 2.3, `validation.md`, the roadmap and `LOG.md` updated; the plan boxes of Task 8 ticked

## Security and privacy checklist

- [ ] No new package; no `dangerouslySetInnerHTML`; the typed text, the category from the address and the chip label are rendered as text only
- [ ] A category taken from the address is never put into an address or a request without being encoded (the existing `filtersToQuery`)
- [ ] External links (the credit) use `rel="noopener noreferrer"`
- [ ] No position of the visitor in any address, message or request that this feature adds (NFR-07)
- [ ] The Magnific credit and licence are the owner's to check; no legal claim is made in the code or the spec
