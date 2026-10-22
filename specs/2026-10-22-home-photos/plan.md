# Home photos: plan

**Status: proposal, not started.** Requirements: [requirements.md](requirements.md). Rules: tests first, one commit per task, IDs (US-13, US-01, US-04, FR-14, FR-17, NFR-01, NFR-03, NFR-10, NFR-13) in commits and tests; `git branch --show-current` before every commit and push; draft PR.

## Files

| File | Change |
| --- | --- |
| `frontend/source-photos/` (new, in `.gitignore`) | The 14 originals move here from `public/images/hero/`; nothing of it is served or committed |
| `frontend/scripts/optimize-hero-photos.mjs` | New: makes `public/images/hero/<name>-640.webp` and `-1280.webp` and `public/images/emergency/<name>.webp` from `source-photos/` (sharp, one place for crops and quality) |
| `frontend/src/config/heroPhotos.ts` | New: the 8 or 9 slides (file names, sizes, alt text, dot name), the timing, and the credit (one place) |
| `frontend/src/components/home/HeroSlider.tsx` | New, a client component: photos, crossfade, Pause/Play, dots, visibility, reduce motion, the credit, the staged loading |
| `frontend/src/components/home/HomeHero.tsx`, `HeroSearch.tsx` | Changed/new: the full-width hero over the slider, heading, line, search box, button (server components) |
| `frontend/src/components/home/FeatureCards.tsx`, `Overview.tsx`, `FindByType.tsx`, `WhySwiftHealth.tsx`, `FacilityOwners.tsx`, `src/styles/globals.css` | Cards, spacing, the CSS fade-in (`@supports`, reduce motion off) |
| `frontend/src/config/home.ts` | The words of the new cards and the search box; the old hero photo entries removed |
| `frontend/src/components/search/SearchResults.tsx`, `TypeBanner.tsx` (deleted), `config/types.ts`, `scripts/optimize-type-banners.mjs` (deleted), `public/images/types/` (deleted), `public/images/home/hero3*.webp` (deleted) | Part 1 |
| `frontend/src/components/emergency/EmergencyGroups.tsx`, `GroupPhoto.tsx` (new), `public/sw.js`, `components/*/RegisterServiceWorker.tsx` | Part 4 |
| `frontend/tests/unit/*`, `tests/end-to-end/home-photos.spec.ts` | Each task |
| `specs/frontend/ui-spec.md` (2.1, 2.3, 2.5), `specs/2026-10-15-find-by-type/*` (a note), `LOG.md` | Task 0 and the end |

## Tasks

### Task 0: Spec and the photos
- [ ] After the owner's "yes" and answers: rewrite ui-spec 2.1, 2.3 (no pictures), 2.5 (the photos); note it in the find-by-type spec.
- [ ] Move the originals to `source-photos/` (ignored); the script; the finished WebP files (sizes checked by a test: 640 px ≤ 40 kB, 1280 px ≤ 100 kB, SwiftRescue ≤ 40 kB, real pixel sizes equal to the config).
### Task 1: no pictures on search (tests first)
- [ ] Red tests: `/search` and `/search?category=clinic|pharmacy|laboratory` have no `img`, `picture`, `figure`, no credit; the heading, chip and results are unchanged. Then remove the banner code, config, files and script; the old banner tests are replaced by this one.
### Task 2: the slider (tests first)
- [ ] Red tests (jsdom, fake timers): the first photo only at first; the next one is added ahead of its turn; it changes after 6 s; **Pause** stops it and shows **Play**, Play restarts; a **dot** shows its photo and restarts the timer; a hidden tab stops it and a visible one restarts it; **reduce motion** gives one still photo, no timer, no controls; the **credit** link (text, `https://www.magnific.com`, 16 px, new tab, `rel`); every photo has alt text, width and height; controls are 48 px; the heading, search box and button are outside the slider and never re-render with it; with scripts failing the first photo and credit remain.
- [ ] Contrast test: the overlay tokens and opacity give at least 4.5:1 for white text on a pure white photo (computed from `globals.css`), also under the header band and in the credit chip.
- [ ] Build `HeroSlider`, `HeroSearch`, `HomeHero`.
### Task 3: the rest of the home page (tests first)
- [ ] Red tests: the three feature cards and their links; every link and button of the page goes to an existing route (compared with the app's route list, like `homePerformance.test.tsx`); no number that is not in `config/home.ts`; no word "Enugu", "review", "testimonial" or a statistic; text 16 px or more; one `h1`, an `h2` per part; the fade-in classes exist only inside `@supports` and `prefers-reduced-motion: no-preference` (a test reads the CSS); the page sends no client code for the fade-in.
- [ ] Build the cards, spacing and the fade-in.
### Task 4: SwiftRescue photos (tests first)
- [ ] Red tests: a photo in the Ambulance and the Fire section only; fixed size, `loading="lazy"`; credit and alt; **112 and Call 112 stay the first things in the page source and the first tab stops**, and appear with no photo request answered (a test where the photo requests never finish); with a photo that fails, no broken-image icon and no jump; the worker keeps `/images/emergency/*.webp` (cache first) and still never keeps an API answer or anything with a query; the saved offline copy has no image data.
- [ ] Build `GroupPhoto`, update `EmergencyGroups` and `sw.js`.
### Task 5: real-browser checks at 320, 360, 768 and 1024 px
- [ ] Playwright: the slider changes photo (a short test timing), Pause holds it, a dot picks it, reduce motion (`reducedMotion: "reduce"`) gives one still photo, a hidden page stops it; the text is readable (a pixel contrast sample of the heading over every photo); nothing wider than the screen; no layout shift (CLS 0); `/search` has no images; `/emergency` shows 112 first, the photos in their sections, and works offline on a production build (the existing offline test, extended).
### Task 6: speed, wrap-up
- [ ] Lighthouse before and after, three runs each, on the same production build (see "Measuring"); the bytes, requests, first-photo size, JavaScript added, CLS. Docs, LOG, draft PR; **the owner's own Lighthouse on the preview decides**.
