# Dark palette: Midnight Navy: validation

Requirements: [requirements.md](requirements.md). Plan: [plan.md](plan.md).

## Results (2026-10-28, branch `feature/dark-palette-navy`)
- Frontend: 132 files, **2167 tests** passed; `tsc` and lint clean.
- Real browser, full suite, one worker: **422 passed, 8 skipped, 2 failed**. The two are `signup.spec.ts` "staff: the choice, the form and the code fit the screen" at 320 and 360 px: they waited 30 s for "Code sent to b***@example.com" in the long run, and **pass on their own** (4 of 4 widths). A timing hiccup of the long run, not a change of this work; I could not find the cause. That full run had one mistake of mine: a `test.skip` in the wrong place also skipped the four 360 px header contrast checks (so 4 of the 8 skips were mine). I fixed it and ran `hero-header-contrast.spec.ts` again: **30 passed, 2 skipped** (only the two 360 px overflow checks are skipped, on purpose, decision N3). The other 4 skips are the 4 older ones.
- The header over the hero, on the real pixels (`hero-header-contrast.spec.ts`, 32 cases: **30 pass, 2 skipped**): in the light and the dark mode, at 360, 768 and 1280 px, the whole rows of the header items across the full width (white text, 4.5:1, with a 0.2% tolerance for the one anti-aliased pixel per row on the photo's slanted cut-out edge), each link and the logo (4.5:1), the Theme icon and the Menu icon (3:1), and the edge of SwiftRescue and of the Menu button (3:1). The slideshow text (the "Find by type" heading, Pause, the credit) on each of the **five slideshow photos**, in both modes, at 360 and 1280 px (4.5:1). The hero has one photo (the stethoscope; one file for phones, one for wider screens), and both are covered by the strip check.
- Before the change, the same spec failed: SwiftRescue's edge 1.01:1, the Menu edge 2.75:1, the header rows 3.8:1 to 4.3:1 (also in the light mode).
- Lighthouse 13, production build, mobile preset, Chrome with the theme stored (the Dark runs read `data-theme="dark"`; a screenshot of the Dark home confirms it): **Accessibility 100 on all 15 pages in both modes** (/, /find, /emergency, /blood, /blood/donate, /about, /how-we-verify, /privacy, /terms, /contact, /list-your-facility, /for-facilities, /log-in, /forgot-password, /report/demo-diagnostic-laboratory-uwani). Performance 72 to 91 in Light and 72 to 88 in Dark (home 79 Light, 82 Dark); one Dark run of /blood/donate scored 32 (total blocking time 38 s, a machine hiccup) and scored 86 and 78 when run again.
- The home page lists `label-content-name-mismatch` (an unscored axe rule) on the five "Find by type" tiles in both modes; it is the existing markup and does not change the score. Left as it is.
- Backend: not touched.
- Light mode: `darkMode.test.ts` pins every light colour to its value of 2026-10-27 (30 tokens), so no light colour changed. The light-mode changes are only the three of rule 6 of the requirements (the SwiftRescue edge, the Menu edge, the taller and darker veil).

## Existing tests changed on purpose
`darkMode.test.ts` (token lists, values, pairs), `darkModeSource.test.ts`, `HomeSections.test.tsx` (hero tokens, the veil), `SiteHeader.test.tsx` (`bg-bar`, SwiftRescue's classes), `dark-mode.spec.ts` (the navy page colour), `tests/helpers/contrast.ts` (`darkTokenColour`).

## Render / Netlify
Nothing to change. No migration, no variable.

## Not checked by me
- A real phone. Open the site, press the Theme button once (Dark), and look at the home page, /find and /emergency.
- The 360 px home header, which is 11 px too wide on this machine's font (decision N3 in LOG.md).
- The address-bar colour stays the light header blue in the dark mode (unchanged).
