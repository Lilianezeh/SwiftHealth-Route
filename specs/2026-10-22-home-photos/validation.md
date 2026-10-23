# Home photos: validation (revision 5: the stronger, taller background slideshow)

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md). Branch `feature/home-photos`, 2026-10-23: revision 4 (the home page back to `main` plus one faint slideshow behind "Find by type") and then revision 5 (the owner's changes: taller section, 45% strength on white, focus points, a soft white backing for the heading).

## Results (revision 5)

- **Frontend:** `vitest` **1557 tests in 108 files; 1556 passed** in the full run. The one that failed (`ListingPage`, a page this work does not touch) timed out under load and **passes alone (19 of 19)**, as the staff pages did before. `tsc --noEmit` and `next lint` clean. Backend: not touched.
  Tests written first (red, then green): `BackdropSlideshow.test.tsx` (the strength is 45%; every photo has a narrow and a wide focus point; **WCAG from the tokens**: the worst case is a pure black pixel at 45% over white, then the heading's `bg-white/90` backing in `forest` is at least 4.5:1; the tiles, the Pause button and the credit are on white; the section is `min-h-[480px] md:min-h-[520px] lg:min-h-[560px]`, centred, with the tiles in a 4-column grid on a phone (the last tile in the middle), 6 on a tablet (the last two in the middle) and 5 on a laptop; the kept size is 480, 520, 560 px and 494 px under 340 px),
  `backdropPhotos.test.ts` (the five focus points, the 45%).
- **Real browser on a production build** at 320, 360, 768 and 1024 px: `home-photos.spec.ts` **29 of 29 passed**, including: **the section is exactly 494 / 480 / 520 / 560 px high** (so the kept size is the real size: **CLS 0**), heading, tiles, Pause and credit inside it and **centred**, tiles 48 px or more, one row of five on a laptop, **Pause and the credit in one row from 340 px**, the heading's soft white backing and its `forest` colour, the first photo's `object-position` for this screen (`22% 0%` narrow, `50% 10%` wide), the photos at 45%, every photo's darkest pixel at 45% over white under the 90% backing gives the heading at least 4.5:1, no slideshow photo requested before the section is near the screen, Pause, hidden tab, reduce motion, `/search` and `/find` without a picture. `swiftrescue`, `find-by-type` and `home-layout` on the development server: **82 passed, 3 skipped, 5 failed**: the **same three `home-layout` failures as on `main`** (this machine's fallback font in the header), and two `find-by-type` tile tests that timed out on the first click in the cold development server and **pass alone** (12.7 s and 32.2 s). The offline check of SwiftRescue on the production build passed.
- **Screenshots for the owner's choice** of the strength (35% and 45%, five photos, 360 and 1280 px) are in `/home/lilian/slideshow-options/` (outside the repository).
- **Lighthouse 12, mobile, on production builds on this laptop** (quiet), five runs each, alternating, on a build of `main` (before) and of this branch (after):

| | Performance | Accessibility | LCP (ms) | TBT (ms) | CLS | Requests / images | Transfer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before (`main`) | 48 (a slow first run), 84, 80, 75, 96 (median **80**) | 100 | 2383 to 5166 | 159 to 2996 | 0 | 16 / 2 | 208 KiB |
| after (45% slideshow) | 79, 87, 82, 91, 91 (median **87**) | 100 | 2701 to 3083 | 250 to 493 | 0 | 18 / 4 (+2 slideshow photos) | 268 KiB |

  The same within this machine's noise (the medians differ by 7 in favour of "after", the "before" runs range from 48 to 96). The page's own JavaScript is 8.24 kB against 6.48 kB (First Load 115 kB against 113 kB). **These are this laptop's numbers; the real gate is yours:** Lighthouse (mobile, Incognito) on the preview must give Performance 73 or more and Accessibility 100 (your live score before: 73 and 100).

## Checklist
- [x] The home page is as on `main` (hero `hero3`, "For facility owners" with `hero4`, every word; byte-identical files); one slideshow behind "Find by type" only
- [x] Taller section: 480 px on a phone (494 under 340 px), 520 px on a tablet, 560 px on a laptop, tiles nicely placed and centred, CLS 0
- [x] Photos at 45% over white; each photo's focus point keeps the face whole on a phone and a laptop (the hospital photo: the patient's face; the doctor's is cut by the original frame)
- [x] Heading on a soft white backing; tiles, Pause button and credit on white: all text passes AA in the worst case
- [x] Unchanged: 7 s per photo, Pause (48 px, "Pause"/"Play", named "Pause photos"/"Play photos"), hidden tab, reduce motion, lazy loading (nothing asked for before the section is near), one credit
- [x] Ambulance and fire only on `/emergency`; no picture on `/search` and `/find`; the LOG.md entry; `source-photos/` ignored
- [ ] **The owner runs Lighthouse (mobile, Incognito) on the preview: Performance 73 or more, Accessibility 100**
- [ ] The owner looks at the home page on a phone and a laptop (the slideshow behind Find by type, Pause, the credit) and at `/emergency`
