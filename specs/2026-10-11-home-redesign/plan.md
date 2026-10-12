# Home page redesign (phase 13a, pulled forward): plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and checks that
prove each task are in [validation.md](validation.md). The words of the page are in [ui-spec.md](../frontend/ui-spec.md), 2.1.

Rules: tests first, one commit per task, requirement IDs (US-13, NFR-01, FR-02, FR-14, NFR-04, NFR-10, NFR-07, NFR-12) in every
commit and test. Tick a box with its commit hash only when the step is really done. Check `git branch --show-current` before every
commit and push, and never push to `main` (CLAUDE.md). The pull request stays a draft until the merge checklist in
[validation.md](validation.md) is ticked. Run one test process at a time.

## Files

| File | Change |
| --- | --- |
| `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md` | Layout (header, footer), 2.1 and 2.5 rewritten; status; reminders (Task 0) |
| `specs/2026-10-11-home-redesign/` | This folder (Task 0) |
| `frontend/scripts/optimize-home-images.mjs` | Task 1: new. Makes the WebP files with `sharp` (shipped with Next.js), to the pixel sizes and budgets of decision 8; the hospital card has a hand-made crop |
| `frontend/image-sources/` | Task 1: the 10 original JPGs, copied from `IMAGES`; git-ignored, never committed |
| `frontend/.gitignore` | Task 1: new. Ignores `image-sources/` (the container sees only `frontend/`, so the rule is here, not in the root file) |
| `frontend/public/images/home/*.webp` | Task 1: the 10 photos (hero, hero2, hospital, clinic, maternity, pharmacy, laboratory, ambulance, fire, owner) and `hero-phone.webp`, the small hero for phones (640 px, about 28 kB) |
| `frontend/src/config/home.ts` | Task 1: the photos (file, size, alt text); Tasks 3 and 4: the words of the page and the five categories |
| `frontend/src/config/site.ts` | Task 2: first city, navigation links, photo credit, copyright year |
| `frontend/src/components/layout/SiteHeader.tsx`, `MobileMenu.tsx` | Task 2: the new header; the menu button is the only client part |
| `frontend/src/components/layout/SiteFooter.tsx` | Task 2: credit and copyright |
| `frontend/src/components/home/HomeImage.tsx` | Task 3: `next/image`, fixed size, `unoptimized`, alt required by its types (planned as `HomePhoto`; renamed, because `HomePhoto` is the type) |
| `frontend/src/components/home/HomeHero.tsx`, `HowItWorks.tsx`, `BrowseByType.tsx`, `WhySwiftHealth.tsx` | Task 3: parts 2 to 5 |
| `frontend/src/components/home/RescueBand.tsx`, `FacilityOwners.tsx`, `AboutSwiftHealth.tsx` | Task 4: parts 6 to 8 |
| `frontend/src/app/page.tsx`, `layout.tsx` | Task 4: the page is the 9 parts, static (no API call); the page description |
| `frontend/src/app/(public)/emergency/page.tsx` | Task 5: the minimal SwiftRescue page (heading, red "Call 112" `tel:112`, one line) |
| `frontend/tests/unit/`, `tests/helpers/` | New: `homeImages`, `HomeSections`, `HomePage`, `MobileMenu`, `SiteFooter`, `EmergencyPage`, helpers `webp.ts` and `contrast.ts`; changed: `SiteHeader` |

No backend change, no new package (`sharp` is already in `node_modules` through Next.js), no new colour or font, no animation.

## Tasks

### Task 0: Spec (done, `51dcad0`)
- [x] Write this folder, the UI spec text (layout, 2.1), the roadmap status and the `LOG.md` reminders (the Magnific licence
  proof; the `/emergency` pictures stay a phase 7 job). Commit: `docs(specs): home page redesign, spec (US-13, NFR-01, FR-02,
  FR-14, NFR-10)`. (It also carries the owner's "Learned" line for Day 8 part 2 in `LOG.md`, and the owner's two additions of
  2026-10-11: the minimal emergency page, and the smaller phone hero.)

### Task 1: The photos (tests first) (done, `797ab10`)
- [x] Write `tests/unit/homeImages.test.ts`: every file named in `config/home.ts` exists in `public/images/home/`, is a `.webp`,
  is under its budget (`hero-phone.webp`: 640 px wide, under 50 kB); no file of the folder is unlisted; every entry has
  non-empty alt text and fixed width and height; no original (JPG or PNG) is in `public/`. It failed: nothing existed yet.
- [x] Copy the 10 JPGs from `/mnt/c/Users/Lilian/Desktop/IMAGES/` into `frontend/image-sources/` (ignored). Write the script
  (resize with `fit: cover`, convert to WebP, lower the quality step by step until the budget is met; print the sizes). Run it in
  the frontend container. (Every file fitted its budget at the first quality, 80: the largest is the hero, 77 kB.)
- [x] Look at every converted photo (the crop of the portrait `hospital`, the faces and the text in the photos), write the alt
  text in `config/home.ts`, and show the owner the list of sizes and alt texts. (The automatic crop of the hospital card cut a
  face, so it has a hand-made crop. The owner reviews the alt texts on the preview.)
- [x] Run lint, typecheck and the tests, then commit: `feat(web): the home page photos, converted for 3G (US-13, NFR-01, NFR-10)`.

### Task 2: Header and footer (tests first) (done, `c5d2758`)
- [x] Write the tests: the header has the wordmark (to `/`), Find care, SwiftRescue (red, `/emergency`) and For facilities; on a
  phone the menu button (word and icon, 48 px, `aria-expanded`) opens and closes the panel with Find care and For facilities, and
  Esc closes it; SwiftRescue is outside the menu, so it is always there; all tap targets 48 px; the focus ring is the light one on
  the dark bar. The footer keeps its six links and adds the Magnific credit (right address, new tab, `rel`) and "© 2026
  SwiftHealth". They failed.
- [x] Write `siteConfig` additions, `SiteHeader`, `MobileMenu` (the one client component) and `SiteFooter`.
- [x] Run the checks, then commit: `feat(web): the new header with a phone menu, and the footer credit (FR-02, NFR-10)`.

### Task 3: Hero, how it works, browse by type, why SwiftHealth (tests first) (done, `976dbda`)
- [x] Write the tests: the exact words; the buttons and their addresses; one `h1` and the `h2` order; the three steps and four
  items each with a decorative icon beside text; five category cards, each one link to `/search?category=<slug>` with a photo
  and alt text; the hero is one `<picture>` with a `<source media="(max-width: 767px)">` whose `srcset` is
  `hero-phone.webp 640w` and whose `sizes` is `100vw`, and an `<img>` of `hero.webp` with width, height, alt text,
  `loading="eager"` and `fetchPriority="high"`, and no `priority` (so no preload link for a big file on a phone); `hero2` is
  lazy and inside a box hidden on phones, and is never in a `<source>` or a preload; the overlay is `pine-dark` at 80% or more
  and the worst-case contrast (a white photo under it) is at least 4.5:1; the red colour is only on the "Emergency help"
  button. They failed.
- [x] Write `HomeImage` and the four parts (the hero uses `getImageProps` from `next/image` for the `<picture>`).
- [x] Run the checks, then commit: `feat(web): home hero, how it works, browse by type and why SwiftHealth (US-13, NFR-01, NFR-10,
  NFR-07)`.

### Task 4: The rest of the page and the assembly (tests first) (done, `7ca94a3`)
- [x] Write the tests: the band (two photos, the heading, a red "Open SwiftRescue" to `/emergency`), the facility part ("List your
  facility" to `/list-your-facility`), the About text, the order of all 9 parts on the page, no API call (the page is static), no
  "Enugu only", no percent sign or invented number, every `img` has alt text and a width and a height, the red colour appears
  only on the three emergency buttons. They failed.
- [x] Write the three parts, assemble `app/page.tsx` (no `getHealth`), and update the page description in `layout.tsx` (no
  "Enugu only").
- [x] Run the checks, then commit: `feat(web): the SwiftRescue band, the facility part, About, and the new home page (US-13,
  FR-02, NFR-12)`.

### Task 5: The minimal emergency page (tests first) (done, `7da9ee2`)
- [x] Write `tests/unit/EmergencyPage.test.tsx`: one `h1` "SwiftRescue"; a link "Call 112" to exactly `tel:112`, in the red
  `emergency` colour with white text, at least 48 px high, large (not a small link); the exact line "Our full list of verified
  ambulance, fire and hospital emergency numbers is coming soon."; nothing else on the page (no other link, no list, no advice,
  no "Coming soon" heading, no sponsored or featured text); the page is a server page with no data fetch; the accessible name
  of the button says it calls 112. They failed: the page said "SwiftRescue — emergency help (offline, 112 first)" and "Coming soon".
- [x] Replace `app/(public)/emergency/page.tsx`.
- [x] Run the checks, then commit: `feat(web): a minimal SwiftRescue page with a Call 112 button (FR-14, FR-02, NFR-10)`.

### Task 6: Wrap-up
- [x] Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` once each, one at a time; write the weight of `/`
  (it is static) in [validation.md](validation.md): 584 tests, `/` static, 6.5 kB, 113 kB first load JS.
- [x] Push the branch and open the draft pull request (#21, `83db4c4`). `Frontend CI` ran and passed, `Backend CI` did not run;
  `gh pr checks` and the Netlify preview link are in [validation.md](validation.md). (The photo script had saved each file by
  encoding it a second time, so a file was a little different from the one measured against its budget; it now writes the
  measured bytes. Found while checking the preview.)
- [ ] The owner reviews the preview (phone and desktop; Network panel at phone width), see [validation.md](validation.md). Then
  update the roadmap and `LOG.md` once, and tick the boxes with their commit hashes.
