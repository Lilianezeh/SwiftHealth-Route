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
| amber | `#e8913a` | Highlights, focus ring, "Sponsored" tag |
| paper | `#f6f3ec` | Page background |
| ink | `#1d2421` | Body text |
| emergency | `#b3261e` | SwiftRescue button, 112 card only |

### Accessibility and performance (NFR-01, NFR-04, NFR-10)
- Tap targets at least 48 × 48 px; body text 16 px or larger; visible focus ring.
- Works from 320 px wide; no sideways scrolling.
- Pages are server components unless they need interaction; only maps, forms and filters are client components.
- Images compressed; no large libraries on public pages except Leaflet on the map view.

### Standard states (every data screen)
| State | Show |
| --- | --- |
| Loading | Skeleton cards (grey blocks), never a blank screen |
| Empty | Plain message + next step, e.g. "No open pharmacies within 10 km. Try a wider area." with a button |
| Error | "We couldn't load this. Check your connection and try again." + Retry button |
| Offline | On `/emergency`: show the cached list with "Offline — showing saved contacts from [date]" |

### Reusable components (`src/components/`)
| Component | Purpose |
| --- | --- |
| `ListingCard` | Name, category, area, distance, open/closed badge, last-verified date, Call + Directions buttons; "Sponsored" tag when `sponsored` |
| `CallButton` | `tel:+234…` link, full-width on mobile |
| `DirectionsButton` | Opens `https://www.google.com/maps/dir/?api=1&destination=lat,lng` |
| `OpenNowBadge` | "Open now" (green) / "Closed" (grey) / "Open 24 hours" |
| `VerifiedDate` | "Verified 3 days ago"; amber "Verification due" when `verification_due` |
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
3. Search box: "Search hospitals, pharmacies, labs…" → `/search?q=…`.
4. Category shortcuts: Hospitals · Clinics · Pharmacies · Maternity · Labs · Blood (→ `/blood`).
5. "Open now near me" button → `/search?open_now=true` with location.
**Location:** ask once for permission; if refused, show an area dropdown (from `GET /meta`).

### 2.3 Search results — `/search`
FR-04 to FR-08, US-01, US-05. **API:** `GET /search`, `GET /meta`.
1. Search box (pre-filled) and a **Filters** button opening a sheet: category, service, area, open now, 24 hours, distance (5 / 10 / 20 km).
2. Toggle: **List** | **Map**.
3. Result count: "12 places, nearest first".
4. List of `ListingCard`s; sponsored card (if any) first with "Sponsored" tag.
5. "Load more" button (pagination).
**URL holds all filters** (`/search?category=pharmacy&open_now=true`) so results can be shared.
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
