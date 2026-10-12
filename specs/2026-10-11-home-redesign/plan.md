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
  update the roadmap and `LOG.md` once, and tick the boxes with their commit hashes. (The owner's first review led to Task 7;
  review again after it.)

### Task 7: A simpler home page, after the owner's review of the preview (tests first)
The changes are R1 to R7 of the "Revision, 2026-10-12" in [requirements.md](requirements.md). Files: `config/home.ts` (three photos,
the five categories with no photo, the words of the removed parts gone), `HomeHero.tsx` (rewritten), `BrowseByType.tsx` (icon
tiles), `HowItWorks.tsx` (extra top space for the photo that overlaps into it), `app/page.tsx` and `layout.tsx` (seven parts;
a description with no city), `scripts/optimize-home-images.mjs` (three jobs), and deleted: `RescueBand.tsx`, `AboutSwiftHealth.tsx`
and the eight photo files. `siteConfig.launchCity` stays.
- [x] Write the tests first. `homeImages.test.ts`: three files (hero, hero-phone, owner) and their budgets. `HomeSections.test.tsx`:
  the hero has a `pine-100` background and dark blue text with the contrast checked from the tokens (at least 4.5:1, white would
  fail), the new line, one button "Find care near me" (primary blue) and no "Emergency help", no second photo and no overlay,
  the photo has a negative bottom margin and is above the next section, the hero has no `overflow-hidden`, the next section has
  room at its top; browse by type has five icon tiles (no images). `HomePage.test.tsx`: seven parts in order, two images, only
  the hero eager, red only in the header, no city anywhere in the page text, the source and the page description, no band and no
  About, `siteConfig.launchCity` still exists. Delete the tests of the removed parts. They fail.
- [x] Change the code and delete the files (`RescueBand`, `AboutSwiftHealth`, eight photos). The two components went with `git
  rm`; the photos are in a folder that the container made (owned by root), so they were deleted from inside the container.
- [x] Run lint, typecheck, the whole test suite (589) and the build, one at a time, then commit (`f5f58cc`): `feat(web): a simpler
  home page: two photos, icon tiles, a lighter hero (US-13, NFR-01, NFR-10)`. The build: `/` is static, 6.5 kB, 113 kB first load.
- [x] Push, wait for the checks, and tell the owner the preview is ready (`d57c5ed`, `17086ce`; pull request #21 `frontend` pass).

### Task 8: New photos and no photo credit (tests first)
The changes are R8 to R10 of the "Second revision, 2026-10-12" in [requirements.md](requirements.md). Files: `scripts/optimize-home-images.mjs`
(three jobs from `hero4.jpg` and `owner2.jpg`, each with a hand-made 4:3 crop), `public/images/home/` (new: `hero4.webp`,
`hero4-phone.webp`, `owner2.webp`; deleted: `hero.webp`, `hero-phone.webp`, `owner.webp`), `config/home.ts` (new files, sizes and alt
text), `config/site.ts` and `SiteFooter.tsx` (no photo credit), and the tests of the photos and the footer.
- [x] Write the tests first: `homeImages.test.ts` (the new names and sizes 1280 × 960, 640 × 480 and 800 × 600, the old files gone,
  the script's three targets), `HomeSections.test.tsx` (the hero's width and height), `SiteFooter.test.tsx` (no credit, no outside
  link, no Magnific and no Unsplash text anywhere, the six links and the copyright line stay), `HomePage.test.tsx` (the page has no
  outside link). They fail.
- [x] Copy `hero4.jpg` and `owner2.jpg` (not `hero3.jpg`) into `frontend/image-sources/`, change the script, run it, look at both
  converted photos, write the alt text, change the config and the footer, delete the three old files and the credit. (Both originals
  are portrait; each is cut by hand to 4:3, and the converted photos were looked at: the hero shows the face and the blister pack,
  the owner photo the person, the hands and the shelves.)
- [x] Run lint, typecheck, the whole suite (591) and the build, one at a time, then commit (`1f1cdcc`): `feat(web): new hero and
  owner photos, and no photo credit in the footer (US-13, NFR-01, NFR-10)`. The built page names three image files, has no
  outside link and no image preload.
- [x] Push, wait for the checks, and tell the owner the preview is ready (`ef7da5e`, `5e75476`; pull request #21 `frontend` pass).

### Task 9: other photos, a sky blue hero, an Overview, "Benefits", a logo (tests first)
The changes are R11 to R17 of the "Third revision, 2026-10-12" in [requirements.md](requirements.md). Files: `scripts/optimize-home-images.mjs`
(three jobs: `hero3` square, `hero3` phone, `hero4` whole), `public/images/home/` (new: `hero3.webp`, `hero3-phone.webp`,
`hero4-portrait.webp`; deleted: `hero4.webp`, `hero4-phone.webp`, `owner2.webp`), `config/home.ts`, `styles/globals.css` (the `sky`
token), `HomeHero.tsx` (the new layout), new `Overview.tsx`, `WhySwiftHealth.tsx` (heading "Benefits"), `FacilityOwners.tsx` (the
whole portrait photo), `HowItWorks.tsx` (no more extra top room: it moved to the Overview), `app/page.tsx`, new
`components/layout/Logo.tsx`, new `HeaderNavigation.tsx` (client: hides "Find care" on `/`), `SiteHeader.tsx`, `MobileMenu.tsx`
(unchanged), new `src/app/icon.svg`, and the tests.
- [x] (0d91045) Write the tests first: `homeImages.test.ts` (the new files, sizes 1200 × 1200, 640 × 640 and 800 × 1200, budgets 150, 50 and 100
  kB, the old files gone, the script's targets); `design-tokens.test.ts` (the `sky` token, its pairs and its focus ring);
  `HomeSections.test.tsx` (the hero: sky background, dark navy text with the contrast computed from the tokens, the right-half photo
  that runs to the right edge on a tablet and desktop and is full width on a phone, the overlap rules, the Overview part, the
  "Benefits" heading, the Overview's room at the top); `HomePage.test.tsx` (eight parts in order, the owners photo whole with a
  maximum height, the images, no outside link); `SiteHeader.test.tsx` (Find care hidden on `/` in the bar and in the menu, shown
  elsewhere; the logo); `Logo.test.tsx`; `icon.test.ts` (the favicon file: a pin and a plus, no red, colour equals the `forest`
  token). They fail.
- [x] (0d91045) Copy `hero3.jpg` (and the existing `hero4.jpg`) into `frontend/image-sources/`, change the script, run it, look at both photos,
  write the alt text, add the token, the components, the logo and the favicon, and delete the three old files.
- [x] (0d91045) Run lint, typecheck, the whole suite (622 tests) and the build, one at a time, then commit: `feat(web): hero3 and hero4
  photos, a sky blue hero, an Overview, Benefits, and a logo (US-13, NFR-01, NFR-10)`.
- [x] (c2b1863) Push, wait for the checks, and tell the owner the preview is ready.
