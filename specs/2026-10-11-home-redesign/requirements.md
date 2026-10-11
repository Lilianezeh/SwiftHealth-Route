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
8. **The images are made by a script** (`frontend/scripts/optimize-home-images.mjs`) that uses `sharp`, the image library that
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
9. **Phones get one hero photo, behind the text,** under a dark blue overlay (`pine-dark` at 80% or more, so white text is at
   least 4.5:1 on any photo). From tablet width up the text is on the left and the two photos on the right, as an overlapping
   pair: `hero.webp` large and `hero2.webp` smaller, in front, with rounded corners. `hero2` is a lazy image inside a box that
   is `hidden` on phones: a browser does not fetch a lazy image that is not shown. This is checked in the Network panel at phone
   width, and on a phone. If a browser ever fetched it anyway, the fallback is to draw that one image from a small client
   component only when the screen is wide.
10. **Red only for emergency:** the header's SwiftRescue button, the hero's "Emergency help", the band's "Open SwiftRescue" and
    the "Call 112" button of the emergency page. Nowhere else. A test scans for the `emergency` colour.
11. **Blue palette and the current font stack** (the system font; no web font), tokens only: no hex or rgb colour in code.
12. **No invented numbers or quotes.** The page says only what the product does. A test fails if the page text has a percent sign
    or a number other than the step numbers and the year.
13. **The city is named once, in one place** (`siteConfig`), and used in the hero line and the About text, written as "Now live
    in Enugu, with more cities coming" and "Starting in Enugu. Growing across Nigeria." No text says "Enugu only" or "only in
    Enugu"; a test checks it. The site description in the page head says the same.
14. **Footer:** the existing six links, then "Images designed by Magnific" (a link to https://www.magnific.com that opens in a
    new tab with `rel="noopener noreferrer"`), then "© 2026 SwiftHealth". The owner confirmed on 2026-10-11 that all ten photos,
    including the laboratory one, are from Magnific's free collection, so the Unsplash line is dropped. The year is a constant
    in `siteConfig`, not read from the clock.
15. **Alt text is written after looking at each converted photo:** short, factual, no medical claim. The owner reviews it on the
    preview. Every photo is informative, so none has an empty alt.
16. **The category cards link to the search** filtered by the category slug the seed already uses: `/search?category=hospital`,
    `clinic`, `maternity`, `pharmacy`, `laboratory`. The whole card is one link.
17. **Reminder for launch:** keep proof of the Magnific free downloads, and check the attribution wording against Magnific's own
    licence terms (`LOG.md`, a legal check with NFR-13). This spec does not state what the licence allows.
18. **A minimal `/emergency` page (owner's addition, 2026-10-11).** A page with the heading "SwiftRescue", a large red **Call
    112** button (`tel:112`) and the line **"Our full list of verified ambulance, fire and hospital emergency numbers is coming
    soon."** Nothing else: no advice, no list, no map. It replaces the "Coming soon" page of phase 0 and is replaced by the full
    page in phase 7.
    - **Source for 112 (checked on 2026-10-11):** the NCC (the Nigerian Communications Commission) says it on its own pages: "a
      dedicated toll-free Emergency Number, 112"
      ([press statement of 23 April 2021, which also commissioned the centre in Enugu](https://www.ncc.gov.ng/media-centre/press-releases/press-statement-minister-commissions-nccs-emergency-communication);
      [the NCC page on its Emergency Communication Centres](https://ncc.gov.ng/node/3132)), and calls it "NCC's 112 National
      Emergency Number"
      ([press release](https://ncc.gov.ng/media-centre/press-releases/covid-19-nccs-112-national-emergency-number-offers-succour-nigerians)).
      The PRD already says it (FR-14). The NCC pages say the centres are being built state by state and cover all 36 states and
      the FCT as a goal, so the page promises nothing about the answer, and the button says only "Call 112".
    - **A question for the owner:** the PRD (FR-26) asks the SwiftRescue page to say "SwiftRescue connects you to emergency
      contacts; it does not dispatch or guarantee an emergency response. In danger, call 112." The owner chose the two elements
      above, so this minimal page does not have that sentence (default). Adding it is one line and one test.
19. **A smaller hero for phones (owner's addition, 2026-10-11).** The hero is one `<picture>`. Its `<source>` for screens up to
    767 px wide has `srcset="hero-phone.webp 640w"` and `sizes="100vw"` (about 50 kB); the `<img>` inside it is `hero.webp`
    (1280 px) for wider screens. The `<source>` has only one candidate and a `media` rule, so every phone-width screen takes the
    small file, whatever its pixel density: a plain two-file `srcset` with `sizes` lets a high-density phone choose the big file,
    which would defeat the purpose. The tag is made with `getImageProps` from `next/image` (Next.js's own way to do this), with
    fixed width and height and alt text. The hero is not given `priority`, because that would also ask every phone to preload the
    big file; it has `loading="eager"` and `fetchPriority="high"`, and it is in the first HTML, so the browser finds it at once.
    A phone then downloads `hero-phone.webp` only (not `hero.webp`, not `hero2.webp`), checked in the Network panel.
