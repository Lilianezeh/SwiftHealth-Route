# Photos in the sections of the home page, SwiftRescue photos, no pictures on search: requirements

**Status: proposal (revision 3, 2026-10-22). Nothing of parts 2 to 4 is built. Waiting for the owner's "yes" and the answers in "Questions for the owner".**
How we build it: [plan.md](plan.md). Branch: `feature/home-photos`. Owner's requests of 2026-10-22 (the first one, then "Change of plan for the home page photos").

## What changed since the first approved version

- **The hero slider is dropped.** The owner stopped it on 2026-10-22 and it was undone (commit `93eff44`): **the hero stays exactly as it is today**: the blue gradient, the slanted `hero3.webp` photo, the header over it, the "Find care near me" button, no search box, no slider, no Pause button.
  The slider, the hero search form, the three feature cards and the scroll-driven fade-in that were built for it are gone from the code. The sixteen `hero-*-640/1280.webp` slider files in `public/images/hero/` were made for the slider; they are replaced by the section photos below when the owner says yes.
- **The photos go into the sections below the hero** (part 2), with a gentle fade-and-slide when they scroll into view (part 3), an optional slow photo strip with a Pause button (part 3), all lazy-loaded (part 4).
- The earlier decision "No slideshow, no animation" (ui-spec 2.1, 2026-10-11/12) is **replaced** by part 3: gentle movement as a photo scrolls into view, off with reduce motion. The rest of that page rule stays: no statistics, no testimonials, red only for SwiftRescue, text 16 px or more, no city named.
- **The ten photos** (owner, 2026-10-22): `laboratory`, `pharmacy`, `hero`, `hero3` (top crop), `owner`, `maternity`, `hero2`, `clinic`, `ambulance`, `fire`. **Left out:** `pharmacy6`, `hero4`, `hospital`, `owner2` (never used anywhere).
- **Kept from the first version, done:** part 1, **no pictures on `/search`** (commit `49fa1c1`: the type banners and their credits are removed, with their tests). `frontend/source-photos/` is in `.gitignore`; only finished WebP files are committed (done).
- The owner's earlier answers still stand: SwiftRescue stays in the header only (no second button on the home page's hero); the two SwiftRescue photos stay in the offline copy.

## The four parts

### 1. Search: no pictures at all (done, `49fa1c1`)
`/search`, with or without `?category=`, shows no `<img>`, `<picture>`, `<figure>`, background photo or credit. The Find page `/find` has none either. Icons of buttons stay. Test: `tests/unit/SearchNoPictures.test.tsx` and the browser test in `find-by-type.spec.ts`.

### 2. Photos in the sections below the hero (proposal: which photo goes where)

The home page stays in the owner's order. The hero is not touched. **Two sections are new** because the owner named them: "How we verify" and "SwiftRescue" (the SwiftRescue photo band and the "How it works" part were removed on 2026-10-12; this brings back a photo section for each, with real words only).

| # | Section (top to bottom) | Photos | Layout | Credit |
| --- | --- | --- | --- | --- |
| 1 | Hero | none, **unchanged** | as today | none (`hero3.webp` stays, Unsplash, no credit) |
| 2 | **What is SwiftHealth Route?** (Overview) | `hero` (blue capsules and stethoscope, no people) | text on the left, photo on the right from 768 px; photo under the text on a phone | "Designed by Magnific" |
| 3 | Why SwiftHealth Route (the blue band) | none | as today | none |
| 4 | **How we verify** (new) | `hero2` (two pharmacists at a screen) and `hero3`, top crop (a stethoscope on linen) | two photos side by side from 768 px, one under the other on a phone; heading, two sentences, a link "How we verify" to `/how-we-verify` | see question 3 |
| 5 | **Find by type** | `clinic`, `pharmacy`, `laboratory`, `maternity` as a row of four small photos **above the five tiles**; the tiles stay exactly as they are (icons, links, no photos) | 2 × 2 on a phone, four across from 768 px; not clickable, not labelled as a type | "Designed by Magnific" under the row |
| 6 | **SwiftRescue** (new) | `ambulance` and `fire` | two photos side by side from 768 px; heading, a line, a blue button "Open SwiftRescue" to `/emergency`; **never red, no sponsored content** | "Designed by Magnific" |
| 7 | (optional) photo strip | see part 3 | | see part 3 |
| 8 | For facility owners | `owner` (a smiling pharmacist at the counter) **instead of** `hero4-portrait.webp` | photo left, text right from 768 px, as today | "Designed by Magnific" |
| 9 | Footer | none | as today | none |

**Words of the new sections (real facts only; the owner reviews them):**
- *How we verify:* heading **"How we verify"**; text **"Every listing starts as a draft. Our team checks it with a call and a visit before it goes live, and checks it again on a regular cycle."** (both sentences come from `/how-we-verify`, which states the rule; no number); link **"How we verify"** to `/how-we-verify`.
- *SwiftRescue:* heading **"SwiftRescue"** (name from `brand.emergencyName`); text **"Emergency contacts for ambulance and fire, with 112 first. In danger, call 112."**; button **"Open SwiftRescue"** (blue, to `/emergency`). It says nothing about response times and does not promise a response (FR-26).
- *Find by type, Overview, owners:* the owner's words stay as they are.

**Rules for every photo:** honest alt text written after looking at the converted file; no text or logo in the picture; no red cross (I looked at all ten: none; the ambulance has red stripes and part of the lettering "…ANCE", the fire photo a red helmet with a "1-4" in a square frame); nothing graphic; fixed `width` and `height`; a plain `<img>` (no `next/image` client code); the photo never carries text over it; at 320 px each photo is the full width of the content and nothing is wider than the screen.

### 3. Movement

- **Fade and slide on scroll (every section photo).** A photo starts 24 px to the side or below its place with `opacity: 0` and, when 15% of it is in view, **fades and slides to its place in 0.8 s** (CSS `transition` on `opacity` and `transform`; an `IntersectionObserver` adds the class once, then stops watching it). **No new library.** Only `opacity` and `transform` move, so the layout never shifts (CLS 0).
  - **Without JavaScript, or when the observer fails, the photos are simply shown** (the hidden start state is added by the script after it runs, never in the HTML).
  - **With "reduce motion" (`prefers-reduced-motion: reduce`): no movement at all.** The script does not even start; photos show at once, with no fade and no slide. A test reads the script and the CSS for this.
  - The *text* of the sections does not move. Only the photos.
  - One small client component (about 1 kB) wraps the photos; the sections stay server components.
- **Optional: one slow photo strip near the bottom** (above "For facility owners"), **only if the owner says yes (question 4)**: a single row of the photos from this page, drifting slowly sideways (about 40 px a second, CSS animation on `transform`), with a **visible "Pause" / "Play" button** (48 px, text label), **stopping when the tab is hidden** (`document.visibilityState`), and stopping while the visitor has paused it. With reduce motion: **no movement**; the strip is a plain row that scrolls by hand. The strip repeats photos that are already on the page (same files, no extra download). Credit: one "Designed by Magnific" link under it.

### 4. Speed (NFR-01) and Lighthouse

- **Every one of these photos is below the fold** on a phone and a laptop (the hero is 85% of the screen on a laptop; the first photo section starts after it). All are `loading="lazy"` and `decoding="async"`, so **none is downloaded before the visitor scrolls near it**, and none can become the largest paint. The hero is untouched, so its loading is unchanged.
- **WebP, fixed sizes, made by `scripts/optimize-hero-photos.mjs`** (updated) from `source-photos/`; budgets (kB): 

| Use | Size | Budget |
| --- | --- | --- |
| Overview, owners and How we verify (4 photos: `hero`, `owner`, `hero2`, `hero3`) | 800 × 533 (3:2) | 50 kB each |
| Find by type row (4 photos) | 480 × 320 (3:2) | 25 kB each |
| SwiftRescue section and `/emergency` (`ambulance`, `fire`: one file each, used in both places) | 640 × 240 (8:3) | 40 kB each |

  Total below the fold: about **380 kB at most**, lazily, and only as far as the visitor scrolls. A phone gets the same files (the browser scales them; the Overview, owners and verify photos are 800 px wide for a 360 px screen: a little more than needed, which I accept to keep one file per photo; the alternative is a 480 px file for phones, question 5).
- **CLS 0:** every `<img>` has `width` and `height` and a CSS `aspect-ratio`, so the room is kept before the file arrives; the movement is `transform` only.
- **Lighthouse (mobile): Performance must not drop below 73, Accessibility stays 100.** The photos are lazy and below the fold, so the risks are small: a few more nodes, one ~1 kB script, more total bytes (informational, they load only on scroll). **I report before and after** (see "Measuring"). The owner's own Lighthouse on the preview is the gate; the pull request stays a draft until it says 73 or more and 100.

### 5. Credits (NFR-13)
- **One small "Designed by Magnific" link** (to `https://www.magnific.com`, new tab, `rel="noopener noreferrer"`, **16 px**, 48 px tap area) **in each section that shows Magnific photos**: sections 2, 5, 6, 8 (and 4 if question 3 allows it). Placed under the photos, not over them; never over text.
- **On `/emergency`: the same link under each SwiftRescue photo** (owner, 2026-10-22).
- No credit on the hero (`hero3.webp`, Unsplash).

### 6. SwiftRescue photos on `/emergency` (blocked, as before)
- `ambulance` in the **Ambulance** group and `fire` in the **Fire** group, a small lazy fixed-height header image (640 × 240 WebP, under 40 kB), above the group's contacts, with the credit under each. **112 and "Call 112" stay first** (in the page's own HTML, no photo can delay them); the page works offline: the worker keeps the two photos (cache first, only these two files) and the page looks fine without them (a quiet panel, no broken-image icon, no jump).
- **Blocked:** it changes `EmergencyGroups.tsx` and `public/sw.js`, which the open pull requests **#37, #39 and #40** also change (checked on GitHub again on 2026-10-22: all four, #37 to #40, are still open, none merged). I build parts 2 to 5 first and part 6 when those three are merged (or the owner tells me to build it on top of them). **The owner believed #37 and #38 were merged: they are not.**

## The photos (looked at one by one, 2026-10-22)

The originals (80 MB) are in `frontend/source-photos/` (ignored by git, never served). Sizes are the real pixel sizes.

| Source | Size | Use | Notes |
| --- | --- | --- | --- |
| `hero.jpg` | 5616×3744 | Overview (2) | Blue and white objects on white: matches the palette; no people, no text. |
| `hero2.jpg` | 4256×2832 | How we verify (4) | Two pharmacists at a screen in front of shelves. Seen through glass (reflections); a wooden divider takes a third of the frame: cropped to the faces. |
| `hero3.jpg` | 4000×6016 (portrait) | How we verify (4), **top crop only** | A steel stethoscope on linen. The crop stops above y = 2830, where a blood pressure gauge with a logo starts. Already used by the hero as `hero3.webp` (same photo; the hero keeps it). |
| `clinic.jpg` | 6354×4539 | Find by type (5) | A nurse in light-blue scrubs in a bright corridor. Serious look; a colleague with her head in her hand behind her. The weakest of the ten. |
| `pharmacy.jpg` | 4608×2304 | Find by type (5) | A pharmacist serving a customer; warm, teal and blue. |
| `laboratory.jpg` | 6000×4000 | Find by type (5) | A woman with a microscope and blue gloves; bright and calm. |
| `maternity.jpg` | 6144×3456 | Find by type (5) | A doctor and a patient, both in masks. **It is not a maternity scene** and looks like the pandemic: see question 2. |
| `ambulance.jpg` | 4256×2832 | SwiftRescue (6) and `/emergency` | A health worker in a mask in front of an ambulance with open doors. No red cross. |
| `fire.jpg` | 5637×3758 | SwiftRescue (6) and `/emergency` | A firefighter in a red helmet at an engine; smoke. No red cross. Intense, nothing graphic. |
| `owner.jpg` | 4256×2832 | For facility owners (8) | A smiling pharmacist at the counter; bright. Small unreadable product print on the shelves and a small red round sign on the wall. |
| `pharmacy6`, `hero4`, `hospital`, `owner2` | | **Out** (owner) | `pharmacy6`: readable posters. `hero4`: portrait; **its file `hero4-portrait.webp` is replaced by `owner` in the owners part and deleted**. `hospital`: a patient in bed. `owner2`: portrait with readable brand text. |
| `whatsapp.png` | 2880×2880 | Out | Not a photo. |

**Files:** `public/images/sections/<name>-800.webp`, `-480.webp`, `public/images/emergency/{ambulance,fire}.webp`. A replaced photo needs a new file name (`/images/*` is cached for a year, `netlify.toml`). The old `public/images/hero/` slider files and `public/images/home/hero4-portrait.webp` are deleted; `hero3.webp` and `hero3-phone.webp` (the hero) stay.

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| P1 | The four type photos are a row above the tiles, not on the tiles (there is no hospital photo, and `maternity` is not a maternity scene). | Photos on the tiles (hospital without one) |
| P2 | "How we verify" and "SwiftRescue" are new home sections with real words from the information pages. | Photos only on the `/how-we-verify` page and `/emergency` |
| P3 | The reveal is a 24 px slide and a fade of 0.8 s, once. | Other distance or time |
| P4 | `ambulance` and `fire` are the same two files on the home page and on `/emergency`; one download, cached. | Different crops |
| P5 | The owners part uses `owner` and the old `hero4` portrait is deleted. | Keep `hero4` there (it is on your "leave out" list) |
| P6 | The photo strip is **not** built unless you say yes. | Build it now |
| P7 | The "SwiftRescue" home section has a blue button, never red (red is the header's button only). | A red button |

## Questions for the owner (please answer with the "yes")

1. **Order and the two new sections.** Do you want "How we verify" and "SwiftRescue" as new home sections (my proposal, P2), in this order: Overview, Why, How we verify, Find by type, SwiftRescue, owners?
2. **`maternity.jpg` with Find by type.** It shows two masked people, not a maternity scene. I put it in the row of four (as you said) with an honest alt text ("A doctor in a white coat and a face mask speaks with a patient, who also wears a mask."), not labelled "Maternity". Keep it there, or move it to the optional strip?
3. **`hero3` and the credit.** You told me on 2026-10-22 that `hero3` is an Unsplash photo. The "How we verify" section shows it next to `hero2` (Magnific). A "Designed by Magnific" link there would be wrong for `hero3`. Choose: (a) credit under `hero2` only, saying "Photo on the left designed by Magnific"; (b) use another Magnific photo instead of `hero3` there; (c) you confirm `hero3` is Magnific after all.
4. **The photo strip.** Yes or no? (I recommend **no** for now: it is the part most likely to cost Lighthouse points, and the page already moves enough. It is specified above so you can say yes.)
5. **A smaller file for phones?** One 800 px file per photo (simpler, about 30 kB more on a phone) or also a 480 px file for phones (more files, a `<picture>`)? I recommend **one file**.
6. **`hero4` in the owners part.** The photo on your "leave out" list is the one there today. OK to replace it with `owner` and delete the file?
7. **Part 6 and the merge order.** Merge #37, #39 and #40 first (I recommend it), or build part 6 on top of them in this pull request (it then cannot merge before them)?

## Measuring (Lighthouse)

- **The honest limit:** this laptop is overloaded (load 10 to 25 on 4 cores): Lighthouse 12 on a production build of today's home page gave **Performance 25, Accessibility 100**, Total Blocking Time 70 to 100 s. Absolute scores here mean nothing; **your live score is Performance 73, Accessibility 100.**
- **What I report, before and after, same build and machine, three runs each:** the Lighthouse scores (only the change counts), the **bytes and requests before the load event** (must not grow: the photos are lazy), the **bytes after scrolling to the bottom**, the **JavaScript added**, **CLS** (must be 0), and a Playwright check at 320, 360, 768 and 1024 px.
- **The real gate is yours:** after the preview is up, you run Lighthouse (mobile, Incognito) and tell me the two numbers. The pull request stays a draft until Performance is 73 or more and Accessibility is 100. If Performance drops, I remove what costs most (the strip first) and ask you.
