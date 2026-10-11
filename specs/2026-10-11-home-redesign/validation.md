# Home page redesign (phase 13a, pulled forward): validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves US-13, NFR-01, FR-02, NFR-04, NFR-10, NFR-07 or NFR-12. Tick a box only after the
test exists and passes.

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

### Task 1: `tests/unit/homeImages.test.ts`
- [ ] `every photo of the page exists as a .webp in public/images/home`
- [ ] `no file in the folder is missing from config/home.ts`, and `no original JPG or PNG is in public/`
- [ ] `hero and hero2 are under 150 kB; hero-phone under 50 kB and 640 px wide; the five category photos and the ambulance and
  fire photos under 60 kB; owner under 80 kB`
- [ ] `every photo has alt text, a fixed width and a fixed height in config/home.ts`
- [ ] `image-sources/ is git-ignored`

### Task 2: `tests/unit/SiteHeader.test.tsx`, `MobileMenu.test.tsx`, `SiteFooter.test.tsx`
- [ ] `the header has the SwiftHealth wordmark to /, Find care to /find, SwiftRescue to /emergency and For facilities to
  /list-your-facility`
- [ ] `SwiftRescue is red (emergency colour), and it is not inside the phone menu, so it is always in the bar` (FR-02)
- [ ] `the Menu button has a word and a decorative icon, is at least 48 px, and says aria-expanded false then true`
- [ ] `the menu panel holds Find care and For facilities, opens with the button, closes with the button and with Escape, and
  returns focus to the button`
- [ ] `every link and button of the header is at least 48 px high`
- [ ] `the header keeps the forest background, the accent line and on-dark (the light focus ring)`
- [ ] `the footer keeps its six links in the same order`
- [ ] `the footer credit says "Images designed by Magnific", links to https://www.magnific.com, opens in a new tab with
  rel="noopener noreferrer", and there is no Unsplash text`
- [ ] `the footer ends with "© 2026 SwiftHealth", and the year comes from siteConfig`

### Task 3: `tests/unit/HomePage.test.tsx` (parts 2 to 5)
- [ ] `the hero has one h1 with the exact heading, the exact line, and the exact small line`
- [ ] `Find care near me is a white button to /find and Emergency help is a red button to /emergency`
- [ ] `the hero is one picture: a source for up to 767 px with srcset "hero-phone.webp 640w" and sizes "100vw", and an img of
  hero.webp with width, height, alt text, eager loading and high fetch priority`
- [ ] `no image of the page uses priority, so no preload link is made for a big file; hero2 is lazy, inside a box that is hidden
  below 768 px, and is in no source and no preload`
- [ ] `the phone hero has a pine-dark overlay of 80% or more, and white text on a white photo under it is at least 4.5:1`
- [ ] `how it works has three steps with the exact words, each with a decorative icon and a number`
- [ ] `browse by type has five cards in order, each one link to /search?category=<slug>, each with a photo with alt text and a label`
- [ ] `why SwiftHealth has four items with the exact titles and a decorative icon each`

### Task 4: `tests/unit/HomePage.test.tsx` (the whole page), `layout` metadata
- [ ] `the rescue band has the ambulance and fire photos, the heading, and a red Open SwiftRescue to /emergency`
- [ ] `the facility part has the owner photo, the heading, the text and List your facility to /list-your-facility`
- [ ] `the about part has the exact heading and text`
- [ ] `the page has the 9 parts in the owner's order` (header, hero, how, browse, why, band, facilities, about, footer)
- [ ] `the page makes no API call and is a server component without async data` (no `getHealth`, no `fetch`)
- [ ] `no text says Enugu only or only in Enugu, and the city name comes from siteConfig`; `the page description says the same`
- [ ] `the page has no percent sign and no number other than the step numbers and the year` (no invented statistics)
- [ ] `every img has alt text, a width and a height; there is no img without them`
- [ ] `the emergency colour is used only by the header button, Emergency help and Open SwiftRescue`
- [ ] The existing tests still pass (`design-tokens.test.ts` checks that no hex colour, no text under 16 px and no accent
  background is in the new files).

### Task 5: `tests/unit/EmergencyPage.test.tsx`
- [ ] `the emergency page has one h1, SwiftRescue`
- [ ] `Call 112 is a link to exactly tel:112, in the emergency colour with white text, at least 48 px high and large, with an
  accessible name that says it calls 112`
- [ ] `the page has the exact line about the full list coming soon`
- [ ] `the page has nothing else: no other link, no list, no advice, no Coming soon heading, nothing sponsored`
- [ ] `the page is a server page and makes no request`

## Review-focus edge cases

- [ ] **320 px.** No sideways scrolling; the buttons stack; the header bar (wordmark, SwiftRescue, Menu) fits.
- [ ] **A very long word or large text size.** The headings wrap; nothing is cut off.
- [ ] **Phone: only the small hero.** At 360 px wide, with the cache off, the Network panel shows a request for
  `hero-phone.webp` (about 50 kB) and none for `hero.webp` or `hero2`; at 1280 px it shows `hero.webp` and `hero2` and not
  `hero-phone.webp`. Checked on a high-density phone too (it must still take the small file).
- [ ] **The 112 source.** The sources of decision 18 are real NCC pages (checked on 2026-10-11); the page makes no promise
  about the answer. The owner decides whether the FR-26 sentence is added.
- [ ] **A call from a phone.** On a real phone, "Call 112" opens the dialler with 112 filled in. The owner does NOT place the
  call to test it.
- [ ] **First load under 500 KB.** At 360 px, cache off, before scrolling, the total transferred is under 500 KB; the other photos
  load only when scrolled near.
- [ ] **The hero photo is the largest contentful element** and has `priority` (it is preloaded).
- [ ] **Keyboard.** Tab goes through the header, the menu panel, the hero buttons, the cards and the footer in reading order; the
  focus ring is visible on the dark header, the photo overlay and the white background.
- [ ] **Screen reader.** One `h1`, then `h2`s; each card is one link with its label; icons are hidden; the photos have alt text.
- [ ] **Links that lead to "Coming soon".** `/list-your-facility` and `/about` still say "Coming soon" (decision 4);
  `/emergency` has the minimal page. The owner knows; nothing here hides it.

## Security checklist

- [ ] No new package: `git diff origin/main -- frontend/package.json frontend/package-lock.json` is empty.
- [ ] No `dangerouslySetInnerHTML`; all text is rendered as text.
- [ ] The only outside link is the Magnific credit: `target="_blank"` with `rel="noopener noreferrer"`.
- [ ] All photos are local files (no outside image address), so no tracking request leaves the page.
- [ ] No original photo (60 MB), no secret, no `.env` change is committed.
- [ ] The page keeps no personal data and makes no request to the API.

## Smoke test (owner, on the Netlify preview)

- [ ] Phone (a real phone): the hero is one photo behind the text, readable; no second hero photo; the menu opens and closes;
  SwiftRescue is always visible; every button and card goes to the right place; nothing scrolls sideways.
- [ ] Laptop at 1280 px: the two hero photos overlap as a pair; the cards in one row; the header shows all four links.
- [ ] Laptop with DevTools at 360 px, Network, cache off, throttled to 3G: the first load is under 500 KB, there is no `hero2`
  request, and the other photos load while scrolling.
- [ ] The words match the brief; the alt texts are right for each photo (the owner reviews them); the Magnific credit is in the footer.
- [ ] The photos look right: the crops (especially the hospital card), and none is blurry or over-compressed.
- [ ] Other pages (`/find`, `/search`) still look right with the new header and footer.

## Merge checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` are clean. Record the numbers: _(fill in)_.
- [ ] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run. Write what `gh pr checks` shows:
  _(fill in)_.
- [ ] `git diff --stat origin/main -- backend` is empty.
- [ ] The UI spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The smoke test above is done on the preview.
- [ ] The pull request stays a draft until every box above is ticked.

Note: this branch also carries `dc8685c` (the 6a "done" docs, a docs-only commit that was not yet on `main`), so the pull request
shows it too.
