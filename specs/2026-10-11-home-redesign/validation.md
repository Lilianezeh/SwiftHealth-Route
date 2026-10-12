# Home page redesign (phase 13a, pulled forward): validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves US-13, NFR-01, FR-02, FR-14, NFR-04, NFR-10, NFR-07 or NFR-12. Tick a box only
after the test exists and passes.

## How to run

The commands run in the frontend container, one at a time:
- Lint: `docker compose exec frontend npm run lint`
- Types: `docker compose exec frontend npm run typecheck`
- Tests: `docker compose exec frontend npm test`
- Build and page weight: `docker compose exec frontend npm run build` (read "First Load JS" for `/`, which should be static),
  then `rm -rf .next` in the container and restart it
- Photos: `docker compose exec frontend node scripts/optimize-home-images.mjs` (reads `image-sources/`, writes
  `public/images/home/`)

## Tests per task

Each test failed first (the files or the code did not exist) and passes now. The frontend suite went from 507 to 584 tests.

### Task 1: `tests/unit/homeImages.test.ts` (done, `797ab10`)
- [x] `are the eleven files of the spec: ten photos and the small hero for phones`
- [x] `exist as .webp files in public/images/home`, and `are the only files of the folder`
- [x] `are each under their budget: heroes 150 kB, the phone hero 50 kB, the cards and the band 60 kB, the owner photo 80 kB`
- [x] `have the width and the height written in the code, the real pixel size of the file` (read from the WebP header)
- [x] `have the sizes of the spec: the heroes, the cards (4:3), the band and the owner photo`
- [x] `each have alt text: short, not empty, and not starting with 'image of' or 'photo of'`
- [x] `make the phone hero a smaller version of the same photo` (same shape, same alt text)
- [x] `have no original JPG, JPEG or PNG anywhere in public/`, and `keep the full-size originals out of git: image-sources/ is
  ignored by frontend/.gitignore`

### Task 2: `SiteHeader.test.tsx`, `MobileMenu.test.tsx`, `SiteFooter.test.tsx` (done, `c5d2758`)
- [x] `SiteHeader has the SwiftHealth wordmark, a link to the home page`; `has Find care to /find, red SwiftRescue to /emergency,
  and For facilities to /list-your-facility`; `puts the links in the order Find care, SwiftRescue, For facilities`
- [x] `makes SwiftRescue red (the emergency colour, white text), and no other link is red`
- [x] `keeps SwiftRescue in the bar on a phone: it is not hidden and not inside the menu` (FR-02)
- [x] `shows Find care and For facilities in the bar from tablet width, and leaves them to the menu on a phone`
- [x] `has a forest background and the on-dark class`, `has a bright blue accent line under it`
- [x] `keeps every tap target at 48 px or more, the Menu button too`
- [x] `MobileMenu has a Menu button with the word and a decorative icon, at least 48 px high`; `starts closed: aria-expanded is false
  and there are no links`; `opens with the button: aria-expanded is true and the panel has Find care and For facilities`
- [x] `MobileMenu makes every link of the panel at least 48 px high`; `closes with the button`; `closes with Escape and puts the
  focus back on the button`; `closes when a link is chosen`; `does not listen for Escape while it is closed`
- [x] `SiteFooter keeps its six links, in the same order`, and `makes the footer links at least 48 px high`
- [x] `SiteFooter has the credit "Images designed by Magnific" as a link to https://www.magnific.com`, `opens the credit in a
  new tab, safely, and tells a screen reader so`, `has no Unsplash credit`
- [x] `SiteFooter ends with the copyright line, and the year comes from siteConfig, not from the clock`; `puts the credit after
  the links and the copyright line last`

### Task 3: `tests/unit/HomeSections.test.tsx` (done, `976dbda`)
- [x] `the hero has one h1 with the exact heading`, `has the exact line, with the first city taken from the site settings`,
  `has the exact small line, at 16 px or more`
- [x] `has a white Find care near me button to /find, and a red Emergency help button to /emergency`, and `keeps both buttons at
  48 px or more`
- [x] `is one picture: phones up to 767 px take the small hero (640w, sizes 100vw), everyone else the big one`
- [x] `loads the hero at once and with high priority, with no srcset of its own that could pick another file`
- [x] `does not use the priority prop, which would also preload the big file on a phone`
- [x] `has a second photo only from tablet width: lazy, inside a box that is hidden below 768 px, never in a source`
- [x] `covers the phone photo with a dark blue overlay of 80% or more that is gone from tablet width`, and `keeps white text at
  least 4.5:1 on the overlay even over a pure white photo` (at the 85% used: the worst case, a white photo, is `#366980`, 6.02:1 with white text)
- [x] `says nothing about Enugu being the only place`
- [x] `how it works has an h2 and three steps in order, with the exact words`, and `numbers the steps and gives each a decorative icon`
- [x] `browse by type has an h2 and five cards in the owner's order, each one link to the search for its category`; `gives each
  card its photo, with the fixed size and the alt text of the config, loaded lazily`; `shows the label as visible text of 16 px or
  more, and uses no red`
- [x] `why SwiftHealth has an h2 and four items with the exact titles`, `gives each item a decorative icon and a line of text`,
  `says hours follow local time, including late-night places`
- [x] `the four parts use the red emergency colour only in the hero's Emergency help button`

### Task 4: `tests/unit/HomePage.test.tsx` (done, `7ca94a3`)
- [x] `the rescue band has the exact heading and a red Open SwiftRescue button to /emergency`, `shows the ambulance and the fire
  photos, with their size and alt text, loaded lazily`, `gives no medical advice and no instructions: only the heading and the button`
- [x] `the facility owners part has the owner photo, the exact heading, the exact text and a List your facility button`
- [x] `the about part has the exact heading and text, with the first city from the site settings`
- [x] `the whole page has the nine parts in the owner's order`, and `has one h1 and only h2 and h3 headings after it`
- [x] `makes no request and reads no API: the page is not async and does not call getHealth or fetch`
- [x] `never says Enugu is the only place, in the page, the header, the footer or the page description`, and `names the first city
  only through siteConfig: no component writes Enugu itself`
- [x] `has no percent sign and no number but the year: no invented statistics`, and `has no testimonial`
- [x] `has an alt text, a width and a height on every image` (10 images), and `loads only the hero at once: every other image is lazy`
- [x] `uses the red emergency colour on exactly three buttons: the header's, the hero's and the band's`
- [x] `points every button of the page to the right place`

### Task 5: `tests/unit/EmergencyPage.test.tsx` (done, `7da9ee2`; the FR-26 sentence `c949891`)
- [x] `the emergency page has one h1, SwiftRescue`
- [x] `has a Call 112 link to exactly tel:112`
- [x] `makes Call 112 red with white text, and large: at least 64 px high with 24 px text` (and the full width on a phone)
- [x] `gives the button a decorative icon beside the words, hidden from screen readers`
- [x] `has the exact line about the full list coming soon`
- [x] `has the sentence of FR-26: SwiftRescue connects you to contacts, does not dispatch or guarantee a response, and says to
  call 112` (exact words, 16 px or more, visible) and `puts the sentence of FR-26 after the button and the line about the list,
  in the page's text, not behind a click` (added at the owner's request, `c949891`)
- [x] `has nothing else: one link, two lines, no list, no image, no advice, no old placeholder text`
- [x] `is a server page with no data: not a client component, no request`, and `calls only 112: no other phone number is on the page`

### Task 7: a simpler home page (2026-10-12): `homeImages.test.ts`, `HomeSections.test.tsx`, `HomePage.test.tsx` (done, `f5f58cc`)
Replaces the tests of Tasks 1, 3 and 4 that were about the removed parts (the eight photos, the two-photo hero with its overlay,
the photo cards, the band, About, the red hero button, the city in the text). 22 tests failed first (the old code), then passed.
The frontend suite is 589 tests.
- [x] `homeImages`: `are the three files of the spec: the hero, the small hero for phones, and the owner photo`; `are the only
  files of the folder: the eight photos the owner dropped are gone`; the budgets (hero 150 kB, phone hero 50 kB, owner 80 kB); the
  real pixel sizes (read from the files); alt text on each; `are made by a script that makes only these three files`
- [x] `the hero has a lighter blue background (pine-100) and no photo behind the text`; `writes the text in dark blue, which is at
  least 4.5:1 on the lighter blue` (from the tokens: `pine-dark` 7.37:1, `ink-soft` 5.83:1); `does not write white text on the
  lighter blue, which would be unreadable there (1.2:1)`
- [x] `the hero has the exact line, which names no city`, the exact heading and the exact small line
- [x] `has one button, Find care near me to /find, in the primary blue: no Emergency help, nothing red`, and `keeps the button at 48 px
  or more`
- [x] `has one photo only: no second photo, no hero2 anywhere`; `is one picture: phones up to 767 px take the small hero (640w, sizes
  100vw), everyone else the big one`; `loads the hero at once and with high priority`; `does not use the priority prop`
- [x] `lets the photo overlap the bottom edge of the hero into the next section`: the hero is `relative` with no `overflow-hidden`
  and no `isolate`; the photo box is `relative z-10`, with `-mb-12` on a phone and `md:mb-0 md:self-end md:translate-y-1/3` from 768
  px; `puts the photo after the text (below it on a phone) and in the right column from 768 px`; `makes the photo large and rounded`
- [x] `how it works leaves room at its top for the hero photo that overlaps into it, more on a tablet and a desktop` (`pt-20`, `md:pt-40`)
- [x] `browse by type has an h2 and five tiles in the owner's order, each one link to the search for its category`; `gives each tile
  a decorative icon over its label, and no photo`; `keeps each tile at 48 px or more, with the label at 16 px or more, and uses no red`
- [x] `the whole page has the seven parts in the owner's order`, and `has one h1 and four h2 (…), and no heading deeper than h3`
- [x] `has two images only, the hero and the owner photo, each with alt text, a width and a height`, and `loads only the hero at once`
- [x] `has no SwiftRescue band and no About part` (the components are deleted too)
- [x] `names no city anywhere on the page: not in the text, not in the page description, not in the components` (no "Enugu" at all,
  in the page text, in `metadata.description` and in ten source files), and `keeps siteConfig.launchCity` (the home page does not use it)
- [x] `uses the red emergency colour once: the SwiftRescue button of the header`, and `has no Emergency help and no Open SwiftRescue
  button`
- [x] `points every button of the page to the right place` (Find care near me, List your facility)
- [x] The existing tests still pass (the whole suite, 589).

## Review-focus edge cases

Checked by the tests and by the build (2026-10-11; the hero details changed on 2026-10-12, see Task 7):
- [x] **The hero tag in the built page.** `.next/server/app/index.html` has `<picture><source media="(max-width: 767px)"
  srcSet="/images/home/hero-phone.webp 640w" sizes="100vw"/><img … loading="eager" fetchPriority="high" width="1280"
  height="853" src="/images/home/hero.webp" …/></picture>`, and no `<link rel="preload">` for any image (only one for the webpack script).
- [x] **Static page.** The build shows `/` as static (`○`, it was `ƒ` while it called the API): 6.5 kB, 113 kB first load JS.
- [x] **The phone hero is the small file by construction** (one candidate, a media rule), not by luck with the pixel density.

For the owner, in a browser (see the smoke test):
- [ ] **320 px.** No sideways scrolling; the buttons stack; the header bar (wordmark, SwiftRescue, Menu) fits.
- [ ] **A very long word or large text size.** The headings wrap; nothing is cut off.
- [ ] **Phone: only the small hero.** At 360 px wide, with the cache off, the Network panel shows a request for
  `hero-phone.webp` (about 28 kB) and none for `hero.webp` or `hero2`; at 1280 px it shows `hero.webp` and `hero2` and not
  `hero-phone.webp`. Checked on a high-density phone too (it must still take the small file).
- [ ] **First load under 500 KB.** At 360 px, cache off, before scrolling, the total transferred is under 500 KB; the other photos
  load only when scrolled near.
- [ ] **The hero photo is the largest contentful element** and is found at once (it is in the first HTML).
- [ ] **Keyboard.** Tab goes through the header, the menu panel, the hero buttons, the cards and the footer in reading order; the
  focus ring is visible on the dark header, the photo overlay and the white background.
- [ ] **Screen reader.** One `h1`, then `h2`s; each card is one link with its label; icons are hidden; the photos have alt text.
- [x] **The 112 source.** The sources of decision 18 are real NCC pages (checked on 2026-10-11, quoted there); the page makes no
  promise about the answer, and it now carries the sentence of FR-26 (the owner asked for it).
- [ ] **A call from a phone.** On a real phone, "Call 112" opens the dialler with 112 filled in. The owner does NOT place the
  call to test it.
- [ ] **Links that lead to "Coming soon".** `/list-your-facility` and `/about` still say "Coming soon" (decision 4);
  `/emergency` has the minimal page. The owner knows; nothing here hides it.

## Security checklist

- [x] No new package: `git diff origin/main -- frontend/package.json frontend/package-lock.json` is empty (2026-10-11). The
  script uses `sharp`, which Next.js installs for itself.
- [x] No `dangerouslySetInnerHTML` and no `innerHTML` in `frontend/src` (`git grep`, 2026-10-11); all text is rendered as text.
- [x] The only outside link of the new page is the Magnific credit: `target="_blank"` with `rel="noopener noreferrer"` (a test).
- [x] All photos are local files (`/images/home/...`), so no outside request leaves the page.
- [x] No original photo, no secret and no `.env` change is committed: `public/images/home` is 348 kB of WebP and
  `frontend/image-sources/` is ignored (`git check-ignore` and a test).
- [x] The page keeps no personal data and makes no request to the API (a test; the build shows it as static).

## Smoke test (owner, on the Netlify preview)

Updated on 2026-10-12 for the simpler page (Task 7).
- [ ] Phone (a real phone): the hero is dark blue text on the lighter blue, readable, with one "Find care near me" button; the photo
  is below the text and its bottom overlaps the edge into the next section without covering any text; the menu opens and closes;
  SwiftRescue is always visible; every button and tile goes to the right place; nothing scrolls sideways.
- [ ] Laptop at 1280 px: the text on the left and the photo on the right, overlapping the bottom edge of the hero into "How it
  works" without covering its text; the five tiles in one row; the header shows all four links.
- [ ] Laptop at about 768 px (the smallest tablet layout): the overlap is still clear of the text of the next part.
- [ ] Laptop with DevTools at 360 px, Network, cache off, throttled to 3G: the first load is under 500 KB, only
  `hero-phone.webp` is requested for the hero (no `hero.webp`), and `owner.webp` loads while scrolling.
- [ ] The words match the brief (and the page says no city anywhere); the alt texts are right for the two photos; the Magnific
  credit is in the footer.
- [ ] The two photos look right, and neither is blurry or over-compressed.
- [ ] `/emergency`: the red Call 112 button, the line about the list and the FR-26 sentence; the button opens the dialler on a phone.
- [ ] Other pages (`/find`, `/search`) still look right with the new header and footer.

## Merge checklist

- [x] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` are clean (2026-10-12, on `f5f58cc`): lint and
  typecheck clean, 589 tests passing, the build passes. `/` is static: 6.5 kB, 113 kB first load JS (it was dynamic, 103 kB);
  `/emergency` is 105 kB. The built page names three image files only (`hero`, `hero-phone`, `owner`), has no image preload, and
  no city word.
- [x] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run. What `gh pr checks 21` showed
  (2026-10-11, after `83db4c4`): `frontend` **pass** (1m37s, run 38181298116); the only workflow run on the branch is Frontend
  CI (no Backend CI run); Netlify `Header rules` and `Redirect rules` pass, `Pages changed` skipping, `deploy-preview` pass:
  <https://deploy-preview-21--swifthealth-ng.netlify.app>. The preview answers 200 on `/` and `/emergency`, and serves
  `hero-phone.webp`, `hero.webp` and `hero2.webp` as `image/webp`; its `<picture>` has the phone-only `<source>`.
- [x] `git diff --stat origin/main -- backend` is empty (2026-10-11).
- [ ] The UI spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The smoke test above is done on the preview.
- [ ] The pull request stays a draft until every box above is ticked.

Note: this branch also carries `dc8685c` (the 6a "done" docs, a docs-only commit that was not yet on `main`), so the pull request
shows it too. One run of the full suite had a single failure in `NearbySuggestions.test.tsx` that passed when run alone and in
the next full run (a timing flake under load, not a change of this feature).
