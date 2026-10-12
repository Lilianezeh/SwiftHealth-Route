# Home page redesign (phase 13a, pulled forward): requirements

What the new home page (`/`), the site header and the footer must do, and the decisions behind them. How we build it is in
[plan.md](plan.md); how we know it is done is in [validation.md](validation.md). Frontend only. The owner asked for it on
2026-10-11 and will review it on the Netlify preview.

## Requirements

- **US-13** ([prd.md](../prd.md)) and **NFR-01:** the home page loads fast on a 3G phone. First page weight stays under 500 KB:
  only the hero photo is part of the first load, every other photo loads when it is near the screen.
- **FR-02:** the red SwiftRescue button stays visible on every page, in the header, on phones too.
- **FR-14:** the national emergency number, 112, is shown first and always. This feature adds a minimal `/emergency` page with a
  large red "Call 112" button, because three red buttons of the home page lead there (decision 18). The full page is phase 7.
- **NFR-04:** works on cheap Android phones and iPhone Safari, from 320 px wide, with no sideways scrolling.
- **NFR-10:** 48 px tap targets, 16 px text (also the "small" line), good contrast (white text on the photo overlay is at least
  4.5:1 whatever the photo), alt text on every image, a keyboard and screen reader can use the whole page and the menu.
- **NFR-07:** what the page says about location ("Your location stays private") is true: SwiftHealth keeps the position in the
  browser tab only and sends it only to the search (UI spec 2.3).
- **NFR-12:** a clear, single `h1` and a page description, so the home page reads well in a search result.

Source of truth: [ui-spec.md](../frontend/ui-spec.md) (global layout, and 2.1, rewritten by this feature), [prd.md](../prd.md).
Branch: `feature/home-redesign`. Every commit and test references these IDs.

Fit with the project: [mission.md](../mission.md) wants residents to find open care quickly; the home page is the first thing
a resident, a partner or a facility owner sees. [tech-stack.md](../tech-stack.md) is unchanged: Next.js, Tailwind, `next/image`,
`lucide-react` (already installed). No new package, no animation, no backend change.

## In scope

- The home page `/` with 9 parts, in this order: header, hero, how it works, browse by type, why SwiftHealth, the SwiftRescue
  band, for facility owners, about, footer (the exact words are in [ui-spec.md](../frontend/ui-spec.md), section 2.1).
- The site header and footer, for every page, because they live in the root layout: a new header (logo, Find care, SwiftRescue,
  For facilities, and a menu button on phones) and a footer with the photo credit and the copyright line.
- Ten photos from the owner's `IMAGES` folder, converted to WebP and compressed for 3G, served with `next/image` at fixed sizes,
  with alt text; plus a smaller phone version of the hero photo (decision 19).
- A minimal `/emergency` page: a large red "Call 112" button and one line (decision 18). It replaces the "Coming soon" text and
  nothing more.
- A small script that makes the WebP files, so the work can be repeated.
- The wording must work for the whole of Nigeria: the first city is named once, in one place, never as "Enugu only".

## Out of scope (planned elsewhere)

- The full SwiftRescue page (the verified lists, share my location, share the list, offline use, the FR-26 disclaimer):
  phase 7. The pages `/list-your-facility` (phase 10) and `/about` (phase 13b) are "Coming soon" pages today. See decision 4.
- Pictures on `/emergency` (the ambulance and fire photos there): phase 7. `LOG.md` keeps that reminder.
- The listing page (phase 6b) and its new Directions icon: their own feature, on its own branch.
- A real logo file: none exists, so the logo is the word SwiftHealth (decision 2).
- Pricing, "the problem" and "how we verify" parts of the old landing outline: dropped from the home page (decision 5).
- Server-side health check of the API on the home page: removed (decision 6).
- Dark mode, animation, a slideshow, a carousel, testimonials, statistics: none, on purpose.

## Revision, 2026-10-12: simpler, after the owner's review of the preview

The owner looked at the preview of pull request #21 and asked for a simpler page. Where this section and a decision below
disagree, **this section wins**. The decisions below keep their text, with a note where they are replaced.

- **R1. Two photos only** *(the photos and file names were replaced by R8 on 2026-10-12)*: `hero.jpg` (the hero) and `owner.jpg`
  (the facility owners part). The other eight photos are deleted
  from `public/images/home/`: `hero2`, `hospital`, `clinic`, `maternity`, `pharmacy`, `laboratory`, `ambulance`, `fire`. The
  small phone version of the hero (`hero-phone.webp`, decision 19, the owner's earlier addition) stays, so three files remain.
  Images table (replaces the table of decision 8): `hero.webp` 1280 × 853 under 150 kB, `hero-phone.webp` 640 × 427 under 50 kB,
  `owner.webp` 800 × 533 under 80 kB.
- **R2. Browse by type is icon tiles,** not photo cards: a `lucide` icon (`Hospital`, `Stethoscope`, `Baby`, `Pill`,
  `FlaskConical`) in a light blue circle over the label, the whole tile one link to the search for its category (replaces
  decision 16).
- **R3. The SwiftRescue photo band and the About part are removed completely.** The page has seven parts: header, hero, how it
  works, browse by type, why SwiftHealth, for facility owners, footer. The way to SwiftRescue on the home page is the red
  button of the header, which is on every page (FR-02).
- **R4. The hero:** a lighter blue background (`pine-100`), one large photo, no second photo and no overlay. On a desktop (768 px
  and up) the text is on the left and the photo on the right; on a phone the photo is below the text. In both the photo
  **overlaps the bottom edge of the hero into the next section** (replaces the layout of decision 9). The text is dark blue
  (`pine-dark`, 7.4:1 on `pine-100`; `ink-soft` 5.8:1 for the small line), because white would be 1.2:1 on this blue (computed
  on 2026-10-12). The hero button is the primary blue one (white text on `forest` is 5.6:1).
- **R5. The hero has one button, "Find care near me",** and the small line "Free to use · No sign-up needed". The red "Emergency
  help" button is removed. Red now appears on the home page only in the header's SwiftRescue button (replaces decision 10 for
  this page; the "Call 112" button of `/emergency` stays red).
- **R6. No city is named on the home page or in its page description** (replaces decision 13). The hero line is "Hospitals,
  pharmacies and emergency help, open near you." `siteConfig.launchCity` stays in `config/site.ts`, because other parts of the
  app may use it (owner, 2026-10-12); the home page does not.
- **R7. Footer unchanged:** "Images designed by Magnific" is still true for the two photos (decision 14).
  *(Replaced by R10 on 2026-10-12: the Magnific photos are gone, so the credit is removed.)*

### Second revision, 2026-10-12: new photos

The owner added two Unsplash photos to the `IMAGES` folder (`hero4.jpg`, `owner2.jpg`; `hero3.jpg` is not used for now) and asked
to replace the two photos of the page. Where this section and R1 to R7 disagree, this section wins.

- **R8. The photos are replaced.** `hero4.jpg` is the hero on every screen size: a big version for tablets and desktops and a
  smaller one of 640 px for phones, so a phone downloads only the small one (decision 19 stays: one `<picture>` with a phone-only
  `<source>`). `owner2.jpg` replaces the owner photo. The old files `hero.webp`, `hero-phone.webp` and `owner.webp` are deleted.
  The new files are `hero4.webp`, `hero4-phone.webp` and `owner2.webp` (new names, so nothing can serve an old photo from a cache).
- **R9. The shape and the sizes.** Both new photos are portrait (hero4 is 4160 × 6240, owner2 is 2700 × 3779), and the layout is the
  same as before, with the same overlap. A portrait photo in the right-hand column would make the hero very tall, so each is cut
  to a 4:3 band by hand (the head, and for the hero the blister pack too, stay in the picture; the crop is checked by eye on the
  converted files). Sizes and budgets (replace the table of R1): `hero4.webp` 1280 × 960 under 150 kB, `hero4-phone.webp` 640 ×
  480 under 50 kB, `owner2.webp` 800 × 600 under 80 kB. They are converted the same way as before (WebP, quality lowered until
  the budget is met). The alt text is written after looking at each converted photo.
- **R10. The photo credit is removed from the footer.** No Magnific photo remains, and the owner states that Unsplash photos need
  no attribution, so the footer has the six links and "© 2026 SwiftHealth" only, with no outside link. (This record repeats the
  owner's statement; it does not state what the Unsplash licence says. `LOG.md` has a reminder to keep the photo pages and to
  check the licence terms with the legal review, NFR-13.) This replaces R7 and decisions 14 and 17.

### Third revision, 2026-10-12: other photos, a sky blue hero, an Overview, a logo

The owner asked again (all photos are from Unsplash and, the owner states, need no attribution). Where this section and R1 to R10
disagree, this section wins.

- **R11. The photos change again.** The hero is `hero3.jpg` (a stethoscope and a blood pressure gauge, portrait 4000 × 6016) on every
  screen size, with a small phone version of 640 px. The facility owners part uses `hero4.jpg` (a smiling health worker holding a
  blister pack, portrait 4160 × 6240), shown whole. `owner2` is no longer used. New files: `hero3.webp`, `hero3-phone.webp` and
  `hero4-portrait.webp` (a new name, because `hero4.webp` already existed with other content). Deleted: `hero4.webp`,
  `hero4-phone.webp`, `owner2.webp`. Sizes and budgets (replace R9): `hero3.webp` 1200 × 1200 under 150 kB, `hero3-phone.webp`
  640 × 640 under 50 kB (a square, cut by hand from the portrait so that both the stethoscope head and the whole gauge stay in the
  picture), `hero4-portrait.webp` 800 × 1200 under 100 kB (the whole photo, 2:3, no crop; the budget is 100 kB, not 80, because a
  whole portrait has more pixels; it is lazy, so it does not count in the first load).
- **R12. The hero layout.** *Tablet and desktop (768 px and up):* the text is on the left, inside the page width; the photo covers
  the right half of the hero, from the top of the hero to the right edge of the screen, rounded on its left side, and goes about
  6 rem below the hero's bottom edge, over the next section. *Phone:* the photo is below the text, the full width of the screen, and
  the hero's edge is pulled up over it. The Overview part, which comes next, has the room at its top.
- **R13. A new colour token, `sky` (`#A9DDF3`),** is the hero background (the owner wanted a real sky blue, not `pine-100`, and
  suggested this value). Computed on 2026-10-12: `pine-dark` text on it is 6.08:1 (needs 4.5), `ink-soft` 4.82:1, `ink` 10.80:1,
  the forest focus ring and the forest button edge 3.83:1 (need 3), white 1.47:1. It passes as suggested, so it is not adjusted.
  All hero text is `pine-dark`. The token is added to `globals.css`, the UI spec table and the token tests.
- **R14. "Find care" is hidden in the header on the home page only,** in the bar and in the phone menu (the hero button does the
  same). It stays on every other page. The header reads the address in a small client part (`HeaderNavigation`), so the layout
  itself stays a server component.
- **R15. An Overview part right after the hero** with the owner's words ("SwiftHealth helps you find hospitals, clinics, pharmacies,
  labs and emergency contacts that are open right now. Every listing is checked by our team, so the number you call and the hours
  you see are ones you can trust."), and "Why SwiftHealth" is renamed **"Benefits"**. The page has eight parts. The sentence about
  the team checking every listing is a promise about verification (US-07, FR-32): it is the owner's wording and matches how the
  product is meant to work.
- **R16. A simple logo.** A map pin with a white plus inside, an inline SVG, next to the word SwiftHealth, in the header; the pin
  alone is the favicon. No red cross. The pin has the shape of the pins of the results map. In the header it is the bright blue
  `accent` with a white plus and a thin white edge (a `forest` pin would vanish on the `forest` header); the favicon (`src/app/
  icon.svg`, which Next.js serves as the tab icon) is `forest` blue with a white plus, with the colour written in the file because
  a favicon cannot read a CSS variable (a test checks that it equals the `forest` token).
- **R17. The owners photo is whole.** `hero4-portrait.webp` is never cropped or stretched: full width on a phone; beside the text on
  a tablet and desktop with a maximum height of 32 rem (it gets narrower to keep its shape).

## Decisions

Decisions 1 to 4 and 7 are my defaults for questions the owner's brief left open; the owner can change any of them on review.
Decisions 8 onward follow the owner's brief (2026-10-11).

1. **The new header and footer are for every page,** not only the home page. They live in the root layout, and FR-02 asks for
   the red button on every page. The logo now links to `/` (it linked to `/find`).
2. **The logo is a text wordmark, "SwiftHealth".** There is no logo file. The rule "no invented things" applies: no made-up
   symbol. When a real logo exists it replaces the word in one place.
3. **On a phone the red SwiftRescue button stays in the bar** beside the menu button (FR-02). The menu button opens a panel with
   Find care and For facilities. From tablet width up, all links are in the bar.
4. **A known risk, now reduced (owner's addition, 2026-10-11):** "Emergency help", "Open SwiftRescue" and the header button lead
   to `/emergency`, which said "Coming soon" until phase 7. This feature replaces that with the minimal page of decision 18. The
   pages `/list-your-facility` and `/about` still say "Coming soon", which is not a danger.
5. **Dropped from the home page:** the old outline had "the problem", "how we verify", "who it's for" and "pricing". The new
   page follows the owner's 9 parts. The featured-listing price (₦5,000, a placeholder) belongs on the facility page (phases
   10 and 12). The UI spec 2.1 is rewritten.
6. **The home page is fully static.** The old page called the API for a status line. That line is removed, so the page never
   waits for a sleeping API and is served as static content. `getHealth` stays in `lib/api/client.ts` with its test.
7. **Photos are `next/image` with `unoptimized`:** the files are already the final size and format, so they are served as they
   are from the CDN, with no image service in between and no second compression. Every image has `width`, `height` and alt text
   (a small `HomePhoto` component makes the alt text required by its types). Every image is lazy except the hero, which is
   loaded at once (see decision 19: it does not use `priority`, so a phone does not preload the big file).
8. *(The table below is replaced by R1 on 2026-10-12: three files remain.)* **The images are made by a script** (`frontend/scripts/optimize-home-images.mjs`) that uses `sharp`, the image library that
   Next.js already installs; it is not added to `package.json`. The full-size originals (60 MB) are not committed: they go in
   `frontend/image-sources/`, which is git-ignored. The script lowers the quality step by step until each file is under its
   budget.

   | Image | Pixels (fixed) | Budget |
   | --- | --- | --- |
   | `hero.webp` | 1280 × 853 | 150 kB |
   | `hero-phone.webp` (the same photo, for phones) | 640 × 427 | 50 kB (owner's addition) |
   | `hero2.webp` | 960 × 640 | 150 kB |
   | `hospital`, `clinic`, `maternity`, `pharmacy`, `laboratory` | 640 × 480 | 60 kB each |
   | `ambulance`, `fire` | 640 × 427 | 60 kB each (my choice) |
   | `owner.webp` | 800 × 533 | 80 kB (my choice) |

   `hospital.jpg` is a portrait photo, so its card is cropped to 4:3; the crop is checked by eye on the converted file.
9. *(Replaced by R4 on 2026-10-12: the phone photo is now below the text, with no overlay, and there is no second photo.)*
   **Phones get one hero photo, behind the text,** under a dark blue overlay (`pine-dark` at 80% or more, so white text is at
   least 4.5:1 on any photo). From tablet width up the text is on the left and the two photos on the right, as an overlapping
   pair: `hero.webp` large and `hero2.webp` smaller, in front, with rounded corners. `hero2` is a lazy image inside a box that
   is `hidden` on phones: a browser does not fetch a lazy image that is not shown. This is checked in the Network panel at phone
   width, and on a phone. If a browser ever fetched it anyway, the fallback is to draw that one image from a small client
   component only when the screen is wide.
10. *(Narrowed by R5 on 2026-10-12: on the home page red is only the header's button.)* **Red only for emergency:** the header's SwiftRescue button, the hero's "Emergency help", the band's "Open SwiftRescue" and
    the "Call 112" button of the emergency page. Nowhere else. A test scans for the `emergency` colour.
11. **Blue palette and the current font stack** (the system font; no web font), tokens only: no hex or rgb colour in code.
12. **No invented numbers or quotes.** The page says only what the product does. A test fails if the page text has a percent sign
    or a number other than the step numbers and the year.
13. *(Replaced by R6 on 2026-10-12: the home page names no city.)* **The city is named once, in one place** (`siteConfig`), and used in the hero line and the About text, written as "Now live
    in Enugu, with more cities coming" and "Starting in Enugu. Growing across Nigeria." No text says "Enugu only" or "only in
    Enugu"; a test checks it. The site description in the page head says the same.
14. *(Replaced by R10 on 2026-10-12: no photo credit.)* **Footer:** the existing six links, then "Images designed by Magnific" (a link to https://www.magnific.com that opens in a
    new tab with `rel="noopener noreferrer"`), then "© 2026 SwiftHealth". The owner confirmed on 2026-10-11 that all ten photos,
    including the laboratory one, are from Magnific's free collection, so the Unsplash line is dropped. The year is a constant
    in `siteConfig`, not read from the clock.
15. **Alt text is written after looking at each converted photo:** short, factual, no medical claim. The owner reviews it on the
    preview. Every photo is informative, so none has an empty alt.
16. *(The cards are icon tiles since R2, 2026-10-12; the links are unchanged.)* **The category cards link to the search** filtered by the category slug the seed already uses: `/search?category=hospital`,
    `clinic`, `maternity`, `pharmacy`, `laboratory`. The whole card is one link.
17. *(Replaced by R10 on 2026-10-12: the reminder is now about the Unsplash photos.)* **Reminder for launch:** keep proof of the Magnific free downloads, and check the attribution wording against Magnific's own
    licence terms (`LOG.md`, a legal check with NFR-13). This spec does not state what the licence allows.
18. **A minimal `/emergency` page (owner's addition, 2026-10-11).** A page with the heading "SwiftRescue", a large red **Call
    112** button (`tel:112`), the line **"Our full list of verified ambulance, fire and hospital emergency numbers is coming
    soon."** and the sentence of FR-26 (below). Nothing else: no advice, no list, no map. It replaces the "Coming soon" page of phase 0 and is replaced by the full
    page in phase 7.
    - **Source for 112 (checked on 2026-10-11):** the NCC (the Nigerian Communications Commission) says it on its own pages: "a
      dedicated toll-free Emergency Number, 112"
      ([press statement of 23 April 2021, which also commissioned the centre in Enugu](https://www.ncc.gov.ng/media-centre/press-releases/press-statement-minister-commissions-nccs-emergency-communication);
      [the NCC page on its Emergency Communication Centres](https://ncc.gov.ng/node/3132)), and calls it "NCC's 112 National
      Emergency Number"
      ([press release](https://ncc.gov.ng/media-centre/press-releases/covid-19-nccs-112-national-emergency-number-offers-succour-nigerians)).
      The PRD already says it (FR-14). The NCC pages say the centres are being built state by state and cover all 36 states and
      the FCT as a goal, so the page promises nothing about the answer, and the button says only "Call 112".
    - **The sentence of FR-26 (added at the owner's request, 2026-10-11):** the PRD asks the SwiftRescue page to say
      "SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In danger, call
      112." The minimal page first had only the button and the line about the list; the owner then asked for this sentence too,
      so the page has the heading, the button, the line about the list and this sentence, in that order, always visible.
19. **A smaller hero for phones (owner's addition, 2026-10-11).** The hero is one `<picture>`. Its `<source>` for screens up to
    767 px wide has `srcset="hero-phone.webp 640w"` and `sizes="100vw"` (about 50 kB); the `<img>` inside it is `hero.webp`
    (1280 px) for wider screens. The `<source>` has only one candidate and a `media` rule, so every phone-width screen takes the
    small file, whatever its pixel density: a plain two-file `srcset` with `sizes` lets a high-density phone choose the big file,
    which would defeat the purpose. The tag is made with `getImageProps` from `next/image` (Next.js's own way to do this), with
    fixed width and height and alt text. The hero is not given `priority`, because that would also ask every phone to preload the
    big file; it has `loading="eager"` and `fetchPriority="high"`, and it is in the first HTML, so the browser finds it at once.
    A phone then downloads `hero-phone.webp` only (not `hero.webp`, not `hero2.webp`), checked in the Network panel.
