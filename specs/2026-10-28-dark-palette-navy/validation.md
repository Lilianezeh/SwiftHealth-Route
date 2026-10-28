# Dark palette: Midnight Navy, near-black (a): validation

Requirements: [requirements.md](requirements.md). Plan: [plan.md](plan.md).

## Results (2026-10-28, branch `feature/dark-palette-navy`, after the owner's "darker" request and choice of (a))
- Frontend: 132 files, **2177 tests** passed; `tsc` and lint clean. New or changed on purpose: `darkMode.test.ts` (near-black navy values, the hero, bars and `band` in one navy, royal blue only on the accents, 30 light tokens pinned plus `band`), `darkModeSource.test.ts` (photo brightness 60% and tint 80% to 55%; the section under the hero and the owners section use `bg-band`), `dark-mode.spec.ts` (the page is `rgb(6, 13, 24)`). They failed first (12 red).
- Real browser, full suite, one worker: **425 passed, 6 skipped, 1 failed**. The failure is `find-by-type.spec.ts` at 320 px, "a typed type word gives the same page": early in the long run the page stayed on `/search?q=chemist` and did not switch to `?category=pharmacy` within 60 s (a cold dev server). It **passes on its own** (3 of 3 widths); I could not find a cause, and it does not touch colours. The 6 skips are the 4 older ones and the two 360 px overflow checks of `hero-header-contrast.spec.ts` (decision N3 in LOG.md).
- The header over the hero, measured again on the real pixels after the colour change (`hero-header-contrast.spec.ts` and `dark-mode.spec.ts`: **63 passed, 2 skipped**): the rows of the header items across the whole width (4.5:1), each link and the logo (4.5:1), the Theme and Menu icons (3:1), the edges of SwiftRescue and of the Menu button (3:1), and the slideshow text on each of the five photos (4.5:1), in both modes at 360, 768 and 1280 px.
- Lighthouse 13, production build, mobile preset, Chrome with the theme stored: **Accessibility 100 on all 15 pages in both modes (30 runs)**. Performance, taken on the warm server: Light 73 to 89 (home 87), Dark 75 to 86 (home 84). The first Light pass, right after the build, scored 44 to 64 on six pages and one Dark `/blood` run scored 35; they scored 74 to 89 and 76 when run again, so those were the machine, not the pages.
- The home page lists `label-content-name-mismatch` (an unscored axe rule) on the five "Find by type" tiles in both modes (decision N4). Left as it is.
- Backend: not touched.
- Light mode: `darkMode.test.ts` pins every light colour to its value of 2026-10-27, and `band` to white. The only light-mode changes are the three of rule 6 of the requirements (the SwiftRescue edge, the Menu edge, the taller and darker veil).

## Existing tests changed on purpose
`darkMode.test.ts`, `darkModeSource.test.ts`, `HomeSections.test.tsx`, `SiteHeader.test.tsx`, `dark-mode.spec.ts`, `tests/helpers/contrast.ts` (`darkTokenColour`).

## Render / Netlify
Nothing to change. No migration, no variable.

## Not checked by me
- A real phone: press the Theme button once (Dark) and look at the home page, `/find` and `/emergency`.
- The 360 px home header, 11 px too wide on this machine's font (decision N3).
- The address-bar colour stays the light header blue in the dark mode (unchanged).
