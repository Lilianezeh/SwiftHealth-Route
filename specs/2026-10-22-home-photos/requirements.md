# Home page background slideshow, SwiftRescue photos, no pictures on search: requirements

**Status: revision 6 (2026-10-23, built): the owner's polish of the section, keeping 45%: bigger cards (190 px high, 64 px icons, 20 px names, a 16 px line under each name), heading and cards in the lower part of the section so the faces show above them, a 800 px file for phones and a 1600 px file for wide screens, a light brand-blue tint instead of the grey-white wash, a Pause / Play icon and a gentle lift of the cards. The paragraphs below marked "revision 5" for the section height, the white background and the focus points are replaced by the "Revision 6" paragraph at the end of this list; the rest stands. Revision 5 (2026-10-23, built): the slideshow is 45% strong over white, the section is 480 / 520 / 560 px high, each photo has a focus point and the heading has a soft white backing (the owner's change after revision 4; "45" chosen from screenshots). Revision 4 (2026-10-23), approved by the owner ("Yes, with these changes"), replaces revision 3 (photos in the sections, "How we verify" and "SwiftRescue" sections, fade-and-slide), which was built in the first version of PR #44 and is taken out.**
How we build it: [plan.md](plan.md). Results: [validation.md](validation.md). Branch: `feature/home-photos`. Draft PR #44.

## History of the decisions (all by the owner, 2026-10-22 and 2026-10-23)

1. A hero photo slider: dropped (built, then undone at once, `93eff44`).
2. Revision 3: photos in the sections below the hero, with new "How we verify" and "SwiftRescue" sections, a fade-and-slide on scroll, and the Magnific credit in each section. Built and measured (PR #44, first version). **Replaced** by revision 4: the owner wants the home page exactly as it was.
3. **Revision 4 (this one):** the home page is **exactly as on `main`** (hero, hero3, hero4 in "For facility owners", every part and every word), plus **one faint background slideshow behind "Find by type"**. The ambulance and fire photos live **only** on `/emergency`.

## What the owner asked for (revision 4)

1. **The home page as it was before #44:** the hero unchanged; `hero3.webp` and `hero3-phone.webp` (hero) and `hero4-portrait.webp` ("For facility owners") exactly as on `main`, in the same places; no "How we verify" or "SwiftRescue" section on the home page; no photo row above Find by type; no fade-and-slide script. Only files that PR #44 added and that are no longer used are deleted (the eight `public/images/sections/` files; `hero3` and `hero4` files are not touched).
2. **One background slideshow behind "Find by type" only** (owner, 2026-10-23: "OK"). The photos are **only these five**: `clinic`, `hospital`, `maternity`, `laboratory`, `pharmacy`, in this order. (Not used: hero, hero2, hero3, hero4, owner, owner2, pharmacy6, ambulance, fire.)
   - **Crossfade, one photo at a time**, each about **7 seconds**, the fade **1.5 seconds** (CSS `opacity`, no library).
   - **Visible but never in the way (revision 5, owner, 2026-10-23, replaces "18% over light blue"):** the photos are drawn at **45% strength** (the owner chose it on 2026-10-23 from screenshots of 35% and 45% at 360 and 1280 px; the value is `BACKDROP_STRENGTH` in `config/sitePhotos.ts`, and a test fixes it) over a **white** section background (the lighter "wash"), under the tiles, the heading and the controls, never over them. **Every text sits on a white surface**, so it passes WCAG AA (4.5:1) whatever the photo is: the tiles are white cards, the Pause button and the credit are white, and **the heading "Find by type" has a soft white backing** (`bg-white/90`, rounded, with padding) in its original `forest` colour. A test computes the worst case from the colour tokens: a pure black photo pixel at the chosen strength, then the heading's backing over it.
   - **Taller section, so more of each photo shows (revision 5):** the section is at least **480 px high on a phone** (under 768 px), **520 px on a tablet** (768 to 1023 px) and **560 px on a laptop** (1024 px and up), and its content is centred in it. On a phone and a tablet the tiles are a little more compact (80 px high on a phone, two columns, the last tile centred) so that heading, tiles and controls fit in it; on a laptop the five tiles stay in one row, vertically centred. The size kept until the section is drawn (`contain-intrinsic-size`) is the measured height at each of the three sizes (CLS 0).
   - **A focus point for every photo (revision 5):** `object-position` per photo and per size (narrow = under 768 px, wide = 768 px and up), chosen after looking at each crop, so that the main subject, above all the face, is whole on a phone and on a laptop. The photo `hospital` holds two faces that cannot both fit a 3:2 frame (the doctor's face is cut by the original frame at the top): the patient's face is the one kept whole.
   - **Revision 6 (owner, 2026-10-23, "Polish the Find by type slideshow section", 45% kept):**
     1. **Bigger cards:** each card is **190 px high** (laptop and phone alike), the icon circle **64 px** (56 px on a phone), the name **20 px**, and **one short line under the name at 16 px**: Hospital "Admission, surgery and emergency care", Clinic "Check-ups and everyday treatment", Maternity "Antenatal care and childbirth", Pharmacy "Medicines and advice", Laboratory "Tests and results" (`HOME_CATEGORIES.description` in `config/home.ts`). The link's name for a screen reader stays the category name ("Hospital"); the line is its description. Two cards per row on a phone (four columns of the grid, the last card in the middle), tidy at 320 px (nothing wider than the card, nothing cut).
     2. **Heading and cards in the lower part of the section; the faces above them.** Under 1024 px each photo is shown **whole** in a 3:2 band at the top of the section (nothing, no face, is cropped) and fades into the tint at its bottom edge; the heading and cards start a little before the end of the band. From 1024 px the photos fill the section (cover) around a focus point of `50% 0%` (every face in the five photos is in the upper part), and the content sits at the bottom (`justify-end`, section at least 760 px). Each photo was looked at on a phone (320, 360), a tablet (768) and a laptop (1280). In the `hospital` photo the patient's face is whole; the doctor's chin shows only a sliver, because the two faces do not both fit.
     3. **Sharper photos on wide screens:** every photo has an **800 × 533** WebP (at most 45 kB) and a **1600 × 1067** WebP (at most 130 kB). A phone (under 768 px) always takes the 800 px file, whatever its pixel density (`<picture><source media="(max-width: 767px)">`); from 768 px the browser chooses between the two (`srcset` with `w` widths, `sizes="100vw"`). Still `loading="lazy"` and `content-visibility: auto`: nothing is asked for before the section is near, and only the first photo is asked for early.
     4. **A light brand-blue tint** (`pine-100` at 40%) over the photos on a `pine-50` section, instead of the grey-white wash. Every text is still on a white surface (cards, heading backing, Pause, credit), so AA holds in the worst case (a black photo pixel at 45%, then the tint, then the 90% white backing, then `forest`: at least 4.5:1, from the tokens and from real photo pixels in the browser).
     5. **A Pause / Play icon** in the button (the text "Pause" / "Play" stays) and a **gentle lift** of the cards on hover and keyboard focus (`-4px` and a soft shadow in 200 ms; none with reduce motion).
     6. **Size kept until drawn** (`contain-intrinsic-size`, CLS 0): `calc(51.67vw + 802px)` on a phone, `calc(51.67vw + 564px)` from 768 px, `760px` from 1024 px (measured, exactly linear in the width).
   - **A small Pause / Play button** (a real button, 48 px high, text label, WCAG 2.2.2). The slideshow **stops while the tab is hidden** and starts again when it is shown (unless the visitor paused it).
   - **Reduce motion** (`prefers-reduced-motion: reduce`): **one still faint photo (the first), no timer, no fade, no more photos in the page, and no Pause button** (nothing moves).
   - **Loading:** only the first photo is in the page's HTML (`loading="lazy"`; the section is `content-visibility: auto`, so it is not asked for before the section is near the screen). The other four are added **after the first has loaded and the page is idle, one ahead of their turn**. All are WebP files with the width and height fixed (CLS 0): 800 × 533 and 1600 × 1067 since revision 6 (960 × 640 before).
   - **Decorative:** no alt text, hidden from screen readers (`aria-hidden`); they carry no information.
   - **Credit:** one small **"Designed by Magnific"** link (to `https://www.magnific.com`, new tab, `rel="noopener noreferrer"`, **16 px**, 48 px tap area) at the bottom of the section, for the whole slideshow, on a white pill so it never lies on a photo. All five photos are Magnific photos.
   - **Without scripts:** the first photo and the credit are in the HTML; nothing else.
   - **Speed:** Lighthouse (mobile) **Performance 73 or more, Accessibility 100**; reported before and after, five runs each, on this laptop; the owner's own Lighthouse on the preview is the gate.
3. **The ambulance and fire photos stay only on `/emergency`**, under Ambulance and Fire service (as built: lazy, 8:3, credit under each, 112 never waits, a quiet panel if one cannot load, kept offline by the worker, nothing in the saved copy). **Nothing about them on the home page.**
4. **Kept:** no picture on `/search` and `/find` (the type banners are removed); the LOG.md entry for #37, #39, #40 and #43; `frontend/source-photos/` ignored by git (only finished WebP files are committed). **Every photo that is no longer used is removed from the build.**

## The photos

| Source (in `frontend/source-photos/`) | Used for | File |
| --- | --- | --- |
| `clinic.jpg` (6354 × 4539) | slideshow 1: a nurse in a bright corridor | `public/images/backdrop/nurse-corridor-960.webp` |
| `hospital.jpg` (2160 × 3840, portrait) | slideshow 2: a doctor and a patient in bed; cropped 3:2 from y = 640 (two faces, the bed; a patient's face, faint) | `.../doctor-and-patient-960.webp` |
| `maternity.jpg` (6144 × 3456) | slideshow 3: a doctor and a patient, both in masks | `.../consultation-960.webp` |
| `laboratory.jpg` (6000 × 4000) | slideshow 4: a woman with a microscope | `.../laboratory-960.webp` |
| `pharmacy.jpg` (4608 × 2304) | slideshow 5: a pharmacist and a customer | `.../pharmacist-customer-960.webp` |
| `ambulance.jpg`, `fire.jpg` | `/emergency` only | `public/images/emergency/ambulance.webp`, `fire.webp` (640 × 240, under 40 kB) |
| `hero3.jpg`, `hero4.jpg` | the hero and "For facility owners", **unchanged** | `public/images/home/hero3.webp`, `hero3-phone.webp`, `hero4-portrait.webp` |

The photos of the slideshow are not shown with alt text, so the hospital photo (a patient in bed) appears only as a faint, blurred-looking background at 18%; the owner chose it.

## Where the slideshow goes, and why

Behind **"Find by type"** (the owner agreed): it is the one light section of the home page whose content is cards (five white tiles), so a faint photo behind them cannot touch their text. "Why SwiftHealth Route" is a dark band with white text and keeps no photo; the Overview and the owners part are plain text and stay as they are.

## Parts

### 1. Search and Find: no pictures at all (done, `49fa1c1`)
`/search` (with or without `?category=`) and `/find` show no `<img>`, `<picture>`, `<figure>` or credit. Test: `SearchNoPictures.test.tsx` and the browser test in `find-by-type.spec.ts`.

### 2. The slideshow behind "Find by type" (this revision)
As in "What the owner asked for", point 2. One client component (`BackdropSlideshow`) holds the photos, the timer, the Pause button and the credit; the heading and the tiles are passed in from the server and are never drawn again when a photo changes.

### 3. SwiftRescue photos on `/emergency` (done, `ceeba50`)
As in point 3.

## Rules that stay

Text 16 px or more; targets 48 px; no red cross; nothing red in the new part; tidy at 320 px; no medical advice; no city named on the home page; no statistics.

## Measuring (Lighthouse)

On this laptop (quiet, load 1 to 3): five runs of Lighthouse 12 (mobile), alternating, on production builds of `main` (before) and of this branch (after). The owner's own run (mobile, Incognito) on the preview is the real gate: Performance 73 or more, Accessibility 100. If Performance drops, the slideshow is made cheaper (fewer photos, smaller files, later start), and the owner is asked.
