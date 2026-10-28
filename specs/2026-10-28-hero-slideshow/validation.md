# Hero photo slideshow: validation

Requirements: [requirements.md](requirements.md). Plan: [plan.md](plan.md). Decisions H1 to H6 are in `LOG.md`.

## Results (2026-10-28, branch `feature/hero-slideshow`, from `main` at `fa243f8`)
- **Tests came first** (they failed until the code was written): `heroSlides.test.ts` (the order, the files, the alt texts, no filter in the config, the crop maths of every face), `HeroSlideshow.test.tsx`, `SiteFooter.test.tsx` (the credit), `GroupPhoto.test.tsx` (no credit), `theme.test.ts` (the address-bar colour), `HomeSections.test.tsx`, `HomePage.test.tsx`, `homePerformance.test.tsx`, and the browser spec `hero-slideshow.spec.ts`.
- Frontend: 132 files, **2147 tests**; `tsc` and lint clean. In the full run `ListingPage.test.tsx` and `ProviderScreens.test.tsx` each failed once under load; both **pass alone** (73 tests), as in earlier runs.
- Real browser, full suite, one worker: **410 passed, 4 skipped, 1 failed**. The failure is `queue.spec.ts` "re-checks" at 1024 px (a click on the "Due this week" tab did not change the address in 5 s); it **passes on its own** (4 of 4 widths). I could not find a cause; it does not touch the home page. The 4 skips are the older ones.
- `hero-slideshow.spec.ts` (48 cases at 320, 360, 768 and 1280 px plus the footer, the address bar and the plain section): all pass. It checks, in a real browser: the band's box and slanted edge are the stethoscope's own (16 rem, 18 rem, the right half); the stethoscope is first, eager, high priority, the small file on a phone; **no other photo is requested before the page has loaded**, and then one ahead; a change every 6 s through all six and round to the stethoscope; Previous, Next, six dots, Enter and Space from the keyboard, a spoken change; Pause, Play and a hidden tab; reduce motion (nothing by itself, no Pause button, the buttons work); **CLS 0** and the heading does not move through all six photos; each photo's focus point; **every photo is pixel-identical in Light and in Dark** (largest difference 2 of 255, mean under 0.5, at 360 and 1280 px, over the middle of the band); every control at least 48 px and inside the screen and clear of the heading; the footer credit at 320 and 1280 px (16 px, 48 px high, at the right, inside the screen, one link on the page) and its contrast in Light and Dark (4.5:1); "Find by type" has no photo and no button; the address-bar colour in Light, in Dark and with the Theme button.
- **Faces:** `heroSlides.test.ts` computes where each face lands for the focus point, at 320, 360, 375, 390, 414, 430, 600, 767, 768 px (the whole face inside the band and clear of the controls) and at 1024, 1100, 1280, 1440, 1600, 1920 px (inside the band and right of the slanted edge). I also looked at every photo at 320, 768 and 1280 px. **Not covered:** 769 to 1023 px, where the band is 288 px high and the largest faces do not fit (decision H3 in `LOG.md`: the patient's chin from about 950 px, the top of the laboratory and pharmacist faces by 1 to 5 px from about 1000 px).
- **Lighthouse 13**, production build, mobile preset: **Accessibility 100 on all 15 pages in both modes (30 runs)**. Performance on this machine, one run per page: Light 68 to 87, Dark 76 to 92. The home page is the one that matters: this branch **94, 77, 81, 78** (LCP 1.4 to 1.5 s, CLS 0, total blocking time 300 to 1160 ms), `main` measured the same way **75, 83, 79** (LCP 1.4 to 1.7 s, CLS 0, TBT 710 to 1360 ms). The two are in the same noisy band, and the home page ships **116 kB** of first-load JavaScript against `main`'s **115 kB**. A phone loads the stethoscope (45 kB), the owner photo (30 kB) and, after the page has loaded, the next photo (23 kB).
- **Live PageSpeed (mobile, 90 or more): not measured by me.** The site is not deployed yet and this machine's Lighthouse scores about 80 for `main` too. Please run PageSpeed on the live site after the deploy. If the home page drops under 90, tell me; the first thing to try is waiting until the first interaction or scroll before adding the second photo.
- The home page still lists the unscored axe rule `label-content-name-mismatch` on the five "Find by type" tiles (existing markup, the score stays 100).
- Backend: not touched.

## Screenshots (360 and 1280 px, Light and Dark)
In `screenshots/`: `hero-1-stethoscope-*`, `hero-2-clinic-*`, `hero-5-laboratory-*` and `footer-*`, each as `-360-light`, `-360-dark`, `-1280-light`, `-1280-dark`. The Dark mode on this branch is the dark mode of `main` (the green-grey one); the navy one is in #73.

## Render / Netlify
Nothing to change. No migration, no variable. Netlify rebuilds the front end; the photo files are the ones already in `public/images/backdrop/`.

## Not checked by me
- A real phone (swipe is not a feature; the buttons and the dots are).
- The live PageSpeed number.
- A screen reader (the markup is a labelled group with named buttons and a polite announcement; no tool of mine reads it aloud).
