# SwiftHealth — Product Requirements Document (MVP)

Oct 3, 2026 · Lilian Ezichi Ezeh

> Repo copy of the PRD: the source of truth for requirements (US/FR/NFR IDs). Exact contracts are in
> `specs/backend/api-spec.md` (backend) and `specs/frontend/ui-spec.md` (frontend). Change requirements here first.

## Purpose and scope

This document defines what the SwiftHealth MVP (Emergency, Hospital & Pharmacy Finder) must do, launching in Enugu, for building it and for partners reviewing it. It combines a product requirements document (what and why) with the detailed functional and non-functional requirements of a software requirements specification (how it must behave).

**Phone numbers (owner, 2026-10-13):** stored as +234..., and shown for reading in the local format Nigerians write them, 0803 123 4567, wherever a number is shown as text. The `tel:` and `wa.me` links stay international.

**Naming:** SwiftHealth Route is the app (renamed from SwiftHealth on 2026-10-13; the rest of this document still says SwiftHealth and means the same app). SwiftRescue is the name of its emergency section and the emergency button shown on every page; wherever this document says "Emergency section" or "Emergency button", it means SwiftRescue.

**Product:** a mobile-friendly website with verified listings of health facilities and emergency contacts for one pilot area of Enugu, plus an admin panel for the team that verifies the data.

**MVP release goal:** residents in the pilot area can find an open facility or emergency contact and call it or get directions in under a minute, and every listing shown has been verified within its re-check cycle.

**Pilot area:** \[to decide\]. **Target launch:** month 3 of the project.

Requirement IDs use these prefixes: US (user story), FR (functional), NFR (non-functional). Priority: **Must** = needed for launch; **Should** = include if time allows; **Could** = later.

## User roles and permissions

The MVP has one public role, three staff roles and a provider role; the public never needs an account. Today I hold the admin role; the other staff roles exist so access can be given safely as people join.

| Role | Who | Can do | Cannot do |
| --- | --- | --- | --- |
| Visitor | Any member of the public | Search, view listings, call, get directions, view the Emergency section, report a problem, share the emergency list | Edit any data |
| Field verifier | Verification staff or volunteers | Add draft listings, record calls and visits, upload entrance photos, mark a listing verified or failed | Publish listings, delete listings, manage users |
| Editor | Whoever reviews and publishes listings | Everything a verifier can, plus publish, hide or unpublish listings, handle user reports, edit categories | Manage staff accounts, change system settings |
| Admin | Founder (me) | Everything, plus manage staff accounts, roles and settings, export data, view audit log | — |
| Provider | A facility owner or manager | View and edit their own listing (description, services and fees, hours, phones), pay for a featured listing | Edit any other listing, publish, see staff tools |

## User stories

Sixteen stories define the MVP; each has a test that tells us when it is done.

| ID | As a… | I want to… | So that… | Done when | Priority |
| --- | --- | --- | --- | --- | --- |
| US-01 | Visitor | Find pharmacies open now near me | I don't travel to a closed one | "Open now" filter shows only facilities open at the current time, sorted by distance | Must |
| US-02 | Visitor | Call a facility with one tap | I reach help fast | Tapping Call opens the phone dialler with the number filled in | Must |
| US-03 | Visitor | Get directions to a facility | I find it without asking around | Tapping Directions opens Google Maps with the facility pinned | Must |
| US-04 | Visitor | Reach emergency contacts from any page | I don't search during a crisis | An Emergency button is visible on every page and opens the list in one tap | Must |
| US-05 | Visitor | Search by service (e.g. lab, maternity, X-ray) | I find a facility that can help me | Results include only facilities confirmed to offer that service | Must |
| US-06 | Visitor | See services, hours and estimated fees | I can choose before I go | Listing page shows each field, with fees as a dated range | Must |
| US-07 | Visitor | See when a listing was last verified | I know I can trust it | Every listing shows a last-verified date | Must |
| US-08 | Visitor | Report a wrong number or closed facility | It gets fixed for others | Report form submits in under 3 taps, no account needed | Must |
| US-09 | Visitor | Share the emergency list on WhatsApp | My family has it ready | Share button sends a text list with numbers via WhatsApp | Must |
| US-10 | Field verifier | Record a call or visit on my phone | Verification is logged as I work | Verifier can log result, date, notes and photo from a phone | Must |
| US-11 | Editor | See listings due for re-check | Nothing goes stale | Dashboard lists listings past or near their re-check date | Must |
| US-12 | Editor | Review and resolve user reports | Problems are fixed within 24 hours | Report queue shows new reports; resolving logs who and when | Must |
| US-13 | Visitor | Use the site on a slow connection | It works when I need it | Home and Emergency pages load within targets in NFR-01 | Must |
| US-14 | Visitor in an emergency | Share my exact location with one tap | Family or responders can find me | Tapping Share my location sends a Google Maps link of my position via WhatsApp or SMS | Must |
| US-15 | Visitor needing blood | Find the nearest blood bank and which blood groups it usually supplies | I can get blood for a patient quickly | Find blood shows blood banks nearest first, with blood groups, hours, Call button and a "call to confirm stock" note | Must |
| US-16 | Visitor who wants to donate | Find where and how to donate blood | I can help save a life | Donate blood page shows centres accepting donors, basic eligibility, and Call and Directions buttons | Must |
| US-17 | Facility owner | Sign up, confirm my email and phone, and ask to link my facility | I can keep its details right | I can sign up, my email and phone are confirmed by codes, and staff approve the link before I can edit (spec: `specs/2026-10-23-accounts-and-facility-ownership/`) | Must |
| US-18 | Admin | Approve or reject staff sign-ups and choose their role | Nobody gets access by signing up | A staff sign-up has no access until I approve it as editor or verifier | Must |
| US-19 | Editor | Phone a facility and approve its owner | Only the real owner edits it | An owner link stays pending until I approve it with a note of who I reached | Must |
| US-20 | Facility owner | Report that my facility moved or closed | People are not sent to the wrong place | A move keeps the address history and hides the listing until staff re-check it; a closure hides it and keeps the record | Must |
| US-21 | Account holder | Change my password, recover it, or close my account | My account stays safe and mine | Change needs the current password; forgot-password uses an email code; closing anonymises my data | Should |

## Functional requirements: public website

**Home and navigation**

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-01 | Search home asks "What do you need?" with two large choices, Find a healthcare facility and Get emergency help; below them, a search box and category shortcuts (Hospitals, Clinics, Pharmacies, Maternity, Labs) | Must |
| FR-02 | A red Emergency button stays visible on every page | Must |
| FR-03 | The site asks for location permission once; if refused, the user can pick an area from a list | Must |

**Search and results**

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-04 | Search by facility name, category or service, tolerant of misspellings | Must |
| FR-05 | Filters: category, service, open now, open 24 hours, distance | Must |
| FR-06 | Results sort by distance by default; each result shows name, category, distance, open/closed status, and Call and Directions buttons | Must |
| FR-07 | Results can switch between list view and map view | Should |
| FR-08 | Only published listings within their re-check cycle appear; overdue listings show a "verification due" label | Must |

**Listing page**

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-09 | Shows name, category, address, landmark, phone numbers, opening hours by day, services, estimated fee ranges with date collected, entrance photo, last-verified date | Must |
| FR-10 | Call button for each phone number (tel: link); Directions button (Google Maps link from GPS pin) | Must |
| FR-11 | Fees are always labelled "Estimate — confirm with the facility" | Must |
| FR-12 | Share listing via WhatsApp or copy link | Should |
| FR-13 | Disclaimer on every listing: SwiftHealth is a directory and does not give medical advice | Must |
| FR-47 | A WhatsApp button beside Call for each number marked as a WhatsApp number (wa.me link, no location in the message) | Should |

**Emergency section**

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-14 | 112 national emergency line shown first and always | Must |
| FR-15 | Contacts grouped, in this order: Ambulance, Fire service, Police, Hospital emergency (24 hours), Road accidents (these five are always shown, empty or not), Security, Disaster and flooding, Sexual and gender-based violence support, Mental health crisis support (these four only when they have a contact) — owner, 2026-10-22, `specs/2026-10-22-swiftrescue-groups/`. ~~Blood banks~~ **Blood banks removed from this list 2026-10-22 (owner):** they are listed only on Find blood (FR-27); SwiftRescue has a "Need blood urgently?" link card to it | Must |
| FR-16 | Each contact shows name, area, distance (if location allowed), Call button and last-verified date | Must |
| FR-17 | The Emergency page is cached for offline use after the first visit | Must |
| FR-18 | "Share emergency list" sends a plain-text list of numbers via WhatsApp or SMS | Must |
| FR-19 | No paid or sponsored placement is ever shown in the Emergency section | Must |
| FR-24 | "Share my location" button: gets the phone's position (with permission) and sends a Google Maps link via WhatsApp or SMS; the location is never stored by SwiftHealth | Must |
| FR-25 | ~~Emergency section shows nearby 24-hour pharmacies (listings with is\_24\_hours confirmed on site), nearest first~~ **Removed 2026-10-22 (owner):** pharmacies are not part of SwiftRescue; they stay findable through search and Find by type (`/search?category=pharmacy`, `is_24_hours`) | Removed |
| FR-26 | SwiftRescue (emergency) page shows: "SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In danger, call 112." | Must |
| FR-27 | Find blood: lists blood banks and hospitals with blood bank services, nearest first, with blood groups they usually supply (stored as services, with the date confirmed), hours, Call and Directions, and the note "Stock changes daily; call to confirm before you go" | Must |
| FR-28 | Donate blood: lists blood banks and centres that accept donors, with donation hours, Call and Directions | Must |
| FR-29 | Donate blood page shows basic donor eligibility and preparation guidance, based on National Blood Service Agency guidance and reviewed by the medical advisor, ending with "The blood bank will confirm if you can donate" | Must |

**Reporting problems**

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-20 | Every listing and contact has a "Report a problem" link | Must |
| FR-21 | Report reasons: number not working, wrong number, facility closed, moved, wrong hours, other (with optional comment and optional phone number) | Must |
| FR-22 | A contact reported "not working" by 2 different users within 7 days is automatically flagged for urgent re-check | Must |

**Information pages**

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-23 | About, How we verify, Privacy policy, Terms of use, Contact us, and "List your facility" form for providers | Must |

## Functional requirements: admin panel and verification

Every listing moves through five statuses, and only Published listings are visible to the public.

| Status | Meaning | Moves to |
| --- | --- | --- |
| Draft | Added, not yet checked | Pending review (after a successful call and visit) or Failed |
| Pending review | Verifier has checked it; editor must approve | Published or back to Draft |
| Published | Live on the site | Re-check due (when the cycle expires) or Hidden |
| Re-check due | Cycle expired or urgent flag raised | Published (re-verified) or Hidden (failed) |
| Hidden | Failed verification or closed; not public | Draft (to re-verify) |

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-30 | Staff log in with email and password plus a one-time code (two-factor) | Must |
| FR-31 | Add and edit listings with all fields in the data model; GPS pin can be set from the verifier's phone location | Must |
| FR-32 | Verification log: for each check, record method (call or visit), date, result, person reached, notes and optional photo | Must |
| FR-33 | Re-check cycle set per category: emergency contacts every 14 days, other listings every 45 days | Must |
| FR-34 | Dashboard shows listings by status, re-checks due this week, overdue re-checks, and open reports | Must |
| FR-35 | Report queue: view, assign, resolve, or dismiss reports; reports urgent-flagged by FR-22 appear at the top | Must |
| FR-36 | When a published listing fails re-check, it moves to Hidden automatically and the editor is notified | Must |
| FR-37 | Provider submissions from the "List your facility" form arrive as Drafts (since accounts phase 7 the form needs a provider account and also creates a pending owner link, FR-50, FR-51) | Must |
| FR-38 | Audit log records who changed what and when, for every listing | Must |
| FR-39 | Bulk import of listings from a spreadsheet (CSV) for starting data | Should |
| FR-40 | Export listings and verification logs to CSV | Should |
| FR-41 | Admin manages staff accounts and roles | Must |
| FR-42 | Admin panel works on a phone so verifiers can use it in the field | Must |

## Functional requirements: providers and featured listings

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-43 | Providers log in like staff and can view and edit only their own listing; changes to phones or hours trigger an urgent re-check | Must |
| FR-44 | Providers can pay for a 30-day featured listing with Paystack (test mode in the MVP); payment is confirmed only by a verified Paystack webhook | Must |
| FR-45 | At most one featured listing appears first in matching search results, labelled "Sponsored"; never in SwiftRescue | Must |
| FR-46 | Every payment is recorded in the audit log with its Paystack reference, and repeated webhooks never double-apply | Must |

## Functional requirements: accounts and facility ownership

Feature folder: `specs/2026-10-23-accounts-and-facility-ownership/` (owner's answers of 2026-10-24). Built in phases, one pull request each; a row is built when its phase is merged.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-48 | Anyone can sign up as Staff or Facility owner; the account works only after the email (code by Resend) and the phone (code by SMS) are confirmed; sign-up never says whether an email is already registered | Must |
| FR-49 | A staff sign-up is "pending" and has no access until an admin approves it as editor or verifier, or rejects it | Must |
| FR-50 | A provider can register a new facility or claim an existing listing; staff phone the facility and approve the owner link before the provider can edit (many owners per facility, many facilities per owner) | Must |
| FR-51 | `/list-your-facility` needs a logged-in provider account and every submission is linked to the account that sent it; searching, calling and SwiftRescue need no account | Must |
| FR-52 | A listing can be a branch of another listing (one level) | Should |
| FR-53 | A move keeps an address history (old, new, date, who) and hides the listing until staff re-check it; a closure hides the listing and keeps the record; nothing is deleted | Must |
| FR-54 | A logged-in person can edit their profile, change their password, reset a forgotten password by email, and close their account | Must |
| FR-55 | An admin sees all accounts (with last login), the pending staff, approves, rejects, suspends and reactivates (never deletes), and sees an activity log of who did what and when | Must |
| FR-56 | One password rule for every way an account gets a password: at least 8 characters for a provider, at least 10 for a verifier, editor or admin, at most 128, not a very common password, not the email; a provider made staff gets a new password of at least 10 | Must |
| FR-57 | The login code screen shows the phone mostly hidden ("••• ••• 4567"), has a "Send a new code" button (60 seconds between sends, at most 5 codes per account per hour, enforced by the server) and a "Start again" link | Must |
| FR-58 | A person can switch on an authenticator app (standard time-based codes, QR code, 10 backup codes) for a free second step instead of an SMS code; the secret is encrypted in the database; SMS (or an email code while Termii is off) stays the fallback | Must |
| FR-59 | Listing a facility stays free and staff can add any facility; a facility owner pays a monthly fee (setting `OWNER_FEE_NAIRA`, ₦10,000.00 to start; Paystack test mode in the MVP) to claim and manage a listing; the request reaches staff only after the first payment is confirmed by a verified Paystack webhook. Paying never buys the verified badge or a better place in search | Must |
| FR-60 | The fee is paid one calendar month at a time with email reminders 7, 3 and 1 days before the month ends (no automatic charge). After a grace period (setting, 7 days) the owner can no longer edit; the listing stays public, free and unchanged; paying again restores editing without a new staff approval | Must |
| FR-61 | If staff reject a paid claim, the payment is given back in full automatically (a refund that fails is kept and tried again every night); an owner can stop managing at any time (editing goes on to the end of the paid month, no refund of it) | Must |
| FR-62 | Every fee payment and refund is recorded in the audit log with its Paystack reference and a repeated webhook never applies twice; the owner gets an email receipt and sees a list of their payments | Must |
| FR-63 | Staff sign-up and staff accounts are never charged; Featured (FR-44, FR-45) stays a separate optional extra that needs an owner whose fee is current | Must |
| FR-64 | The wording about the fee on the Terms, "For facilities", the home page and "List your facility" is reviewed by a lawyer before it goes live (the current "free during our launch" sentences stay until then) | Must |

## Data model

The MVP needs nine core entities. A Listing covers both health facilities and emergency contacts, told apart by category.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Listing | id, slug, name, category\_id, area, address, landmark, latitude, longitude, description, status, is\_24\_hours, entrance\_photo\_url, owner\_id, created\_by, featured\_until, last\_verified\_at, next\_check\_due, created\_at, updated\_at | One record per facility or emergency contact |
| Category | id, name, parent, is\_emergency, recheck\_days | e.g. Pharmacy, Hospital, Ambulance; sets the re-check cycle |
| Phone number | id, listing\_id, number, label (e.g. Front desk, Emergency), is\_primary, last\_working\_at | A listing can have several numbers |
| Opening hours | id, listing\_id, day\_of\_week, opens\_at, closes\_at, is\_closed | One row per day; 24-hour flag on Listing |
| Service and fee | id, listing\_id, service\_name, fee\_min\_naira, fee\_max\_naira, fee\_collected\_at | Fees optional, stored as Decimal (2 places), always with the date collected; blood groups are stored here for blood banks |
| Verification check | id, listing\_id, staff\_id, method (call/visit), result (pass/fail), person\_reached, notes, photo, checked\_at | Full history kept |
| User report | id, listing\_id, reason, comment, reporter\_phone (optional), reporter\_key, status, created\_at, resolved\_by, resolved\_at | Reporter phone and reporter\_key deleted after resolution. reporter\_key is a keyed hash used to count different reporters, never the raw phone or IP |
| User | id, name, email, phone, password\_hash, role (verifier, editor, admin, provider), is\_active, created\_at, last\_login\_at | Staff and provider accounts; no public user accounts in the MVP |
| Audit entry | id, user\_id, listing\_id, action, field\_changed, old\_value, new\_value, reference, changed\_at | Written on every change; also records Paystack payments by reference |

| Facility owner link | id, listing\_id, user\_id, role (owner, manager), status (pending, approved, removed), requested\_at, approved\_by, approved\_at, removed\_at, removed\_by, note | The 10th table (accounts phase 6, approved by the owner on 2026-10-24). One row per listing and person; a provider edits or pays only through an approved link. The note is who staff reached on the phone |

Areas (e.g. Independence Layout, New Haven, Trans-Ekulu) are a fixed list in the API settings so search by area stays consistent. The code for all 10 tables is in `backend/app/models/`.

## Non-functional requirements

The site must work well on low-cost Android phones and slow, expensive mobile data, and protect the little personal data it holds.

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| NFR-01 | Performance | Home and Emergency pages load in under 3 seconds on a 3G connection; first page weight under 500 KB | Must |
| NFR-02 | Performance | Search results return in under 1 second for the pilot dataset | Must |
| NFR-03 | Offline | Emergency page and its numbers work offline after one visit (installable web app) | Must |
| NFR-04 | Devices | Works on Android 8+ in Chrome and Opera Mini; also iPhone Safari; screens from 320 px wide | Must |
| NFR-05 | Availability | 99.5% uptime per month; Emergency page served from a CDN so it stays up if the server is down | Must |
| NFR-06 | Security | HTTPS everywhere; staff two-factor login; passwords hashed; role-based access; rate limiting on report form | Must |
| NFR-07 | Privacy | Comply with the Nigeria Data Protection Act 2023: privacy policy, minimal data, reporter phone optional and deleted after use, no selling of personal data | Must |
| NFR-08 | Data accuracy | No published listing older than its re-check cycle without the "verification due" label | Must |
| NFR-09 | Backups | Daily automatic database backups kept for 30 days; restore tested monthly | Must |
| NFR-10 | Accessibility | Large tap targets (at least 48 px), readable text (16 px minimum), good colour contrast, works with screen readers | Must |
| NFR-11 | Language | English at launch; text stored so Igbo can be added without code changes | Should |
| NFR-12 | SEO | Each listing has its own page and URL so people find it on Google | Should |
| NFR-13 | Liability | Disclaimers on listings and Emergency page; terms reviewed by a lawyer before launch | Must |

## Technology

The stack is fixed in `CLAUDE.md`: Next.js (App Router, TypeScript, Tailwind, shadcn/ui) for the web app, FastAPI with SQLModel, Alembic and PostgreSQL for the API, Docker Compose locally, Netlify and Render in production, with Paystack, Cloudinary, Resend, Termii and Leaflet/OpenStreetMap.

## Analytics

The MVP tracks anonymous events only, no personal profiles: searches (term, category, filters), listing views, Call taps, Directions taps, Emergency page opens, emergency list shares, and reports submitted. These feed the monthly metrics: monthly active users, calls and directions made, and share of numbers working at re-check.

## Release criteria

The MVP launches only when all of these are true:

- [ ] All Must requirements pass testing on a low-cost Android phone on 3G
- [ ] Every facility in the pilot area is verified and published, at least \[\_\_\] listings
- [ ] Every emergency contact verified within the last 14 days
- [ ] 112 tested and shown on the Emergency page
- [ ] Privacy policy, terms and disclaimers reviewed by a lawyer
- [ ] Medical advisor has reviewed all health wording
- [ ] Backups and restore tested
- [ ] At least \[\_\_\] residents have tested the site and their feedback is handled

## Out of scope for the MVP

Public user accounts, patient reviews, native Android app, appointment and lab booking, pharmacy stock and delivery, a donor registry where people sign up to be contacted when their blood group is needed, Igbo language, USSD, and any diagnosis or symptom checking. These are planned in later phases as set out in the Project Overview. Phase 3 also adds, once partnerships are confirmed: hospital bed and service availability, ambulance requests, live blood stock from partner blood banks, groups needed by donation centres, and the donor registry (with explicit consent under the NDPA, opt-out at any time, and its own table).

## Open questions

- [ ] Which pilot area do we start with?
- [x] Exact re-check cycles for emergency and other listings? Decided in FR-33: 14 days and 45 days.
- [ ] Will we show fees at launch if few facilities share them?
- [ ] Who is the medical advisor and who reviews legal terms?
- [ ] Final domain (swifthealth.ng or similar)?
- [x] Price of a basic listing? **Free during launch** (owner decision, 2026-10-13; the home page says "Listing is free during our launch"). Paying never
  buys the verified badge. Featured listings stay as FR-44 and FR-45 say: at most one, clearly labelled "Sponsored", never in SwiftRescue (FR-19).
  Possible paid extras later: more photos, a monthly call and visit report.
- [ ] Featured listing price? Placeholder: ₦5,000.00 per month (to be confirmed).
