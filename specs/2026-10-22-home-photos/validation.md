# Home photos: validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md). Branch `feature/home-photos`, built 2026-10-23 on `main` after #37 to #43.

## Results

- **Frontend:** `vitest` **1557 passed** (109 files); `tsc --noEmit` and `next lint` clean.
  New tests, red first: `sectionPhotos.test.ts` (the ten files: budgets, real pixel sizes, nothing else in the folders, alt text, one credit),
  `HomeSectionPhotos.test.tsx` (which photo is in which section, the hero unchanged, no photo before the first section, lazy and fixed in size, the five
  credits, the credit under `hero2` only, the two new sections, `section-lazy`), `Reveal.test.tsx` (fade and slide once, nothing without scripts, nothing
  with reduce motion, the CSS inside the no-preference guard), `GroupPhoto.test.tsx` (the two SwiftRescue photos, credit, lazy, 112 first, a failed photo
  leaves a quiet panel, no picture data in the saved copy), `serviceWorker.test.ts` and `RegisterServiceWorker.test.tsx` (the worker keeps the two
  photos, cache first, and nothing else). Older tests adapted: `HomePage`, `HomeSections`, `homePerformance`, `homeImages`.
- **Real browser on a production build** (`next build` of a copy, `next start`): `home-photos.spec.ts` at 320, 360, 768 and 1024 px **all passed**: every
  photo loads and keeps its ratio, nothing wider than the screen, five credits at 16 px and 48 px, the credit under `hero2` and not under `hero3`,
  **CLS 0** while scrolling the whole page, the photos wait and then move into place, with reduce motion nothing moves, the photos far down the page
  are not requested before a scroll, `/search` and `/find` have no picture. `swiftrescue.spec.ts` and `find-by-type.spec.ts` on the development server:
  **47 passed, 1 skipped** (the offline check); the **offline check on the production build** passed too.
- **Three tests of `home-layout.spec.ts` fail, on `main` as well** (the same three on a build of `main`): the 320 px "first screen", the 360 px header width and the
  "every 4th width" check. They are the known width of this machine's fallback font in the header (371 px against 360, LOG.md) and were failing before this
  feature. Not changed here.
- **Lighthouse 12, mobile, on production builds on this laptop** (the laptop was quiet: load about 1 to 3), five runs each, alternating, on a build of
  `main` (before) and of this branch (after):

| | Performance | Accessibility | LCP (ms) | TBT (ms) | CLS | Requests before the end of the load | Transfer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before (`main`) | 83, 92, 94, 88, 83 (median **88**) | 100 | 1559 to 2773 | 207 to 627 | 0 | 16 (2 images, 73 KiB) | 208 KiB |
| after, first build (photos native-lazy only) | 77, 91, 69 | 100 | 2823 to 3788 | 249 to 759 | 0 | 22 (8 images, 255 KiB) | 395 KiB |
| after, with `content-visibility: auto` on the photo sections | 75, 89, 93, 74, 88 (median **88**) | 100 | 2538 to 3188 | 242 to 679 | 0 | **16 (2 images, 79 KiB)** | 218 KiB |

  The first build loaded seven photos at the start (a browser's lazy loading begins about 1250 px before the screen) and cost the hero about a second of
  LCP; the CSS fix brought the requests back to the same 16 and 2 images. The median Performance is the same (88); the two low "after" runs (75, 74) are the
  first run after a server start and the fourth, with a high Total Blocking Time (586, 679 ms), a spread the "before" runs show too (83 twice). The page's own
  JavaScript is **+0.44 kB** (6.92 kB against 6.48 kB; First Load 114 kB against 113 kB). **These are this laptop's numbers; the real gate is yours:**
  Lighthouse (mobile, Incognito) on the preview must give Performance 73 or more and Accessibility 100 (your live score before: 73 and 100).

## Checklist
- [x] The hero is exactly as it was (a test reads its source and its markup)
- [x] Ten photos only (laboratory, pharmacy, hero, hero3 top crop, owner, maternity, hero2, clinic, ambulance, fire); none of pharmacy6, hero4, hospital, owner2; `hero4-portrait.webp` deleted
- [x] No picture and no credit on `/search` and `/find`
- [x] Credit: one "Designed by Magnific" link in each of the five Magnific sections and under each SwiftRescue photo; under `hero2` only in How we verify; none in the hero
- [x] One 800 px file per photo, under 50 kB; the two SwiftRescue files 640 × 240 under 40 kB; originals in `frontend/source-photos/` (ignored)
- [x] CLS 0; no movement at all with reduce motion; the SwiftRescue photos work offline and 112 never waits for them
- [x] Text 16 px or more, targets 48 px, no red cross, nothing red in the new parts, nothing wider than the screen at 320 px
- [ ] **The owner runs Lighthouse (mobile, Incognito) on the preview: Performance 73 or more, Accessibility 100**
- [ ] The owner looks at the home page and `/emergency` on the preview on a phone (the photos, the fade, the credits, "How we verify" and "SwiftRescue")
