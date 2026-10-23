# Home photos: validation (revision 4: the background slideshow)

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md). Branch `feature/home-photos`, rebuilt 2026-10-23 after the owner's change of plan.

## Results

- **Frontend:** `vitest` **1551 tests in 108 files; 1550 passed** in the full run. The one that failed (`ProviderScreens`, a staff page this work does not touch) timed out under load and **passed alone (45 of 45)**, as it did before. `tsc --noEmit` and `next lint` clean. Backend: not touched.
  New tests, red first: `backdropPhotos.test.ts` (the five files in the owner's order, 960 × 640, under 50 kB, nothing else in the folders, `public/images/sections` and `hero` gone, **`hero3.webp`, `hero3-phone.webp` and `hero4-portrait.webp` byte-identical to `main`**, no original in `public/`),
  `BackdropSlideshow.test.tsx` (23 tests: only the first photo in the HTML, the others added after it has loaded and the page is idle, 7 s and a 1.5 s fade, the owner's order, decorative, Pause and Play, a hidden tab, reduce motion, the credit, **WCAG contrast from the tokens in the worst case**, the size kept for the section), plus the older home tests adapted (`HomePage`, `HomeSections`, `homePerformance`) and `homeImages` back to `main`'s.
- **Real browser on a production build** (`next build` of a copy, `next start`): `home-photos.spec.ts` at 320, 360, 768 and 1024 px **21 of 21 passed**: the slideshow is behind the tiles and fills the section at 18%, the Pause button and the credit are 48 px and 16 px, the photo changes, Pause holds it, a hidden tab stops it, reduce motion gives one still photo and no button, **CLS 0**, **no slideshow photo is requested before the section is near the screen**, the first one is asked for first and not twice, **every photo passes AA even at its darkest pixel** (heading `pine-dark` over the photo at 18% on `pine-50`), the hero and the owners part are as on `main`, `/search` and `/find` show no picture. `swiftrescue`, `find-by-type` and `home-layout` on the development server: **84 passed, 3 skipped, 3 failed**; the three failures are **the same three that fail on `main`** (the 320 px first screen, the 360 px header width, the every-4th-width check: this machine's fallback font in the header, LOG.md). The offline check of SwiftRescue on the production build passed.
- **My first CLS result was not 0** (0.0025 and 0.0072 at 320 and 360 px): the section was given 720 px until it was drawn and its real height is 662 px on a phone. The kept size is now the measured height (662, 504 and 374 px at the three layouts), and the test is red-then-green.
- **Lighthouse 12, mobile, on production builds on this laptop** (quiet, load 1 to 3), five runs each, alternating, on a build of `main` (before) and of this branch (after):

| | Performance | Accessibility | LCP (ms) | TBT (ms) | CLS | Requests / images | Transfer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before (`main`) | 81, 84, 74, 93, 92 (median **84**) | 100 | 1685 to 3028 | 255 to 733 | 0 | 16 / 2 | 208 KiB |
| after (the slideshow) | 73, 86, 93, 94, 86 (median **86**) | 100 | 2507 to 3250 | 182 to 853 | 0 | 18 / 4 (+2 slideshow photos, 129 KiB of images) | 267 KiB |

  The medians are the same within the noise of this machine (the "before" runs alone range from 74 to 93). The slideshow adds two image requests (the first photo and the second, which is added after the first has loaded) and 59 KiB, and the home page's own JavaScript grows from 6.48 kB to 8.08 kB (First Load 115 kB against 113 kB). **These are this laptop's numbers; the real gate is yours:**
  Lighthouse (mobile, Incognito) on the preview must give Performance 73 or more and Accessibility 100 (your live score before: 73 and 100). If it drops, the slideshow is made cheaper (fewer photos, smaller files, a later start).

## Checklist
- [x] The home page is as on `main`: hero, `hero3`, "For facility owners" with `hero4`, every word; no new section; no photo row; no fade-and-slide
- [x] One slideshow behind "Find by type" only, of clinic, hospital, maternity, laboratory, pharmacy, in this order, 7 s each, a 1.5 s fade, faint (18%), behind the tiles
- [x] All text passes AA in the worst case; a Pause button (48 px) that also works with the tab hidden; reduce motion: one still photo and no button
- [x] Only the first photo is asked for early (and not before the section is near); the others are added later, one ahead
- [x] One "Designed by Magnific" link, 16 px, 48 px, for the slideshow; none anywhere else on the home page
- [x] The ambulance and fire photos only on `/emergency`, under Ambulance and Fire service; nothing about them on the home page
- [x] No picture on `/search` and `/find`; the LOG.md entry; `frontend/source-photos/` ignored; the eight `sections` files #44 had added are gone, and no photo that is unused is in the build
- [ ] **The owner runs Lighthouse (mobile, Incognito) on the preview: Performance 73 or more, Accessibility 100**
- [ ] The owner looks at the home page (the slideshow behind Find by type, Pause, the credit) and `/emergency` on the preview on a phone
