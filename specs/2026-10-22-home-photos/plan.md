# Home photos: plan

**Status: proposal (revision 3), not started. Waiting for the owner's "yes" and the answers in requirements.md.** Requirements: [requirements.md](requirements.md). Rules: tests first, one commit per task, IDs (US-13, US-01, US-04, FR-14, FR-17, NFR-01, NFR-03, NFR-10, NFR-13) in commits and tests; `git branch --show-current` before every commit and push; draft PR.

## Where the branch stands

| Commit | What | Status |
| --- | --- | --- |
| `0e28600` | Photo script, the specs, `source-photos/` ignored, sixteen slider WebP files | script and ignore entry stay; the sixteen `public/images/hero/*` slider files are replaced in task 1 |
| `49fa1c1` | No pictures on `/search`: banners, credits, config, files, script and old tests removed; new test | **done, stays** |
| `b83dc37` | Hero slider, hero search, feature cards, scroll-driven fade-in | built, then **undone** by `93eff44` on the owner's order |
| `93eff44` | Revert of the slider work | the hero is exactly as it was |

## Files

| File | Change |
| --- | --- |
| `frontend/scripts/optimize-hero-photos.mjs` | Rewritten for the new sizes: `public/images/sections/<name>-800.webp` (50 kB), `-480.webp` (25 kB) and `public/images/emergency/{ambulance,fire}.webp` (640 × 240, 40 kB); crops by hand after looking at each photo (hero3 above y = 2830) |
| `frontend/public/images/sections/` (new), `public/images/hero/` (deleted), `public/images/home/hero4-portrait.webp` (deleted, if question 6 is yes) | The files |
| `frontend/src/config/sectionPhotos.ts` | New: one entry per photo (file, size, alt, section) and the credit (one place) |
| `frontend/src/components/home/SectionPhoto.tsx` | New: the plain lazy `<img>` with fixed size and `aspect-ratio`, wrapped in `Reveal` |
| `frontend/src/components/home/Reveal.tsx` | New, the only client component: the `IntersectionObserver`, off with reduce motion |
| `frontend/src/components/home/PhotoCredit.tsx` | New: the "Designed by Magnific" link (16 px, 48 px, new tab) |
| `frontend/src/components/home/Overview.tsx`, `FindByType.tsx`, `FacilityOwners.tsx` | Photos added (owners: `owner` instead of the `hero4` portrait) |
| `frontend/src/components/home/HowWeVerify.tsx`, `HomeSwiftRescue.tsx` (new), `src/app/(home)/page.tsx`, `src/config/home.ts` | The two new sections and their words |
| `frontend/src/components/home/PhotoStrip.tsx` (new, only if question 4 is yes) | The slow strip with Pause, visibility stop, reduce motion |
| `frontend/src/styles/globals.css` | The `.photo-reveal` classes: the hidden start state exists only under `.js-reveal` (added by `Reveal`), and only inside `@media (prefers-reduced-motion: no-preference)` |
| `frontend/src/components/emergency/EmergencyGroups.tsx`, `GroupPhoto.tsx` (new), `public/sw.js` | Task 5 (blocked by #37, #39, #40) |
| `frontend/scripts/optimize-home-images.mjs`, `tests/unit/homeImages.test.ts`, `homePerformance.test.tsx`, `HomePage.test.tsx`, `HomeSections.test.tsx` | Updated to the new photo list and to the two client parts (`Reveal`, and the strip if built) |
| `specs/frontend/ui-spec.md` (2.1, 2.5), `LOG.md` | Task 0 and the end |

## Tasks

### Task 0: Spec (this document)
- [x] Revision 3 written; ui-spec 2.1 rewritten (the slider block is gone); waiting for "yes".
- [x] Photos reviewed; originals in `source-photos/` (ignored); part 1 done (`49fa1c1`).
### Task 1: the photo files (tests first)
- [ ] Red test `tests/unit/sectionPhotos.test.ts`: every config entry has a file; budgets (800 px ≤ 50 kB, 480 px ≤ 25 kB, emergency ≤ 40 kB); real pixel sizes equal the config; nothing else in the folders; no JPG or PNG original in `public/`; alt text rules (a sentence, no "image of", no city); the hero's `hero3.webp` untouched.
- [ ] Rewrite the script; make the files; delete the slider files; look at every file.
### Task 2: the photos in the sections (tests first)
- [ ] Red tests: the section order; each photo is in its section; every `<img>` is `loading="lazy"`, has `width`, `height`, alt and an aspect ratio; **no photo in the hero and the hero's HTML is unchanged** (a snapshot of its source); **no photo before the first section** (so none can delay the first paint); the credit link in each Magnific section (text, `https://www.magnific.com`, 16 px, 48 px, new tab, `rel`), none in the hero; the new sections' words are the exact text of requirements.md and every link goes to an existing route; one `h1`, an `h2` for each section; no red but the header's SwiftRescue button; no city; no number that is not in the config.
- [ ] Build `SectionPhoto`, `PhotoCredit`, the sections, the new sections.
### Task 3: the movement (tests first)
- [ ] Red tests (jsdom, a fake `IntersectionObserver`): a photo is shown with no class when scripts do not run; after mount it starts hidden and becomes visible when it intersects, once, and is then unobserved; **with reduce motion the observer is never created and no hidden class is ever added**; the CSS has the hidden start state only inside `@media (prefers-reduced-motion: no-preference)` and only under `.js-reveal`; only `opacity` and `transform` are animated; the observer is disconnected on unmount; the sections' text has no animation class.
- [ ] Build `Reveal` and the CSS.
- [ ] Only if question 4 is yes: tests (Pause/Play text and 48 px, stops while the tab is hidden, stays stopped after Play when the visitor had paused, reduce motion = no animation and no timer, the strip adds no new file) and `PhotoStrip`.
### Task 4: real-browser checks at 320, 360, 768 and 1024 px
- [ ] Playwright `tests/end-to-end/home-photos.spec.ts`: nothing wider than the screen; **no image request before scrolling** (the home page requests only the hero files until the visitor scrolls); photos appear on scroll (the class changes); with `reducedMotion: "reduce"` nothing moves and every photo is visible at once; **CLS 0** (a layout-shift observer, scrolling the whole page); each credit is 16 px and 48 px; `/search` has no images; the hero is pixel-identical to a screenshot taken before the change (same viewport).
### Task 5: SwiftRescue photos on `/emergency` (blocked: wait for #37, #39, #40)
- [ ] Red tests: a photo in the Ambulance and the Fire group only; fixed size, lazy; credit and alt; **112 and Call 112 stay the first things in the page source and the first tab stops** and appear with no photo request answered; a failing photo leaves no broken icon and no jump; the worker keeps the two files (cache first) and still never keeps an API answer or anything with a query; the saved offline copy has no image data. Real browser: offline check on a production build (`OFFLINE_CHECK=1`).
- [ ] Build `GroupPhoto`, update `EmergencyGroups` and `sw.js`.
### Task 6: speed and wrap-up
- [ ] Lighthouse before and after, three runs each on the same production build (requirements.md, "Measuring"); bytes before load and after scrolling; JavaScript added; CLS. Docs (`validation.md`, LOG), push, **draft PR**; the owner's own Lighthouse on the preview decides.
