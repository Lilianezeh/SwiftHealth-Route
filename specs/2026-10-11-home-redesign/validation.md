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

### Task 8: new photos, no photo credit (2026-10-12): `homeImages.test.ts`, `HomeSections.test.tsx`, `SiteFooter.test.tsx`, `HomePage.test.tsx` (done, `1f1cdcc`)
Replaces the tests about the Magnific credit (Task 2) and the old file names and sizes (Tasks 1 and 7). 10 tests failed first, then
passed. The frontend suite is 591 tests.
- [x] `homeImages`: `are the new files, hero4, hero4-phone and owner2`; `are the only files of the folder: every photo the owner
  dropped or replaced is gone` (the old `hero`, `hero-phone` and `owner` too); `have the sizes of the spec (R9)`: 1280 × 960, 640 ×
  480 and 800 × 600, the real pixel size of each file; the budgets (150, 50 and 80 kB; the files are 32.8, 11.7 and 38.6 kB); the
  alt texts; `are made by a script that makes only these three files` and does not read `hero3`
- [x] `HomeSections`: the hero is still one picture with the phone-only source (`hero4-phone.webp 640w`, sizes 100vw) and an `<img>` of
  `hero4.webp` at 1280 × 960, loaded at once, no priority; the overlap rules are unchanged
- [x] `SiteFooter`: `has no photo credit and no outside link`; `says nothing of Magnific or Unsplash, in the page or in the source`
  (the code without its comments); `keeps its six links in the same order`; `puts the copyright line after the links, and it is
  the last thing in the footer`
- [x] `HomePage`: `has no outside link anywhere on the page, and no photo credit`; the two images are `hero4.webp` and `owner2.webp`
- [x] The existing tests still pass (the whole suite, 591).

### Task 9: other photos, a sky blue hero, an Overview, "Benefits", a logo (2026-10-12)
Tests: `homeImages.test.ts`, `design-tokens.test.ts`, `HomeSections.test.tsx`, `HomePage.test.tsx`, `SiteHeader.test.tsx`,
`Logo.test.tsx`, `icon.test.ts`. They replace the tests about the 4:3 `hero4`/`owner2` photos and the Task 7 hero layout.
- [x] `homeImages`: the files are `hero3.webp`, `hero3-phone.webp` and `hero4-portrait.webp`; `hero4.webp`, `hero4-phone.webp` and
  `owner2.webp` are gone; the real sizes 1200 × 1200, 640 × 640 and 800 × 1200; budgets 150, 50 and 100 kB; alt texts;
  the script makes only these three, reads `hero3.jpg` and `hero4.jpg`, and crops only the hero (the owners photo is not cropped)
- [x] `design-tokens`: `sky` is `#a9ddf3`; `pine-dark` on `sky` and `ink` on `sky` are at least 4.5:1; the forest focus ring on `sky`
  is at least 3:1; white on `sky` is not enough (so no white text on it)
- [x] `the hero has the sky background (bg-sky) and no pine-100`; `all its text is dark blue (pine-dark), at least 4.5:1 on sky`
- [x] `on a tablet and desktop the photo covers the right half of the hero, from the top, to the right edge, and goes below the hero's
  bottom edge`; `on a phone it is below the text and the full width of the screen`; `the hero has no overflow-hidden and is not
  isolated`; `the text column stops at the middle`
- [x] `the hero is still one picture with the phone-only source (hero3-phone.webp 640w, sizes 100vw)`, loaded at once, no priority
- [x] `the Overview part comes right after the hero, has an h2 "Overview" and the owner's exact text, and has the room at its top`
- [x] `how it works no longer has the extra top room`; `the Benefits part has the h2 "Benefits" and no "Why SwiftHealth" anywhere`
- [x] `the page has the eight parts in order` (header, hero, Overview, How it works, Browse by type, Benefits, For facility owners, footer)
- [x] `the owners photo is the whole portrait: not cropped (no object-cover), full width on a phone, a maximum height of 32 rem from
  768 px with its shape kept`; `the page has two images: hero3 and hero4-portrait`; `only the hero is eager`; `no outside link`
- [x] `SiteHeader`: `hides Find care on the home page, in the bar and in the phone menu`; `shows it on /find, /search, /emergency and
  every other page`; `SwiftRescue and For facilities stay on every page`
- [x] `Logo`: `is an inline SVG pin with a plus, hidden from screen readers, next to the word SwiftHealth`; `the pin is accent blue with
  a white plus and a white edge, and nothing is red`; `the wordmark link still has the name SwiftHealth and goes to /`
- [x] `icon.svg`: `is a pin with a plus in forest blue and white`, `has no red`, and `the blue equals the forest token`
- [x] The existing tests still pass (the whole suite, 622 tests; lint and typecheck clean).
- [x] Build (2026-10-12): `/` is static (`○`), 6.5 kB, 113 kB first load JS; the built page names only `hero3.webp`,
  `hero3-phone.webp` (`640w`, the phone-only `<source>`) and `hero4-portrait.webp`, has no image preload, links `/icon.svg`, has no
  "Find care" link and no Enugu, Unsplash or Magnific.
- [x] Sky blue contrast, computed from the tokens: `pine-dark` on `#a9ddf3` 6.08:1, `ink` 10.80:1, `ink-soft` 4.82:1, the forest focus
  ring 3.83:1, white 1.47:1 (not used for text). No change to the shade was needed.

- [x] CI and preview (2026-10-12, c2b1863): Frontend CI passes (Backend CI did not run); the preview `/` is 200, `hero3.webp`,
  `hero3-phone.webp` and `hero4-portrait.webp` are served as `image/webp`, `hero4.webp`, `hero4-phone.webp` and `owner2.webp` are
  404, `/icon.svg` is 200, the page has one `<picture>` with `hero3-phone.webp 640w`, and no Magnific, Unsplash or Enugu text.

### Task 10: a hero like the reference site (2026-10-12)
Tests: `design-tokens.test.ts`, `HomeSections.test.tsx`, `HomePage.test.tsx`, `SiteHeader.test.tsx`, a button styles test. They
replace the tests about the dark-text sky hero, the overlapping photo, the Overview's extra room and How it works.
- [x] `design-tokens`: `sky` is `#1a7cad`; white on `sky` at least 4.5:1 (4.64), white on `pine-dark` (8.92) and on `forest` (5.61);
  the veil's worst case (`pine-dark` at 85% over white) with white at least 4.5:1 (6.02); `pine-dark` on white at least 4.5:1
- [x] `the hero has a gradient from sky to pine-dark (no flat colour)`, `is at least 85% of the screen high`, `all its text is white`,
  `the text is in the lower left`
- [x] `on a tablet and desktop the photo fills the right half, from top to bottom and to the edge, with a slanted clip-path, no
  rounded corners, and nothing below the hero`; `on a phone it is a band at the top with a slanted bottom edge, and the text is
  below it`; `the veil is behind the header links, decoration only`
- [x] `the hero button is the on-dark button: white with pine-dark text, still one button to /find`
- [x] `the Overview has the normal space and no extra room at the top`
- [x] `Benefits is a full-width forest band with white text and white icons`; `How it works is gone: no component, no config, no
  text`
- [x] `the page has the seven parts in order` (header, hero, Overview, Benefits, Browse by type, For facility owners, footer), four `h2`
- [x] `SiteHeader`: `on the home page it is transparent, over the hero (absolute, no background, no line) with white links`;
  `on every other page it is the forest bar with the accent line`; `SwiftRescue is red in both`; `Find care is still hidden on /`
- [x] The existing tests still pass (the whole suite, 632 tests; lint and typecheck clean).
- [x] Build (2026-10-12): `/` is static, 113 kB first load JS; the built page names only the three photos, has no "How it works", the
  header is `on-dark absolute inset-x-0 top-0 z-20 text-white`, and the CSS has the gradient, the veil and both `clip-path` rules.
- [x] CI and preview (2026-10-12, 163833e): Frontend CI passes (Backend CI did not run); the preview `/` is 200, its header is
  `on-dark absolute inset-x-0 top-0 z-20 text-white`, it has the gradient class and no "How it works".
- [ ] **For the owner, in a browser:** the look of the slanted edges and the veil at 320 px, 768 px and desktop width; the white
  header links over the photo; the gradient's deep and light sides. Not seen by me: the tests check classes and computed contrast,
  not pixels.

### Task 11: fixes after the review of the fourth revision (2026-10-12)
Tests: `HomePage.test.tsx`, `SiteFooter.test.tsx`, `HomeSections.test.tsx`, `design-tokens.test.ts`.
- [x] `the owners photo is 26 rem high from 768 px, whole (not cropped), with the text right beside it, both vertically centred, a
  2.5 rem gap, the text at most 36 rem wide`; `on a phone the photo is still the full width`
- [x] `SiteFooter`: `its links and its © line are inside the max-w-6xl px-4 container`; `on / it has no top margin and no line`;
  `on every other page it keeps the 4 rem gap and the line`
- [x] `the veil is 6 rem high, pine-dark at 80% down to 50%, then fades out; white on it over a pure white photo is at least 4.5:1
  (5.26)`; `the header's text zone (the first 3 rem) is inside the solid part`
- [x] `the hero's side-by-side layout starts at lg (1024 px): the photo box, the text column and the veil use lg: classes, not md:`;
  `up to 1023 px the photo is a band, 18 rem then 24 rem from 768 px, with the slanted bottom edge, and the text is full width`
- [x] `the heading has text-balance, 36 px, 48 px from 768 px and 60 px from 1024 px`
- [x] The existing tests still pass (the whole suite, 637 tests; lint and typecheck clean). The build: `/` is static, 113 kB first
  load JS; the built home footer is `text-base` (no margin, no line) and `/find`'s is `mt-16 border-t …`; the CSS has the new
  `lg:` and `md:h-96` and `md:h-[26rem]` rules.
- [x] CI and preview (2026-10-12, 2f86c17): Frontend CI passes (Backend CI did not run); the preview `/` is 200, its footer is
  `text-base` (no margin, no line), the heading has `text-balance`, the owners photo has `md:h-[26rem]`.
- [ ] **For the owner, in a browser:** the heading on a tablet (768 to 1023 px) and at 1024 px has no single word left alone on a
  line; the band on a tablet does not cut the stethoscope or the gauge; the veil looks gentle. Not seen by me (no browser here).

### Task 12: no forced tall hero below 1024 px (2026-10-12)
- [x] `the hero's minimum height of 85% of the screen is lg: only`: no `min-h-[85svh]` without `lg:`, none with `md:`
- [x] The whole suite still passes (637); the built page has `lg:min-h-[85svh]`; CI (f3cada1): Frontend CI passes, the preview `/` is
  200 and has `lg:min-h-[85svh]` and no plain `min-h-[85svh]`.
- [ ] **For the owner, in a browser:** on a tablet there is no large empty blue gap between the photo band and the heading.

### Task 15: a faster home page (2026-10-13)
Measured in headless Chromium (Playwright) on a production build, sizes as sent (compressed). Not ticked until the owner has checked the preview.

| | Before | After |
| --- | --- | --- |
| JavaScript downloaded by `/` (files, kB sent, compressed) | 12 files, 131.9 kB | **7 files, 111.9 kB** (-20.0 kB); 101 kB of it is the Next.js and React runtime |
| Requests at 375 px (all kinds) | 18 requests, 225.1 kB | **11 requests, 200.2 kB** |
| Requests at 768 px (all kinds) | 19 requests, 331.9 kB | **11 requests, 304.8 kB** |
| First Load JS shown by `next build` | 112 kB (page 6.49 kB, shared 103 kB) | 112 kB (page 6.49 kB, shared 103 kB): the figure does not count the prefetched chunks that were removed |
| Client code of the header and footer | one layout chunk of 4.5 kB with the header, footer, logo | only the Menu button (5.7 kB raw, 2.9 kB sent, with its two icons) |
| Hero photo, 320 and 375 px | `hero3-phone.webp` 44.7 kB only | unchanged: `hero3-phone.webp` 44.7 kB only (checked in the browser) |
| Hero photo, 768 and 1024 px | `hero3.webp` 149.3 kB only | unchanged: `hero3.webp` 149.3 kB only (checked in the browser) |
| Owners' photo, every width | `hero4-portrait.webp` 29.7 kB, fetched at load | unchanged: native `loading="lazy"` (the owner's decision); Chrome still starts it early on a short page |
| Other pages' code downloaded | `/find` and `/emergency` page chunks (prefetched) | none (checked in the browser; the same check fails on the old build) |
| Photos' cache header (preview) | `max-age=0, must-revalidate` | `public, max-age=31536000, immutable` in `netlify.toml` (to be checked on the preview) |
| `/_next/static` cache header (preview) | `max-age=31536000, immutable` | unchanged |
| Heading, line and button in the first HTML | yes | yes (checked on the server's answer) |
| First HTML | 34.7 kB raw, 7.4 kB sent | 44.1 kB raw, 8.0 kB sent: the page's own markup is the same (15.9 kB); the data embedded for hydration grew (18.8 to 28.2 kB) because server components' output is in it |
| Map, chart or search-map code on `/` | none | none |
| Fonts | system font stack, no web font | unchanged: nothing to block the text |
| Photo budgets | 149.0, 44.4 and 29.4 kB | unchanged: under 150, 50 and 100 kB, so not compressed again |

- [ ] `netlify.toml` sends the one-year `immutable` cache header for `/images/*` (unit test; then checked on the preview)
- [ ] Every link of the home page has `prefetch={false}`; the home page's scripts are only its own, the framework's and the Menu button's
- [ ] The header and the footer are server components; the route groups choose them; every URL is unchanged (the build's route list is
  the same as before); `/admin`, `/provider` and the not-found page still have the header and the footer
- [ ] The owners' photo is drawn without `next/image`; same file, size, alt text and `loading="lazy"`
- [ ] Real browser: one hero photo per width; lazy portrait; no other page's code; the first HTML has the heading and the button
- [ ] The whole suite, lint, typecheck, build and the real-browser spec pass
- [ ] **The owner checks the preview** (and runs Lighthouse again)

### Task 14: SwiftHealth Route, the new logo, the phone header (2026-10-13)
Tests: `brand.test.ts`, `Logo.test.tsx`, `icon.test.ts`, `SiteHeader.test.tsx`, `MobileMenu.test.tsx`, `design-tokens.test.ts`,
`SiteFooter.test.tsx`, `HomeSections.test.tsx`, and the real-browser `tests/end-to-end/home-layout.spec.ts`. Not ticked until the owner
has checked the preview.
- [ ] The name is only written in `config/brand.ts`; the footer, title, description, manifest, Overview text and logo read it
- [ ] `sky-pale` is `#dcf2fc` and passes 4.5:1 on `forest`, on the middle of the gradient and over the worst-case veil
- [ ] Logo: the pin with the heartbeat line in both tones; the wordmark "SwiftHealth" and "Route"; stacked below 640 px with a small
  letter-spaced ROUTE, one line from 640 px; one accessible name, "SwiftHealth Route"; no cross
- [ ] The favicon is the pin with the line only, the blue equals the `sky` token
- [ ] Menu is an icon-only button named Menu; SwiftRescue is smaller on a phone and has the siren (white, hidden from screen readers)
- [ ] Real browser: "SwiftHealth" and "Route" visible at 360 and 375 px; Menu fully inside the screen below 768 px; no sideways
  scroll at 320 px; the 1-pixel sweep
- [ ] The whole suite, lint, typecheck and build pass
- [ ] **The owner checks the preview** (the logo in the header, the footer, the tab icon, the phone header at 320, 360 and 375 px)

### Task 13: widths 320 to 1023 px (2026-10-12)
Tests: `HomeSections.test.tsx`, `SiteHeader.test.tsx`, `Logo.test.tsx`, and the real-browser `tests/end-to-end/home-layout.spec.ts`.
- [x] Real browser (Chromium 152 in the frontend container, 2026-10-12; first run against the old code failed at 320 and 375 px, the
  header's Menu button ended at 396 px; after the change 19 passed and 1 was skipped by design; a 1-pixel sweep from 320 to 1100 px
  found no header item outside the screen and no sideways scrolling), at 320, 375, 600, 768, 900 and 1024 px: `the page does not scroll sideways`; `every line of the heading is inside
  the screen, and wrapped below 1024 px`; `the logo, SwiftRescue and the links or the Menu button are inside the screen`; `the heading
  and Find care near me are on the first screen`; and a sweep of every 4th width from 320 to 1100 px
- [x] Unit: the band is `h-64` and `md:h-72`; the text row is a flex row only from `lg:`; the column is `w-full min-w-0`; the heading
  has `break-words`; the header is compact on a phone; below 400 px the logo word is `sr-only` and the link is still named SwiftHealth
- [x] The whole suite still passes (640 tests; two earlier full runs each had one unrelated timing failure, `AreaSelect` and
  `SearchPage`, which passed alone and on the next full run: the known load flake, seen while the machine was busy); lint and
  typecheck are clean; the build is static (`/` 113 kB first load JS)
- [x] CI and preview (2026-10-12, 6f7d5a6): Frontend CI passes (Backend CI did not run); the preview `/` is 200 and has
  `max-[399px]:sr-only`, `h-64 shrink-0` and `break-words`. The real-browser spec is not part of the pull request check (no browser there).
- [ ] **For the owner:** if the heading is still cut off or the header links are missing at 768 px, say which browser, system and
  window size: it could not be reproduced in Chromium 152 (the 768 px page was correct there before this change).

## Review-focus edge cases

Checked by the tests and by the build (2026-10-11; the hero details changed on 2026-10-12, see Tasks 7, 8 and 9):
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
- [x] The home page has no outside link at all since 2026-10-12 (the Magnific credit was removed with the Magnific photos): the
  built page has no `href="http…"`, and a test checks the page and the footer.
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
- [ ] The words match the brief (and the page says no city anywhere); the alt texts are right for the two new photos; the footer
  has the six links and the copyright line only (no photo credit).
- [ ] The two new photos look right, cut to 4:3 (the hero shows the face and the blister pack, the owner photo the person and the
  hands on the counter), and neither is blurry or over-compressed. `hero4-phone.webp` is the only hero file a phone requests.
- [ ] `/emergency`: the red Call 112 button, the line about the list and the FR-26 sentence; the button opens the dialler on a phone.
- [ ] Other pages (`/find`, `/search`) still look right with the new header and footer.

## Merge checklist

- [x] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` are clean (2026-10-12, on `1f1cdcc`): lint and
  typecheck clean, 591 tests passing, the build passes. `/` is static: 6.5 kB, 113 kB first load JS (it was dynamic, 103 kB);
  `/emergency` is 105 kB. The built page names three image files only (`hero`, `hero-phone`, `owner`), has no image preload, and
  no city word.
- [x] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run. What `gh pr checks 21` showed
  (2026-10-11, after `83db4c4`): `frontend` **pass** (1m37s, run 38181298116); the only workflow run on the branch is Frontend
  CI (no Backend CI run); Netlify `Header rules` and `Redirect rules` pass, `Pages changed` skipping, `deploy-preview` pass:
  <https://deploy-preview-21--swifthealth-ng.netlify.app>. The preview answers 200 on `/` and `/emergency`, and serves
  `hero-phone.webp`, `hero.webp` and `hero2.webp` as `image/webp`; its `<picture>` has the phone-only `<source>`.
- [x] `git diff --stat origin/main -- backend` is empty (2026-10-11).
- [x] After the simplified page (2026-10-12, after `d57c5ed`): `gh pr checks 21` again showed `frontend` **pass** (1m40s, run
  38188077214) and a `deploy-preview` pass. The preview answers 200 on `/` and `/emergency`, serves `hero-phone.webp`,
  `hero.webp` and `owner.webp` as `image/webp`, answers 404 for `hero2.webp`, and its home page has no "Enugu", no "Open
  SwiftRescue" and no "every second counts" (the only "emergency help" is the words of the hero line).
- [x] After the new photos (2026-10-12, after `ef7da5e`): `gh pr checks 21` showed `frontend` **pass** (1m39s, run 38191153187)
  and a `deploy-preview` pass. The preview serves `hero4-phone.webp` (11.7 kB), `hero4.webp` (32.8 kB) and `owner2.webp` (38.6 kB)
  as `image/webp`, answers 404 for the old `hero.webp`, `hero-phone.webp` and `owner.webp`, and its home page has no `href="http…"`
  link, no "Magnific", no "Unsplash" and no "Enugu"; its `<picture>` has the phone-only source `hero4-phone.webp 640w`.
- [x] The UI spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The smoke test above is done on the preview.
- [ ] The pull request stays a draft until every box above is ticked.

Note: this branch also carries `dc8685c` (the 6a "done" docs, a docs-only commit that was not yet on `main`), so the pull request
shows it too. One run of the full suite had a single failure in `NearbySuggestions.test.tsx` that passed when run alone and in
the next full run (a timing flake under load, not a change of this feature).
