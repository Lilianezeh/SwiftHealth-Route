# Home photos: plan

**Status: revision 4 (2026-10-23), approved ("Yes, with these changes"). Built 2026-10-23; draft PR #44 updated, waiting for the owner's Lighthouse run and look at the preview.** Requirements: [requirements.md](requirements.md). Rules: tests first, one commit per task, IDs (US-13, US-04, US-01, FR-14, FR-17, NFR-01, NFR-03, NFR-10, NFR-13) in commits and tests; `git branch --show-current` before every commit and push; the draft PR #44 is updated.

**Revision 6 (2026-10-23, the owner's polish, built):** Task 5 below; the files and tasks above describe revisions 4 and 5, which revision 6 changes (the photo files are now 800 and 1600 px, the section layout and the cards are new).

## Files

| File | Change |
| --- | --- |
| `frontend/src/components/home/FindByType.tsx` | Back to `main`'s tiles; now inside `<BackdropSlideshow>`; the heading is `text-pine-dark` (4.5:1 on the worst case of the faint photo) |
| `frontend/src/components/home/BackdropSlideshow.tsx` | New, client: the five photos, the 7 s timer and 1.5 s fade, the Pause button, the hidden-tab stop, reduce motion, the staged loading, the credit |
| `frontend/src/config/sitePhotos.ts` (was `sectionPhotos.ts`) | `BACKDROP_PHOTOS` (five files), `EMERGENCY_PHOTOS`, the credit |
| `frontend/scripts/optimize-hero-photos.mjs` | The five 960 × 640 backdrop files and the two SwiftRescue files from `source-photos/` |
| `frontend/public/images/backdrop/` (new), `public/images/sections/` (deleted), `public/images/home/` (**not touched**) | The files |
| `frontend/src/styles/globals.css` | Back to `main`, plus the `section-lazy` rule (`content-visibility: auto`); the fade-and-slide rule is gone |
| `frontend/src/components/home/{HowWeVerify,HomeSwiftRescue,SectionPhoto,PhotoCredit,Reveal}.tsx` | Deleted (added by the first version of #44) |
| Hero, Overview, WhySwiftHealth, FacilityOwners, HomeImage, `config/home.ts`, `app/(home)/page.tsx` | Exactly as on `main` |
| `frontend/tests/unit/BackdropSlideshow.test.tsx`, `backdropPhotos.test.ts`, `HomeSections.test.tsx`, `HomePage.test.tsx`, `homePerformance.test.tsx`, `homeImages.test.ts`, `tests/end-to-end/home-photos.spec.ts` | Tests below |
| `specs/2026-10-22-home-photos/*`, `specs/frontend/ui-spec.md` (2.1) | This revision |

## Tasks

### Task 0: back to `main`, and the spec
- [x] Restore the home page from `main` (files above), delete what #44 added and no longer uses, rename `sectionPhotos.ts`, rewrite requirements and plan.
### Task 1: the photo files (tests first)
- [x] (`3fda412`) Red `backdropPhotos.test.ts`: the five files exist (order clinic, hospital, maternity, laboratory, pharmacy), 960 × 640, under 50 kB, nothing else in the folders; `public/images/sections/` gone; `hero3`, `hero3-phone`, `hero4-portrait` still in `public/images/home/` and **byte-identical to `main`'s**; no original in `public/`.
- [x] (`3fda412`) Rewrite the script, make the files, look at them.
### Task 2: the slideshow (tests first)
- [x] (`711038c`) Red `BackdropSlideshow.test.tsx` (fake timers): only the first photo at first; the next added after the first has loaded and the page is idle; changes every 7 s; Pause holds and says Play; Play restarts; a hidden tab stops it; reduce motion = one still photo, no timer, no button; the credit (text, `https://www.magnific.com`, 16 px, new tab, `rel`); decorative (`alt=""`, `aria-hidden`); the heading and tiles are the same elements after a change; the HTML without scripts has the first photo and the credit; **contrast** from the tokens (worst case a black pixel at 18% over `pine-50`): heading `pine-dark` ≥ 4.5:1, credit and Pause on white ≥ 4.5:1; the section is `section-lazy`.
- [x] (`711038c`) Update `HomePage`, `HomeSections`, `homePerformance`, `homeImages` tests: the page is `main`'s, plus the slideshow, one client part, one outside link (the credit).
- [x] (`711038c`) Build `BackdropSlideshow` and change `FindByType`.
### Task 3: real browser at 320, 360, 768 and 1024 px
- [x] (`e8c954d`, `30f2e83`) `home-photos.spec.ts`: the slideshow changes photo (fake clock), Pause holds it, a hidden tab stops it, `reducedMotion: "reduce"` gives one still photo and no button, nothing wider than the screen, CLS 0, no photo requested before the section is near, the heading and tiles readable (a pixel contrast sample of the heading over every photo), hero and owners part unchanged, `/search` and `/find` have no picture, `/emergency` photos and offline check.
### Task 4: speed, wrap-up
- [x] (`30f2e83`) Lighthouse before and after (five runs each); `validation.md`; update the draft PR #44; the owner's own Lighthouse decides.
### Task 5: revision 6, the polish (tests first)
- [x] (`6bb8522`, `3dd58e1`, `d38baeb`) Red unit and browser tests, then: 800 / 1600 px files and the script; `<picture>` and `srcset`; the 3:2 band under 1024 px and the full frame from 1024 px; the 190 px cards with a 16 px line (`HOME_CATEGORIES.description`); the light-blue tint; the Pause / Play icon; the card lift; the kept sizes; Lighthouse before and after; specs and `validation.md`; draft PR #44.
