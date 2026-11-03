# Plan: Home hero on phones and tablets, and For facilities shown once

Tests were written first, then the code. Tick each task with its commit hash at the end of the feature.

- [ ] 1. Tests: `SiteHeader.test.tsx` (solid bar in the flow under 1024 px, transparent from it), `HeroSlideshow.test.tsx` (photo box heights, straight edge,
  controls below the photo and over it from 1024 px), `HomeSections.test.tsx` (heights, the veil hidden under 1024 px, the tighter text under 380 px),
  `heroSlides.test.ts` (the faces at 13 widths), `ForFacilitiesPage.test.tsx` (the buttons once).
- [ ] 2. Browser tests: `hero-slideshow.spec.ts` (header above the photo, nothing over the photo, controls centred below it, the button on the first screen,
  laptop unchanged), `home-layout.spec.ts`, `hero-header-contrast.spec.ts`, `signup.spec.ts` (For facilities once).
- [ ] 3. Code: `SiteHeader.tsx`, `HeroSlideshow.tsx`, `HomeHero.tsx`, `ForFacilitiesParts.tsx`, `for-facilities/page.tsx`.
- [ ] 4. UI spec 2.1 and 2.9b, this folder, LOG.md; full frontend suite, lint, typecheck; draft pull request with screenshots at 360, 390 and 768 px in
  Light and Dark.
