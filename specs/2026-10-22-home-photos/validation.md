# Home photos: validation (revision 6: the polished "Find by type" slideshow section)

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md). Branch `feature/home-photos`, 2026-10-23: revision 4 (the home page back to `main` plus one faint slideshow behind "Find by type"), revision 5 (taller section, 45% strength, focus points, a backing for the heading) and revision 6 (the owner's polish, 45% kept: bigger cards with a line each, content in the lower part, 800 / 1600 px files, a light brand-blue tint, a Pause / Play icon, a gentle lift of the cards).

## Results (revision 6)

- **Frontend:** `vitest` **1562 tests in 108 files; 1561 passed** in the full run. The one that failed (`BloodPages`, a page this work does not touch) failed under load and **passes alone (43 of 43)**, like the other load flakes before it. `tsc --noEmit` and `next lint` clean. Backend: not touched.
  Tests written first (red, then green): `BackdropSlideshow.test.tsx` (the strength is 45%; the frame, the tint `pine-100/40`, the focus variable; `<picture>` with a phone `<source>` and a `srcset` of 800 and 1600; Pause / Play icons; **WCAG from the tokens**: a pure black pixel at 45%, then the tint, then the heading's 90% white backing in `forest` is at least 4.5:1; cards 190 px, 20 px names, 16 px lines, icon circle, lift classes with no lift under reduce motion; the grid and the centred last row; the kept size), `backdropPhotos.test.ts` (800 × 533 under 45 kB and 1600 × 1067 under 130 kB for each of the five, the focus points, no leftover file, `hero3` / `hero4` byte-identical to `main`), `HomeSections.test.tsx` (each tile's name stays "Hospital" etc. for a screen reader, its line is the description, the five lines are the owner's words), `HomePage.test.tsx`, `homePerformance.test.tsx`.
- **Real browser on a production build** at 320, 360, 768 and 1024 px (and 1280 for the screenshots): `home-photos.spec.ts` and the SwiftRescue offline check, **33 tests, 32 passed on the first run**; the one that failed (the hidden-tab test, a race between the page drawing again and the fast clock) was made stable with a short real wait and **passes 3 of 3 times** since. The tests check, among others: the section's real height equals the kept size (**CLS 0**), the heading in the lower part (at least 75% down the band under 1024 px, at least 40% down the section from 1024 px), cards **190 px** high, names **20 px**, lines **16 px**, icon circle **56 / 64 px**, nothing overflowing at 320 px, the Pause icon, the card lift (`translate` `0px -4px` on hover), a phone's `currentSrc` is the 800 px file and a laptop's the 1600 px file, the tint and the section colour, the heading's contrast over real photo pixels including the tint, the first request is `nurse-corridor-800.webp` and no slideshow photo is requested before the section is near.
- **Screenshots for the owner** (five photos each, 320, 360, 768 and 1280 px, from the production build) are in `/home/lilian/slideshow-options/polish/` (outside the repository). The faces are above the heading and the cards at every size. In the `hospital` photo the patient's face is whole and the doctor's chin shows only a sliver (the two faces do not both fit).
- **Lighthouse 12, mobile, on production builds on this laptop**, five runs each, alternating, on a build of `main` (before) and of this branch (after):

| | Performance | Accessibility | LCP (ms) | TBT (ms) | CLS | Requests / images | Transfer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before (`main`) | 76, 75, 73, 85, 68 (median **75**) | 100 | 2108 to 3325 | 436 to 1126 | 0 | 16 / 2 | 208 KiB |
| after (revision 6) | 75, 90, 75, 88, 84 (median **84**) | 100 | 2137 to 3188 | 298 to 1140 | 0 | 18 / 4 (+2 slideshow photos) | 263 KiB |

  Within this machine's noise (the single runs vary by about 15 points either way), the median is not worse than `main`'s. A first set of runs measured 333 KiB because a phone with a pixel density above 1 took the 1600 px file; the `<picture>` source (a phone always takes the 800 px file) fixed it. **These are this laptop's numbers; the real gate is yours:** Lighthouse (mobile, Incognito) on the preview must give Performance 73 or more, Accessibility 100 and CLS 0.
- **Known, not caused by this work:** `home-layout.spec` (320 px first screen, 360 px header width, every fourth width) fails the same way on `main` on this machine (its fallback font); a few staff-page unit tests and the cold development server's `find-by-type` tile tests time out under load and pass alone.

## Checklist
- [x] The home page is as on `main` (hero `hero3`, "For facility owners" with `hero4`, every word; byte-identical files); one slideshow behind "Find by type" only
- [x] Bigger cards: 190 px high, 64 px icons, 20 px names, a 16 px line under each (the owner's five lines); two per row on a phone, tidy at 320 px
- [x] Heading and cards in the lower part of the section; the faces show above them (looked at each photo at 320, 360, 768 and 1280 px; hospital: the patient's face whole, the doctor's chin a sliver)
- [x] 800 px WebP for phones, 1600 px for wide screens (`<picture>` and `srcset`); still lazy, nothing asked for before the section is near
- [x] A light brand-blue tint instead of the grey-white wash; all text on a white surface, AA in the worst case
- [x] A Pause / Play icon in the button; a gentle lift of the cards on hover and focus (none with reduce motion)
- [x] Unchanged: 45%, 7 s per photo, Pause (48 px), hidden tab, reduce motion, one credit
- [x] Ambulance and fire only on `/emergency`; no picture on `/search` and `/find`; the LOG.md entry; `source-photos/` ignored
- [ ] **The owner runs Lighthouse (mobile, Incognito) on the preview: Performance 73 or more, Accessibility 100, CLS 0**
- [ ] The owner looks at the home page on a phone and a laptop (the slideshow behind Find by type, Pause, the credit) and at `/emergency`
