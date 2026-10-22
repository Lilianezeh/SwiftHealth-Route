# Home page photo slider, SwiftRescue photos, no pictures on search: requirements

**Status: approved by the owner on 2026-10-22 ("Yes, with these answers"); being built. Parts 1 to 3 first; part 4 waits (see "Part 4 is blocked").**
How we build it: [plan.md](plan.md). Branch: `feature/home-photos`, from `main`. Owner's request of 2026-10-22.

## The owner's answers (2026-10-22), which replace the proposal where they differ

- **Photos: eight**, in this order: `laboratory`, `pharmacy`, `hero`, `hero3` (top crop), `owner`, `maternity`, `hero2`, `clinic`. **Left out:** `pharmacy6`, `hero4`, `hospital`, `owner2` (`owner2` is not used at all). `ambulance` and `fire` are for SwiftRescue only.
- **Question 1 (search box): yes.** A plain search form in the hero that goes to `/search`.
- **Question 2 (SwiftRescue button): header only.** No red button in the hero.
- **Question 3 (reduce motion): one still photo; Pause and the dots are hidden.**
- **Question 4 (credits of `hero3` and `hero4`): they are from Unsplash**; the credits stay as the specs say (the home page's own `hero4` photo has none). **One thing for the owner to see:** the owner also asked for **one fixed "Designed by Magnific" link**
  that does not change per slide. Slide 4 (`hero3`) is, by the owner's answer, an Unsplash photo, so for that one slide the fixed Magnific link is not accurate. I built it as asked (one fixed link) and mark this in the pull request.
- **Question 5: `owner2` is not used.** **Question 6: the two SwiftRescue photos are kept in the offline copy.**
- **Question 7:** the owner believes #37 and #38 are merged. **They are not** (GitHub shows #37, #38, #39 and #40 open, and `main` has none of them; checked 2026-10-22 twice). `feature/home-photos` was updated from `main` as asked.
- **Credit, final wording:** **one small fixed "Designed by Magnific" link** (to `https://www.magnific.com`) **in the corner of the hero, 16 px, not changing per slide**; the same on each SwiftRescue photo.
- **`frontend/source-photos/`** is in `.gitignore`; only the finished WebP files are committed.
- **The old decision "No slideshow, no animation" (ui-spec 2.1, 2026-10-11/12) is REPLACED by this feature**: a slow photo slider in the hero (with Pause, dots, visibility and reduce-motion rules) and a gentle CSS fade-in of the sections.
  Everything else of the old "Rules for the whole page" stays: no statistics, no testimonials, red only for SwiftRescue, text 16 px or more.

**Part 4 is blocked.** The SwiftRescue photos go inside the **Ambulance and Fire sections**, which are always drawn only after #37 (and the worker that keeps them offline is `sw.js` of #40). Those pull requests are open, so building part 4 on `main` now would
conflict. Parts 1 to 3 do not touch those files and are built now. Part 4 follows when #37, #39 and #40 are merged (the photo files and the script are already prepared and tested).

## Corrections found while building

- `pharmacy.jpg` is **4608 × 2304**, not 1536 × 768 (the 1536 in its metadata is the thumbnail): it is a large photo, not the smallest.
- **Sizes:** the phone files are **640 × 900** (portrait crops, because on a phone the hero band is tall; a landscape file stretched would be blurry), the larger-screen files **1280 × 800**; budgets **40 kB** and **100 kB**. All sixteen pass (the largest: 38.7 kB and 94.9 kB).
- **Phone layout:** like the current hero, a **photo band at the top** (with the header's dark veil over it and the credit in its corner), and the text **below it on the blue gradient**; so the heading and the search box are always on a solid blue and the photo is seen. **From 1024 px** the photo fills the whole hero and the overlay is under the text on the left.
- **Dots:** each is **48 px high and 28 px wide** (eight dots and the Pause button must fit a 320 px screen); WCAG 2.2 AA asks 24 px at least.

## Requirements

[prd.md](../prd.md): **US-13** (works on a slow connection), **US-01** (find care), **US-04** (SwiftRescue), **US-15** (find blood), **FR-02**, **FR-14** (112 first), **FR-17** (SwiftRescue works offline),
**NFR-01** (speed), **NFR-03** (offline), **NFR-10** (text 16 px or more, tap targets 48 px or more, contrast), **NFR-12** (SEO), **NFR-13** (photo credits). Frontend only: no API, table or package.
The slider uses CSS and a small piece of React state; **no animation library**.

**This changes standing owner decisions** in `ui-spec.md` 2.1, so they are listed here and will be rewritten in the ui-spec first (spec before code):
"No slideshow, no animation" (now a slider and a gentle fade-in); "no red button and no second button in the hero" (see question 2); the hero is a gradient with a slanted side photo (now a full-width photo slider
under a dark-blue overlay); the old home photos `hero3` and `hero4` "need no credit" (see question 4); the type banners and their credits on search (removed).

## The four parts

### 1. Search and Find by type: no pictures at all
- `/search` (with or without `?category=`) shows **no `<img>`, no `<picture>`, no `<svg>` picture and no background photo**. The type banners (clinic, pharmacy, laboratory) and their "Designed by Magnific" credits are removed from the page, from `config/types.ts`
  (the `photo`, `approved` and `credit` fields), from `public/images/types/`, and the script `scripts/optimize-type-banners.mjs`. The heading, the type chip and the results list stay exactly as they are.
- Functional UI icons (the phone and map-pin icons on result cards, the buttons) stay: they are controls, not pictures. A test says so: no `img`, `picture` or `figure` on the page.

### 2. Hero slider on the home page
- **Eight photos** (see the table; the owner chose eight), full width, behind the hero. They **crossfade slowly: each stays about 6 seconds, the fade takes 1.5 seconds** (CSS `opacity` transition, no library).
- **A dark-blue overlay** keeps the text readable: the `pine-dark` token (`#134F6A`) at **85% under the text block** (left), fading to 30% on the right, and a band of 80% across the top 6 rem for the header's white links. On a phone and tablet (under 1024 px) the photo is a band at the top and the text sits below it on the solid blue gradient, so the text never lies on a photo there.
  Computed contrast of white text on the worst case (a pure white photo under 80%): **5.07:1**; under 85%: **5.85:1** (AA needs 4.5:1). A test recomputes this from the tokens.
- **Fixed while the photos change:** the heading (the `h1`), the line, the search box, the "Find care near me" link, and the header with the red SwiftRescue button (the only SwiftRescue button; none in the hero). Only the photos change.
- **Controls:** a visible **Pause/Play** button (48 px, with a text label, `aria-pressed`) and **dots** (one button per photo, 48 px tap area, `aria-current` on the shown one, each named "Show photo 3 of 8: <short name>"). Tapping a dot shows that photo and restarts its 6 seconds.
  The slider **stops when the tab is hidden** (`document.visibilityState`) and restarts when it is shown; it also stops while the visitor has paused.
- **Reduce motion** (`prefers-reduced-motion: reduce`): **one still photo (the first), no timer, no fade, no sliding**. The Pause button and the dots are hidden (nothing moves; see question 3). The credit stays.
- **Credit:** one fixed "**Designed by Magnific**" link to `https://www.magnific.com` (new tab, `rel="noopener noreferrer"`), **16 px**, in a small dark chip in the **lower right corner of the hero photo**, always visible, **not changing per slide** (owner, 2026-10-22). 48 px high tap area.
- **Speed:** only the **first photo loads straight away** (`fetchpriority="high"`, and a phone gets the 640 px file, a larger screen the 1280 px file, through `srcset`); photos 2 to 8 are **not in the page at first**: the next photo is added one step ahead of its turn, after the page has loaded and the browser is idle. Nothing blocks the heading or the search box.
- **Alt text:** one honest sentence per photo (in the table), written after looking at it; no medical claim; no city. The same sentence is the dot's name.
- **Lighthouse:** Performance must stay **73 or more** and Accessibility **100**. See "Measuring" below.

### 3. The rest of the home page
More attractive, still professional, **only real features**: search, Find by type, SwiftRescue, Blood, List your facility. No invented numbers, reviews or logos. Every button goes to a working page (a test visits every link of the page).
- **A row of three feature cards** right under the hero: **Find care** (to `/find`), **SwiftRescue** (to `/emergency`, "Emergency numbers, 112 first"), **Find blood** (to `/blood`). Plain cards, no photos, an icon each.
- The existing parts stay, in the owner's words: **What is SwiftHealth Route?**, **Find by type** (the five tiles to `/search?category=...`), **Why SwiftHealth Route** (the four items), **For facility owners** (to `/list-your-facility`).
- **Cleaner cards and consistent spacing:** one card style (white, 1 px `line` border, `rounded-2xl`, the `shadow-card` token), one vertical rhythm (`py-16` on a laptop, `py-12` on a phone), the blue palette only. No new colour; red only for SwiftRescue.
- **Gentle fade-in as sections scroll into view:** a CSS-only fade and a 12 px rise (`animation-timeline: view()` inside `@supports`), so there is **no JavaScript** for it, and a browser without support simply shows the sections. **Off with reduce motion.** The first screen is never hidden or delayed.

### 4. SwiftRescue photos
- **ambulance.jpg** in the **Ambulance** group and **fire.jpg** in the **Fire** group, as a **small header image inside each section**, above its contacts: **640 × 240 WebP, under 40 kB each**, a fixed box (`aspect-[8/3]`, at most 160 px high), `loading="lazy"`, `decoding="async"`, so nothing jumps and no photo is waited for.
- **I looked at both photos for a red cross: there is none** (checked at full size, see the table). The ambulance photo has red *stripes* and part of the lettering "…ANCE" on the van; the fire photo has a red helmet with a white number frame "1-4" (a square, not a cross). Tell me if you still want a different photo.
- **112 and the Call 112 button stay first**: they are in the page's own HTML above everything, and the photos are lazy and below them; a test checks the order and that the page's layout does not move when a photo is slow or missing.
- **Credit** "Designed by Magnific" (link, 16 px, 48 px tap area) directly under each photo, and an honest alt text.
- **Offline:** the two photos are small (about 70 kB together), so the worker may keep them (cache first, only the two files of `/images/emergency/`), and **the page looks fine without them**: if a photo cannot load (no network, first visit offline), its fixed box stays as a quiet light-blue panel with the credit hidden and no broken-image icon. Question 6.

## The photos (looked at one by one, 2026-10-22)

The 14 files in `frontend/public/images/hero/` are 80 MB of originals (4 to 14 MB each). **They are not to be served or committed**: they move to `frontend/source-photos/` (new, in `.gitignore`), and only the finished WebP files go in `public/images/`.
Rules applied: good light, wide (landscape) framing, no red cross, nothing graphic, no logos or text in the photo. **The owner chose eight** (seven landscape photos and one logo-free crop of a portrait), with the caveats in the table.

| Source | Size | Use | Why (one line) |
| --- | --- | --- | --- |
| `laboratory.jpg` | 6000×4000 | **Slide 1** `hero-laboratory` | Bright and wide, a woman with a microscope and blue gloves (matches the palette), calm, no text. First slide so the first paint is a clean, light photo. |
| `pharmacy.jpg` | 4608×2304 | **Slide 2** `hero-pharmacist` | A pharmacist serving a customer, 2:1 wide, teal and blue like the palette, warm face; bottle labels are out of focus. |
| `hero.jpg` | 5616×3744 | **Slide 3** `hero-stethoscope-capsules` | Blue and white objects on white: matches the blue palette exactly, no people, no text, very calm. High key, so it relies on the overlay most. |
| `hero3.jpg` (top crop) | 4000×6016 → 4000×2250 | **Slide 4** `hero-stethoscope` | The top 16:9 part of the portrait: a steel stethoscope on white linen. The blood pressure gauge (with the "Doctor" logo) is **outside** the crop. |
| `owner.jpg` | 4256×2832 | **Slide 5** `hero-pharmacy-counter` | A smiling pharmacist at the counter, bright and warm, wide. **Caveat:** shelves with small unreadable product print and a small red round sign on the wall. |
| `maternity.jpg` | 6144×3456 | **Slide 6** `hero-consultation` | A doctor talking with a patient, blue-teal wall like the palette, wide. **Caveat:** both wear masks (looks like the pandemic), and the foreground hair is blurred. Not a maternity scene. |
| `hero2.jpg` | 4256×2832 | **Slide 7** `hero-pharmacists` | Two pharmacists at a screen in front of shelves, wide, warm. **Caveat:** seen through glass (reflections) and a wooden divider takes a third of the frame: cluttered. |
| `clinic.jpg` | 6354×4539 | **Slide 8** `hero-nurse` | A nurse in light-blue scrubs in a bright corridor, wide. **Caveat:** serious look, and a colleague with her head in her hand behind her: not a cheerful picture. Weakest of the eight. |
| `pharmacy6.jpg` | 6019×4013 | **Out** (owner) | Readable posters ("CARDIO", "SLEEP") and red shelf strips. |
| `ambulance.jpg` | 4256×2832 | **SwiftRescue, Ambulance group** (not the hero) | A health worker in a mask in front of an ambulance with open doors. No red cross. Partial lettering "…ANCE" and red stripes. |
| `fire.jpg` | 5637×3758 | **SwiftRescue, Fire group** (not the hero) | A firefighter in a red helmet at an engine, smoke. No red cross (the helmet label is a "1-4" in a square frame). Intense but nothing graphic. |
| `hero4.jpg` | 4160×6240 | **Out** | Portrait close-up of a smiling doctor holding pills: a wide crop would cut the face. It is the photo of the "facility owners" part already on the home page (kept there, see question 4). |
| `hospital.jpg` | 2160×3840 | **Out** | Portrait video frame, a patient in bed, soft and low light: not a hero, and it is the photo the old type config left out for a patient's face. |
| `owner2.jpg` | 2700×3779 | **Out** | Portrait, readable brand text ("TRUST", "kiss") and a printed T-shirt, and it looks like an ordinary photograph of a real person, not stock: I need your word that it may be published (question 5). |
| `whatsapp.png` | 2880×2880 | **Out** | Not a photo: the WhatsApp glyph source (its 72 px copy is already in the repository). |

**Duplicates.** `clinic.jpg`, `laboratory.jpg` and `pharmacy.jpg` are the originals of the three old type banners (the banners are crops of them), and `hero3.jpg` and `hero4.jpg` are the originals of the two current home photos. Each photo is used **at most once**:
the three banner WebP files and the old `hero3.webp` / `hero3-phone.webp` are deleted; `hero4-portrait.webp` stays for the facility owners part.

**Naming and format.** Clear names (`hero-laboratory`, `hero-pharmacist`...), WebP, two sizes each for the hero: **640 px wide (up to 40 kB)** for phones and **1280 px wide (up to 100 kB)** for larger screens, made by a script (`scripts/optimize-hero-photos.mjs`, `sharp`, already in the project) from `source-photos/`.
A photo that is replaced later needs a new file name (`/images/*` is cached for a year, `netlify.toml`).

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| P1 | Eight photos (the owner's choice and order). | Fewer or more |
| P2 | Overlay: `pine-dark` 85% under the text, 30% on the right, 80% band under the header; no new colour. | A flat 70% overlay (less photo) |
| P3 | Timing: 6 s per photo, 1.5 s fade. | Other numbers |
| P4 | The first slide is `hero-laboratory`: the lightest, cleanest photo, a face, no text. | `hero-stethoscope-capsules` (no people) |
| P5 | The slider's photos are added to the page **one ahead of their turn**, after the load event and when idle; with JavaScript off the visitor sees the first photo only (still, with the credit). | Preload all eight |
| P6 | The fade-in of sections is CSS-only and does nothing in a browser without `animation-timeline`. | A small observer script |
| P7 | The search box in the hero is a plain form to `/search` (works before any script). | None (see question 1) |
| P8 | The three feature cards under the hero use icons from `lucide` already in the project, no photos. | Photos on the cards |
| P9 | SwiftRescue photos: 640×240, under 40 kB, lazy, fixed box; kept offline by the worker (cache first), with a quiet panel if missing. | Never kept offline |

## Questions for the owner (answered on 2026-10-22: see "The owner's answers" at the top; kept for the record)

1. **A search box in the hero.** Today the home hero has **no search box**: only the button "Find care near me" (the search box is on `/find`). You listed "heading, search box and SwiftRescue button" as fixed. I propose a **real search box** in the hero (a plain form to `/search?q=...`, label "Search hospitals, pharmacies, labs", 48 px, then the "Find care near me" button under it). Yes?
2. **A SwiftRescue button in the hero.** Today the red SwiftRescue button is in the **header** (on every page, and the header stays fixed over the slider). You decided on 2026-10-12 that the hero has no red button. I recommend **header only**. Or add a second one in the hero?
3. **Reduce motion:** I hide Pause and the dots (one still photo). Or keep the dots so the visitor can still choose a photo (no auto-change)?
4. **Credits for the old home photos.** The home page specs call `hero3` and `hero4` "Unsplash photos that need no credit". You now say all photos in the folder are Magnific. If `hero4` (the smiling doctor in the facility owners part) is Magnific too, that part needs the credit as well. Which is true?
5. **`owner2.jpg`**: is it a stock photo or a photograph of a real person? I leave it out either way; if it is a real person I would not publish it without their written consent.
6. **Offline photos on SwiftRescue:** keep the two photos in the offline copy (about 70 kB, my recommendation) or leave them out?
7. **Merge order.** `EmergencyGroups.tsx` and `public/sw.js` are also changed by the open pull requests **#37, #39 and #40**. You told me to branch from `main`, and I will, but merge those first or expect me to resolve the conflicts afterwards.

## Measuring (Lighthouse)

- **The honest limit:** I ran Lighthouse 12 (mobile) on a production build of today's home page on this laptop: **Performance 25, Accessibility 100**, but with **Total Blocking Time of 70 to 100 seconds** and a machine load of about 10 on 4 cores. The **live score you measured is 73**. So the absolute number here is meaningless; the laptop is the problem, not the page.
- **What I will report, before and after, on the same build and machine, three runs each:** the Lighthouse scores (relative change only), the **bytes and the number of requests before the load event**, the **size of the first photo**, the **JavaScript added** (kB, from the build's route table), **CLS** (measured in Playwright, must stay 0), and the time to the first paint of the heading.
- **The real gate is yours:** after the preview is up, you run Lighthouse (mobile, Incognito) as before and tell me the two numbers; the pull request stays a draft until Performance is **73 or more** and Accessibility **100**. Before the build, my "before" numbers on this machine are: **FCP 8.6 to 13.3 s, LCP 13.3 to 22.4 s, total transfer 205 to 208 KiB, CLS 0** (the machine's speed makes the times large; the bytes are right).
