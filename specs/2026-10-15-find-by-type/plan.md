# Plan: Find by type and home page wording

Spec: [requirements.md](requirements.md). Validation: [validation.md](validation.md). Branch `feature/find-by-type`.
**Status: updated with the owner's answers (2026-10-15). Nothing below is started.** The owner confirms the type words, the empty-results words and the
Magnific credit (end of `requirements.md`) and gives the go-ahead on this plan first. Every task is tests first. Boxes are ticked with their commit hash
at the end of the feature, after the owner has checked the preview (as for the home page and the listing page). **One pull request**, with the banner as
its last task (owner, 2026-10-15); it stays a draft and is not merged until Task 8 is done.

Frontend only; no API change, no new table, no new package.

## Files that will change or appear (frontend)
- `config/types.ts` (new): for each of the five types the slug, the chip label, the plural heading, and the photo entry (`src`, `width`, `height`,
  `alt`, `approved`, `credit`). `config/typeWords.ts` (new): the type words of D5.
- `lib/search/typeWords.ts` (new): `resolveTypeWord(text)`. `lib/search/searchQuery.ts`: only if a helper to remove one filter is needed.
- `components/search/SearchHeading.tsx` (new, client): the `h1` and its placeholder. `components/search/TypeChip.tsx` (new, client). `SearchResults.tsx`:
  works out the filters with the type word applied, replaces the address, shows the chip. `app/(public)/search/page.tsx`: the `h1` moves out.
  `components/search/SearchStatus.tsx`: the empty text (D8). `components/search/TypeBanner.tsx` (new, Task 8).
- `hooks/useNearbyListing.ts` becomes `useNearbyListings` (a `limit`, a list); `components/search/NearbySuggestions.tsx` (D9).
- `components/home/BrowseByType.tsx` becomes `FindByType.tsx`; `config/home.ts` (the words, D7); `components/home/WhySwiftHealth.tsx`, `Overview.tsx`,
  `FacilityOwners.tsx`, `HomeHero.tsx` (they read the words); the home page `metadata` (the description).
- Task 8 only: `scripts/optimize-type-banners.mjs` (new), `public/images/types/` (new), `netlify.toml` is unchanged (`/images/*` is already cached for a year).
- Tests: `tests/unit/` for each piece, `tests/end-to-end/find-by-type.spec.ts` (new) and an extension of `home-layout.spec.ts`.
- Docs: `specs/frontend/ui-spec.md` 2.1, 2.2, 2.3 (Task 0), the roadmap, `LOG.md`.

## Stages
- **Stage 1: Tasks 1 to 7.** Everything except the banner. It is built and checked on the preview first.
- **Stage 2: Task 8, the photo banner, the last task, in the same pull request.** All five photos are approved for now except the hospital one (`approved:
  false` until the owner has read Magnific's rules); it starts after the owner confirms the credit.

## Tasks (tests first in every task)

### Task 0: the spec
- [ ] `requirements.md`, `plan.md`, `validation.md` written (the three feature files only, 2026-10-15); the owner reviews.
- [ ] After the owner's answers: the questions are answered in `requirements.md`, then `specs/frontend/ui-spec.md` 2.1, 2.2 and 2.3 are updated (spec first, then code).

### Task 1: the home section "Find by type", and the tiles (D1)
- [ ] Tests first: the section heading is "Find by type" and "Browse by type" is gone from `src`; the five tiles are Hospital, Clinic, Maternity, Pharmacy,
  Laboratory, each a link to `/search?category=<slug>` at least 48 px high; a results page for `?category=pharmacy` sends `category=pharmacy` to the API and
  shows only the pharmacies of a mocked answer; the Find shortcuts go to the same addresses; `config/types.ts` has the same five slugs as the tiles and the shortcuts.
- [ ] Add `config/types.ts` (slug, chip label, heading; photos come in Task 8). Rename `BrowseByType.tsx` to `FindByType.tsx` and `HOME_WORDS.browse` to `findByType`.

### Task 2: the heading and the chip (D2, D3, D4)
- [ ] Tests first: with a position the `h1` is "Hospitals near you", "Clinics near you", "Maternity homes near you", "Pharmacies near you", "Laboratories near you"; with
  no position and no area it is "Hospitals", "Clinics", "Maternity homes", "Pharmacies", "Laboratories"; with an `area` in the address it is "Pharmacies in Ogui" (an area wins over a
  position, and the area's name is shown as text); with no type, or `?category=ambulance`, it is "Search results"; the placeholder shows (and not "Search results") until the address is read;
  the chip shows "Pharmacy" with a ✕ hidden from screen readers, its name is "Remove the Pharmacy filter", it is a button at least 48 px high with 16 px text;
  a tap removes only `category` (the typed text, area, service, open now, 24 hours, distance and `view=map` stay), replaces the address with no history entry, brings back
  "Search results", moves focus to the `h1` and announces "Pharmacy filter removed" in a polite live region; no chip when no type is chosen; a category outside the five
  gets a chip with its name from `GET /meta` (the slug if unknown); the Filters sheet agrees with the chip; the address and every request hold no position.
- [ ] Add `SearchHeading` and `TypeChip`, move the `h1` out of `page.tsx`, show the chip under the search box in `SearchResults`.

### Task 3: typed type words (D5)
- [ ] Tests first for `resolveTypeWord`: every word of the table gives its type; capitals, spaces, hyphens and dots do not matter ("Drug-Store", "chemist  shop", "P.P.M.V");
  plural forms ("pharmacies", "labs", "chemists") work; "pharmacy ogui", "ambulance", "police", "fire", "blood", an empty text and a typing mistake ("farmacy") give nothing.
  For the page: `?q=pharmacy` makes **one** request, with `category=pharmacy` and no `q`; the address is then replaced by `?category=pharmacy` (no history entry), the heading
  and chip show the type and the search box is empty; `?q=pharmacy ogui` stays a text search; a chosen type plus a different type word replaces the type; the same type word
  only clears the text; the other filters are kept; the Find page's plain form still sends `q`; no position anywhere.
- [ ] Add `config/typeWords.ts` and `lib/search/typeWords.ts`; use them in `SearchResults` (filters worked out first, then the address replaced).

### Task 4: empty results (D8)
- [ ] Tests first: with any filter on (text, type, service, area, open now, 24 hours, distance) the first line is "No matches. Try removing a filter or widening the distance.";
  with none it is "No places found near you yet."; both show "We're starting in Enugu and adding more places soon." with the city read from `siteConfig.launchCity` (a test
  changes the constant and sees the sentence change; another fails if the component's source contains the word "Enugu"); the "Near you" card messages are unchanged.
- [ ] Update `SearchStatus` (it needs to know whether a filter is on).

### Task 5: "Near you" never shows the same place twice (D9)
- [ ] Tests first (the five cases of the owner, plus three): (a) two different answers show two cards; (b) the same listing first in both shows the second 24-hour listing in
  the second slot; (c) the same listing and no second one shows one card with both labels, spanning both columns, named by both labels; (d) the 24-hour card never shows the
  pharmacy card's listing; (e) a failure or an empty answer in one card does not change the other; (f) the 24-hour card stays a skeleton until the pharmacy answer is in, and
  never shows a listing and then replaces it; (g) with an empty pharmacy answer the 24-hour card shows its first result; (h) Retry on one card works out the pair again; with
  an area only the rule is the same and no distance shows; no position in any address.
- [ ] Turn `useNearbyListing` into `useNearbyListings` (a `limit`, a list), move the comparison into `NearbySuggestions`.

### Task 6: the home page words (D7)
- [ ] Tests first: the exact texts of the table in D7 (hero heading and line, Overview heading and text, "Why SwiftHealth Route" and its four cards, the owners heading and
  text), each built from `brand.name` where it names the app (a test with another brand name changes them); the old texts are gone; no text of the home page or its description
  names a city or says "Enugu"; the home page `metadata` description is the approved one; the four cards keep their icons and ids; one `h1`, the headings in order;
  the page is still static and makes no request.
- [ ] Update `config/home.ts` and the home components; add the home page description.

### Task 7: real browser, and the end of stage 1 (D10)
- [ ] `tests/end-to-end/find-by-type.spec.ts` (new) and `home-layout.spec.ts` (extended), at **320, 360 and 768 px**: the new home texts and cards are not cut off and nothing scrolls
  sideways; the Pharmacy tile gives the heading "Pharmacies near you", the chip and only pharmacies; the chip removes the filter and keeps the others; a typed "chemist" gives the
  same page; the empty text; the Near-you cards on a local database with one 24-hour pharmacy show one card with both labels. Then lint, typecheck, the whole suite and the build
  (First Load JS of `/search` at or under 120 kB), the backend suite once (nothing changed there), a **draft** pull request, and wait for the owner's preview check.
- [ ] Once, at the end of stage 1: `validation.md`, the roadmap and `LOG.md` updated; the plan boxes of Tasks 1 to 7 ticked with their commit hashes after the owner's check.

### Task 8: the photo banner (the last task) (D6)
Starts only after the owner has confirmed the credit ("Designed by Magnific", linking to <https://www.magnific.com>, under the banner). Photos: clinic, laboratory, pharmacy and
maternity are approved for now; the hospital photo stays `approved: false` (no banner) until the owner has read Magnific's rules or replaced it. A later replacement is one new file and one
config line.
- [ ] Tests first: `config/types.ts` marks a type's photo `approved` and the banner shows **only** then (a type with `approved: false`, or no photo, shows no banner and no credit, while its
  heading and chip still show); one `<img>` for the chosen type and none for the others (only the chosen photo downloads); `width` and `height` are the real size of each file and
  each file is under its budget; alt text is not empty; the credit "Designed by Magnific" with its link (`target="_blank"`, `rel="noopener noreferrer"`, 16 px, 48 px high) shows under the
  banner, on the search page only, and only while a Magnific photo is showing (a type with a non-Magnific photo shows no Magnific credit); no text sits on the photo; the order is heading,
  banner, credit, search box, chip; the map view and the list both keep it; a replaced file has a new name; no position anywhere.
- [ ] Add `scripts/optimize-type-banners.mjs` and make the files (960 × 320, about 40 kB or less each) from the originals; look at each converted photo before writing its alt text; add
  `TypeBanner.tsx` and fill the config; check at 320, 360 and 768 px and on throttled 3G that the results do not wait for the picture.
- [ ] Update the UI spec 2.3, `validation.md`, the roadmap and `LOG.md` for the banner, tick the boxes with their commit hashes, and only then call the feature done.

## Questions that block a task
- Tasks 1 to 7 can start after the owner's go-ahead and the confirmation of the two short lists (the type words block Task 3, the empty-results words Task 4).
- Task 8 is blocked only by the owner's confirmation of the credit. The hospital banner stays off until the owner switches it on.
