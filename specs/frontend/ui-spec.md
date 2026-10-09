# SwiftHealth UI specification

What every screen shows, which API it uses, and how it behaves. Build from this file; if something is
unclear or missing, update the spec first, then the code. Endpoint details are in `specs/backend/api-spec.md`.
Sketches go in `docs/screens/`.

---

## 1. Global rules

### Brand and naming
- App name **SwiftHealth**; emergency section and button **SwiftRescue**.
- Tagline: *Emergency, Hospital & Pharmacy Finder*.

### Layout (every page, from `src/app/layout.tsx`)
- **Header:** SwiftHealth logo/name (links to `/find`) on the left; red **SwiftRescue** button on the right, always visible, links to `/emergency`.
- **Footer:** About · How we verify · Privacy · Terms · Contact · List your facility.
- Mobile-first; content max width 720 px on public pages, 1200 px in admin.

### Design tokens (in `src/styles/globals.css`)
| Token | Value | Use |
| --- | --- | --- |
| forest | `#12302a` | Header, headings |
| pine | `#2f7d6b` | Primary buttons, links |
| amber | `#e8913a` | Highlights, "Sponsored" tag background (dark `ink` text on it). Not the focus ring: amber is only 2.2 to 2.5:1 on light backgrounds |
| paper | `#f6f3ec` | Page background |
| ink | `#1d2421` | Body text |
| emergency | `#b3261e` | SwiftRescue button, 112 card only |
| ink-soft | `#4b5c59` | Secondary text (area line, "Verified 3 days ago"); 6.4:1 on paper |
| line | `#d7e1df` | Card borders and dividers |
| pine-100 | `#dff3ef` | Background of the "Verified" label |
| pine-50 | `#f0faf8` | Light panels (the empty "near you" box, empty-state icon circle) |
| open | `#147a48` on open-bg `#e7f6ed` | "Open now" and "Open 24 hours" label (4.8:1) |
| closed | `#465451` on closed-bg `#edf1f0` | "Closed" label (7.0:1) |
| amber-ink | `#8b5c00` on amber-wash `#fff4d6` | "Verification due" label and the error icon (5.3:1); the plain `amber` is too light for small text |
| shadow-card | `0 2px 12px` of forest at 7% | Card shadow |

Components use these tokens (Tailwind classes such as `bg-pine`, `text-ink-soft`), never a hex value. The last eight rows (ten colours) were
added on 2026-10-09 from the owner's Figma Make reference (`docs/design/figma-find-page-design.md`); every pair of text and
background colour is checked by `tests/unit/design-tokens.test.ts` to be at least 4.5:1 (NFR-10). Read the table with the
rule that the six original tokens win over the Figma colours: Figma's teal-950 is `forest`, teal-700 is `pine`, its page
background is `paper`, its red is `emergency`.

### Buttons and text
- **Primary** (Call, Retry): `pine` background, white text. **Secondary** (Directions, See all, Clear filters): white
  background, `pine` border, `forest` text. **Emergency** (SwiftRescue only): `emergency` background, white text. 16 px text,
  semi-bold, at least 50 px high (never under 48 px), radius 12 px.
- Every piece of text is 16 px or larger, including badges, the area line and "Verified 3 days ago" (NFR-10). Card titles
  are 18 px. The system font stack is used; no web font is downloaded.
- Cards: white, 1 px `line` border, 16 px radius, `shadow-card`, 16 px inside.
- Status is shown with words as well as colour ("Open now", "Closed", "Verification due").

### Accessibility and performance (NFR-01, NFR-04, NFR-10)
- Tap targets at least 48 × 48 px; body text 16 px or larger; visible focus ring.
- **Focus ring** (owner's decision, 2026-10-09): 3 px, 2 px offset. `forest` on light backgrounds (14:1 on white, 12:1 on
  `paper`); `paper` on a `forest` background (12:1). A container with a `forest` background has the class `on-dark`, which
  switches the ring for everything inside it (the header and the Find page hero). Both are at least 3:1 (WCAG 2.2, 1.4.11).
  A test in `tests/unit/design-tokens.test.ts` checks it.
- **Icons** (owner's decision, 2026-10-09): from `lucide-react`, imported one by one by name (never the whole set, never a
  dynamic icon). They are decorative (`aria-hidden`) and always sit next to a text label; an icon is never the only content
  of a button or link, and it never carries information alone.
- Works from 320 px wide; no sideways scrolling.
- Pages are server components unless they need interaction; only maps, forms and filters are client components.
  One exception: the results list of `/search` is a client component too. It loads in the browser with a 45 second limit
  (see "Standard states"), because the free API can take about a minute to wake and the hosting gives up on a server page
  after about 30 seconds. This means results need JavaScript (revisit after the Render upgrade, `LOG.md`).
- A visitor's position is kept in `sessionStorage` for the tab only, rounded to 3 decimals. It is never in a page address,
  a cookie, `localStorage` or a log, and it is sent only as `lat` and `lng` to `GET /search`.
- Images compressed; no large libraries on public pages except Leaflet on the map view.

### Standard states (every data screen)
| State | Show |
| --- | --- |
| Loading | Skeleton cards (grey blocks), never a blank screen |
| Empty | Plain message + next step, e.g. "No open pharmacies within 10 km. Try a wider area." with a button |
| Waking up | On data screens loaded in the browser (`/search`, the near-you cards): after 5 seconds without an answer, "The service is waking up. This can take up to a minute." (announced to screen readers; the skeleton stays) |
| Error | "We couldn't load this. Check your connection and try again." + Retry button. Also shown 45 seconds after a request started without an answer |
| Offline | On `/emergency`: show the cached list with "Offline — showing saved contacts from [date]" |

### Reusable components (`src/components/`)
| Component | Purpose |
| --- | --- |
| `ListingCard` | Top line "Category · 1.4 km" (no distance when none), name (a link to `/listing/[slug]`), `VerifiedDate` and `OpenNowBadge`, the address with the area under it, then Call + Directions side by side; "Sponsored" tag when `sponsored`. No Call button when the listing has no phone number |
| `CallButton` | `tel:+234…` link labelled "Call", primary button |
| `DirectionsButton` | Secondary button labelled "Directions"; opens `https://www.google.com/maps/dir/?api=1&destination=lat,lng` (from the listing's latitude and longitude) in a new tab |
| `OpenNowBadge` | "Open now" (green) / "Closed" (grey) / "Open 24 hours" (green, wins over Closed) |
| `VerifiedDate` | "Verified 3 days ago" (a `pine-100` label); when `verification_due`, an amber "Verification due" label with "Verified 45 days ago" next to it, so the date is always shown (FR-08, US-07) |
| `Disclaimer` | Directory / not medical advice text |
| `ResultsMap` | Leaflet + OpenStreetMap map with pins; client component |
| `ShareLocationButton` | Gets location with permission, opens WhatsApp/SMS with a Google Maps link |
| `ReportLink` | "Report a problem" → `/report/[id]` |

---

## 2. Public screens

### 2.1 Landing page — `/`
**Purpose:** pitch SwiftHealth to visitors, partners and investors.
**Sections, top to bottom:**
1. Hero: "Find open care, fast." + tagline + two buttons: **Find care** (`/find`) and **SwiftRescue** (`/emergency`).
2. The problem: three short points (numbers go stale, no single source, hidden hours and fees).
3. How it works: Search → Verified listing → Call or get directions.
4. How we verify: call, visit, re-check, last-verified date (links to `/how-we-verify`).
5. Who it's for: residents · facilities.
6. Pricing: Residents — free, always. Facilities — free verified listing; Featured listing ₦5,000/month (placeholder) (shown with 2 decimals only when not whole, e.g. ₦5,000 or ₦5,000.50). Sponsors — fund SwiftRescue.
7. Call to action for facilities: **List your facility**.
**API:** none (static), except the small API-status check during development.

### 2.2 Find home — `/find`
FR-01, FR-03. **Purpose:** the app's start screen.
1. Heading **"What do you need?"**
2. Two large buttons side by side (stacked on small screens): **Find a healthcare facility** (scrolls to search) · **Get emergency help** (`/emergency`, red).
3. Search box: "Search hospitals, pharmacies, labs…" → `/search?q=…`. It is a plain form (a GET to `/search`), so it works before any script has loaded.
4. Category shortcuts (plain links): Hospitals `/search?category=hospital` · Clinics `clinic` · Pharmacies `pharmacy` · Maternity `maternity` · Labs `laboratory` · Blood (→ `/blood`, a "Coming soon" page until phase 8).
5. "Open now near me" button → asks for the position (after the tap), then `/search?open_now=true`. The position is not in the address.
6. **Near you** (once there is a position or a chosen area; before that, a "Show places near me" button and the area list): two cards, **Closest open pharmacy** (`category=pharmacy&open_now=true&limit=1`) and **Closest open 24-hour place** (`is_24_hours=true&limit=1`), each a `ListingCard`, then a button **See all open places near me** (`/search?open_now=true`). With an area and no position, the same two calls use `area=` and show no distance. The two cards load independently. A card with no result says "No open pharmacy found nearby" or "No 24-hour place found nearby" with a link to search all places, never an empty card; a failed card shows its own error and Retry.
**Location:** the browser asks for permission only after a tap on a button, and only once per tab (a refusal is remembered for the tab). If refused, show an area dropdown (from `GET /meta`).

### 2.3 Search results — `/search`
FR-04 to FR-08, US-01, US-05. **API:** `GET /search`, `GET /meta`.
1. Search box (pre-filled) and a **Filters** button opening a sheet (a native `<dialog>` styled as a bottom sheet): category (list from `GET /meta`), service (pick from the `services` list of `GET /meta`, with "Any service"), area (from `GET /meta`), open now, 24 hours, distance (5 / 10 / 20 km; only usable when there is a position, otherwise disabled with a hint). **Apply** and **Clear filters**.
2. Toggle: **List** | **Map** (the map is phase 5B-2; until then only the list shows).
3. Result count: "12 places, nearest first" with a position, "12 places, A to Z" without one.
4. List of `ListingCard`s; sponsored card (if any) first with "Sponsored" tag.
5. "Load more" button (pagination, 20 at a time; page state, not in the address).
**URL holds all filters** (`/search?category=pharmacy&open_now=true`) so results can be shared, but **never the position** (`lat`, `lng`): it is read from `sessionStorage`. Applying filters replaces the address without adding history entries. A shared link opens with the filters set and, for the receiver, no position.
**States:** skeleton cards while loading; after 5 seconds "The service is waking up. This can take up to a minute."; error with Retry after 45 seconds or on an error answer.
**Empty:** "No matches. Try removing a filter or widening the distance."

### 2.4 Listing page — `/listing/[slug]`
FR-09 to FR-13, US-02, US-03, US-06, US-07. **API:** `GET /listings/{slug}`.
1. Name, category, `OpenNowBadge`, `VerifiedDate`.
2. Big **Call** button (primary number) and **Directions** button.
3. Address and landmark; entrance photo if available.
4. Other phone numbers, each with its own Call button.
5. Opening hours for the week; today highlighted; past-midnight shown as "20:00 – 02:00 (next day)".
6. Services with fee ranges: "₦1,500 – ₦3,000 · estimate, collected 28 Sep 2026".
7. **Share** (WhatsApp / copy link) and `ReportLink`.
8. `Disclaimer`.
**404:** "This listing isn't available. It may be under re-verification." + link to search.

### 2.5 SwiftRescue — `/emergency`
FR-14 to FR-19, FR-24 to FR-26, US-04, US-09, US-14. **API:** `GET /emergency`.
1. **112 card** at the top: "National emergency number — 112" with a large red **Call 112** button.
2. **Share my location** button (`ShareLocationButton`).
3. Groups in API order (Ambulance, Fire, Police, 24-hour emergency units, Roadside, Security, Blood banks), each a list of compact cards with Call buttons and distance.
4. **24-hour pharmacies nearby** section.
5. **Share emergency list** button: sends a plain-text list of names and numbers via WhatsApp or SMS.
6. Disclaimer from the API, always visible.
**Rules:** no sponsored content; no search box; one tap to call anything. Cached for offline use after the first visit (service worker).

### 2.6 Find blood — `/blood`
FR-27, US-15. **API:** `GET /blood/banks`, `GET /meta`.
1. Heading "Find blood" + tab switch: **Find blood** | **Donate blood** (`/blood/donate`).
2. Blood group chips (A+ … O−) and "Any".
3. List of blood banks, nearest first: name, distance, blood groups (chips), confirmed date, Call + Directions.
4. Notice on every card: "Stock changes daily; call to confirm before you go."

### 2.7 Donate blood — `/blood/donate`
FR-28, FR-29, US-16. **API:** `GET /blood/donation-centres`.
1. Heading "Donate blood" + same tab switch.
2. Short eligibility guide (content reviewed by the medical advisor, based on National Blood Service Agency guidance): who can usually donate, what to bring, how to prepare. Ends: "The blood bank will confirm if you can donate."
3. List of donation centres: name, donation hours, Call + Directions.

### 2.8 Report a problem — `/report/[id]`
FR-20, FR-21, US-08. **API:** `GET /listings/{slug}` (for the name), `POST /reports`.
1. "Report a problem with **[Listing name]**".
2. Reason as large radio buttons (from `/meta`).
3. Optional comment and optional phone ("only if you want us to follow up").
4. **Send report**. Under 3 taps for the fastest path (reason → send).
**Success:** "Thank you. We'll check this listing." + back to listing. **429:** "You've sent several reports. Please try again later."

### 2.9 List your facility — `/list-your-facility`
FR-37. **API:** `POST /facility-submissions`, `GET /meta`.
Form: facility name, category, area, address, phone, contact name, contact email, notes. **Success:** "Thanks. We'll verify your facility before it's listed."

### 2.10 Information pages
`/about`, `/how-we-verify`, `/privacy`, `/terms`, `/contact` (FR-23). Static content. Privacy explains NDPA handling (minimal data, reporter phone deleted after resolution, location never stored).

---

## 3. Staff screens (admin panel, `/admin`)

All staff screens require login; redirect to `/admin/login` if no valid token. Show only the links a role can use.

### 3.1 Login — `/admin/login`
FR-30. **API:** `POST /auth/login`, `POST /auth/verify-code`.
Step 1: email + password. Step 2: 6-digit code ("Sent to +234******0001"), with "Resend code" after 60 seconds.
On success, store the token and go to `/admin` (staff) or `/provider` (provider).

### 3.2 Dashboard — `/admin`
FR-34. Editor, admin. **API:** `GET /dashboard/stats`.
Stat cards: published, pending review, re-checks due this week, overdue, open reports (urgent in red). Recharts bar chart: checks passed/failed over 30 days. Quick links to the queues.
Verifiers land on `/admin/listings?mine=true` instead.

### 3.3 Listings — `/admin/listings`
**API:** `GET /listings`. Table (cards on mobile): name, category, area, status badge, next check due. Filters: status, area, category, search, "mine". **New listing** button.

### 3.4 Listing editor — `/admin/listings/new` and `/admin/listings/[id]`
FR-31, FR-42. **API:** `POST /listings`, `PATCH /listings/{id}`, `GET /listings/id/{id}`.
Sections: Basics (name, category, area, address, landmark) · Location (map pin + **Use my current location**) · Phones (add/remove, mark primary) · Opening hours (7 rows, closed toggle, past-midnight allowed) · Services and fees · Description.
Action bar by status and role: **Submit for review** (verifier), **Publish**, **Hide**, **Reopen** (editor/admin).
Unsaved-changes warning when leaving.

### 3.5 Verification log — `/admin/listings/[id]/checks`
FR-32, US-10. **API:** `POST /listings/{id}/checks`, `GET /listings/{id}/checks`, `POST /uploads/sign`.
Designed for a phone in the field: method (Call / Visit), result (Pass / Fail), person reached, notes, **Take photo** (uploads to Cloudinary). History below, newest first.

### 3.6 Reports queue — `/admin/reports`
FR-35, US-12. **API:** `GET /reports`, `PATCH /reports/{id}`.
Urgent first (red tag). Each: listing name (link), reason, comment, time ago. Buttons: **Open listing**, **Resolve**, **Dismiss**.

### 3.7 Re-checks — `/admin/recheck`
US-11. **API:** `GET /listings?due=overdue` and `?due=this_week`. Two tabs: Overdue · Due this week. Each row links to the verification log.

### 3.8 Staff and providers — `/admin/staff`
FR-41. Admin only. **API:** `/admin/users`. List, add user (name, email, phone, role, password), edit role, deactivate, link provider to listing.

### 3.9 Import and export — `/admin/import-export`
FR-39, FR-40. Admin only. Upload CSV → show created count and row errors. Download listings or checks CSV.

---

## 4. Provider screens (`/provider`)

### 4.1 Provider dashboard — `/provider`
**API:** `GET /provider/listing`. Shows listing status, last verified date, featured status ("Featured until 6 Nov 2026" or "Not featured"), and buttons: **Edit my facility**, **Get featured**.

### 4.2 Edit my facility — `/provider/edit`
**API:** `PATCH /provider/listing`. Editable: description, services and fees, opening hours, phones. Notice: "Changes to phone numbers or hours are re-verified by our team."

### 4.3 Get featured — `/provider/featured`
**API:** `POST /payments/featured`. Explains: "Featured listings appear first in matching searches with a Sponsored label for 30 days. Never shown in SwiftRescue." Price, then **Pay with Paystack** → redirect to `authorization_url`.

### 4.4 Payment complete — `/provider/payment-complete`
**API:** `GET /payments/verify/{reference}` (polls every 3 s for up to 30 s). Shows "Payment confirmed — featured until [date]" or "Still confirming… you can leave this page; we'll update your listing."
