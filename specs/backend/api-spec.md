# SwiftHealth API specification

The contract for every API endpoint. Build from this file; if something here is unclear or missing,
update the spec first, then the code. FastAPI generates the live OpenAPI spec at `/docs` from the code.

Requirement IDs (US-xx, FR-xx, NFR-xx) refer to the PRD.

---

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Base URL | Local: `http://localhost:8000` · Production: `https://swifthealth-api.onrender.com` |
| Format | JSON in and out (except CSV import/export) |
| Auth | `Authorization: Bearer <access_token>` on staff and provider endpoints. Public endpoints need no token. |
| Times | Stored and returned in UTC, ISO 8601 (`2026-10-07T14:30:00Z`). Opening hours are local Nigerian time (`HH:MM`). "Open now" is always calculated in `Africa/Lagos`. |
| Phone numbers | Returned as `+234XXXXXXXXXX`. Accepted as `0803…` or `+234803…` and normalised. |
| Money | Naira as exact decimals with 2 places, never floats. Sent and returned as strings, e.g. `"fee_min_naira": "2000.00"`. Stored as `Decimal` / PostgreSQL `NUMERIC(12,2)`. Converted to kobo (integer) only for Paystack. |
| IDs | Integers. Public pages use `slug` instead of `id`. |
| Pagination | `limit` (default 20, max 100) and `offset` (default 0). List responses return `{ "items": [...], "total": n }`. |
| Distance | Kilometres, rounded to 1 decimal, e.g. `1.4` |

### Error format

Every error returns:

```json
{ "detail": "Human-readable message" }
```

| Status | When |
| --- | --- |
| 400 | Request is valid JSON but breaks a rule (e.g. publishing a listing with no passing check) |
| 401 | Missing, invalid or expired token |
| 403 | Logged in, but role or ownership does not allow this |
| 404 | Not found, or not visible to this caller (the public gets 404 for unpublished listings) |
| 409 | Conflict (e.g. email already used, slug already taken) |
| 422 | Input fails validation (FastAPI default; includes field errors) |
| 429 | Rate limit reached |

### Roles

`verifier`, `editor`, `admin`, `provider`. The public (visitor) has no account.
"Staff" below means verifier, editor or admin. Admin can do everything an editor can.

### Trust rules (apply to every public endpoint)

1. Only listings with `status = "published"` are returned.
2. Listings whose `next_check_due` has passed are still returned until the nightly job runs, with `verification_due: true`.
3. Emergency results never include sponsored placement.

---

## 2. Shared response shapes

### ListingSummary

Used in search results, emergency groups and blood results.

```json
{
  "id": 12,
  "slug": "night-pharmacy-a",
  "name": "Night Pharmacy A",
  "category": { "slug": "pharmacy", "name": "Pharmacy" },
  "area": "New Haven",
  "address": "12 Example Road",
  "latitude": 6.452,
  "longitude": 7.51,
  "distance_km": 1.4,
  "is_open_now": true,
  "is_24_hours": false,
  "primary_phone": "+2348030000000",
  "last_verified_at": "2026-10-01T10:00:00Z",
  "verification_due": false,
  "sponsored": false,
  "hours_note": "Closes 9:00 PM"
}
```

- `distance_km` is `null` when the caller sends no location.
- `sponsored` is `true` only for a featured listing shown in a sponsored slot (see `/search`).
- `hours_note` is a short English text for the next change in opening hours, worked out in Africa/Lagos time, or `null`
  ([feature](../2026-10-10-next-open-close-time/requirements.md)). `/search` and `/emergency` fill it; the blood lists return `null`
  until they are built to fill it. It always agrees with `is_open_now`: it starts with "Closes" when the listing is open now and
  with "Opens" when it is closed. The forms are: "Closes 9:00 PM", "Closes 2:00 AM tomorrow", "Closes at midnight", "Opens 7:30 AM",
  "Opens 7:30 AM tomorrow", "Opens Monday 7:30 AM", "Opens at midnight", "Opens Monday at midnight". Times are 12-hour with
  minutes and no leading zero ("9:00 PM", "12:30 PM"); 00:00 is written "midnight" and has no clock time. The day is left out
  for a change later today, is "tomorrow" for the next Lagos date, and is the full day name for a later date. Midnight at the
  start of tomorrow means the coming midnight, so it has no day word ("Opens at midnight"); midnight at the start of a later
  day names the day ("Opens Monday at midnight"). Two shifts that meet at midnight (one ends at 00:00 and the next day starts at
  00:00) count as one opening. It is `null` for a 24-hour listing (the badge already says "Open 24 hours"), for a listing with
  no hours recorded (no rows, only closed days, or rows without times), and when nothing changes within the next 7 days.

### ListingDetail

`ListingSummary` plus:

```json
{
  "landmark": "Opposite the market",
  "description": "Open late every day.",
  "entrance_photo_url": "https://res.cloudinary.com/...",
  "phones": [ { "number": "+2348030000000", "label": "Front desk", "is_primary": true, "is_whatsapp": false } ],
  "opening_hours": [
    { "day_of_week": 0, "opens_at": "20:00", "closes_at": "02:00", "is_closed": false },
    { "day_of_week": 1, "opens_at": null, "closes_at": null, "is_closed": true }
  ],
  "services": [
    { "name": "Malaria test", "fee_min_naira": "1500.00", "fee_max_naira": "3000.00", "fee_collected_at": "2026-09-28" }
  ],
  "recently_reported_not_working": false,
  "disclaimer": "SwiftHealth Route is a directory and does not give medical advice. Fees are estimates; confirm with the facility."
}
```

(The `opening_hours` example shows 2 of the 7 entries.)

- `opening_hours` always has 7 entries, in order, `day_of_week` 0 = Monday … 6 = Sunday. `opens_at` and `closes_at` are `"HH:MM"` in 24-hour local time (Africa/Lagos), without seconds. `closes_at` earlier than `opens_at` means the shift runs past midnight.
  A day with no row, a day marked closed, and a day whose row has no opening or closing time are all returned as `"is_closed": true` with `opens_at` and `closes_at` set to `null` (owner's decision, 2026-10-11: a day with no hours is shown as closed). If a day has more than one row, the one with the lowest `id` is used. The page writes the times in 12-hour form ("8:00 PM"); the API never does.
- `phones` lists every number of the listing, the primary one first, then the others in the order they were added (by `id`). `number` is always `+234…`. `primary_phone` (from `ListingSummary`) is the number of the first primary phone, or `null`.
  `is_whatsapp` (FR-47) is `true` only when someone who knows (staff or the provider) has said that this number is on WhatsApp; it
  is `false` by default and is never guessed from the number (owner's decision, 2026-10-11). It is the `is_whatsapp` column of
  `phone_numbers` (a new column with a migration, not a new table). The page shows a WhatsApp button for those numbers only.
- `services` are sorted by name (ignoring case), then by `id`. `fee_min_naira` and `fee_max_naira` are strings with 2 decimals, or `null`; `fee_collected_at` is `YYYY-MM-DD`, or `null`. The API sends what is stored: it does not fill a missing maximum from the minimum. How the page words them is a UI matter.
- `recently_reported_not_working` is `true` when at least 2 different reporters called the listing "not working" in the last 7 days: the rule that hides the listing from `/search` (FR-22, same window and count). The listing itself is still returned (owner's decision, 2026-10-11: a direct link keeps working, and the page shows a notice). Nothing about the reports themselves (who, when, comments, phone) is ever returned.
- `is_open_now`, `verification_due`, `last_verified_at` and `hours_note` are worked out exactly as for `/search`. `distance_km` is always `null` (the call has no position) and `sponsored` is always `false`.
- `disclaimer` is the fixed text above on every listing (FR-13). The fee label "Estimate — confirm with the facility" (FR-11) is the page's, next to each fee.
- Never returned: `status`, `next_check_due`, `owner_id`, `created_by`, `featured_until`, report details.

### UserRead

```json
{ "id": 3, "name": "Ada Verifier", "email": "ada@example.com", "phone": "+2348030000001", "role": "verifier", "is_active": true }
```

`password_hash` is never returned.

---

## 3. Public endpoints (no login)

### GET /health
Liveness check. **Response 200:** `{ "status": "ok" }`

### GET /meta
Lists for filters and forms.
**Response 200:**
```json
{
  "areas": ["Independence Layout", "New Haven", "..."],
  "categories": [ { "slug": "pharmacy", "name": "Pharmacy", "is_emergency": false } ],
  "services": ["Consultation", "Malaria test", "X-ray"],
  "blood_groups": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  "report_reasons": ["not_working", "wrong_number", "closed", "moved", "wrong_hours", "other"],
  "service_catalogue": ["Antenatal care", "Blood bank", "Consultation", "X-ray"],
  "signup_open": false,
  "featured_price_naira": "5000.00"
}
```
`featured_price_naira` (the "For facilities" page, 2026-10-27) is the price of 30 days as featured, from the setting `FEATURED_PRICE_NAIRA`, as a string with 2 decimals (the same value as `featured_price_naira` in `/provider/listing` and the amount sent to Paystack). It is public: a price list is not a secret, and the page shows it before anyone has an account.
`signup_open` (owner, 2026-10-26) is true when the sign-up routes of section 4c would answer, i.e. exactly when sign-up is open: `SIGNUP_ENABLED` is true and, outside development, Resend is set up. It is one boolean computed by the same function as the 503 rule of 4c (`signup_service.signup_is_open`), and it says nothing else about the configuration: no key, no address. The site's header and login page read it to show the **Sign up** link only while sign-up is open.
`service_catalogue` is the fixed list of service names that staff may pick for a listing (phase 10, decision C1 in
`specs/2026-10-20-staff-screens/requirements.md`): a list in `core/service_catalogue.py`, in alphabetical order, with the blood groups
left out (they come from `blood_groups`). It is different from `services`, which are the names in use on published listings.
`areas` keep the order of the fixed list in `core/config.py`. `categories` are all rows of the categories table, sorted by
`id`. Every database has all 12 categories of the seed (the five everyday ones and the seven emergency ones, FR-01 and FR-15): an
idempotent data migration adds any that are missing, so production does not depend on which demo listings it has
([feature](../2026-10-10-reference-categories/requirements.md)). `services` are the distinct service names of **published** listings, sorted alphabetically without regard to case, one
entry per service, and without the blood groups (blood groups are stored as service rows, see `blood_groups`). **Same service
rule:** two names are the same service when they are equal after trimming spaces at both ends, joining runs of spaces into
one, removing hyphens and lower-casing (`X-ray`, `x-ray`, ` X-ray ` and `Xray` are one service; `X ray` is another). The label
shown is the first spelling in plain alphabetical order, with no spaces at the ends and one space between words (`X-ray` before
`Xray`; capitals sort before small letters, so an all-capitals spelling such as `X-RAY` would win). They are the choices for the `service` filter of
`GET /search`, which uses the same rule, so picking a choice finds every listing whose service is saved in any of those
spellings. `blood_groups` is a fixed list in `core/config.py`.
`report_reasons` are the report reasons in the order shown. No login.

### GET /search — the hard part
FR-04 to FR-08, US-01, US-05. Open-now, nearest-first search over trusted listings.

**Query parameters**

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `q` | string | – | Matches name, area, service names; tolerant of small misspellings (PostgreSQL `pg_trgm` similarity). Max 100 characters. |
| `category` | string | – | Category slug |
| `service` | string | – | Service name, e.g. `X-ray`. Matches a listing's service by the same-service rule of `GET /meta` (case, spaces at the ends and hyphens ignored: `X-ray` also finds `x-ray` and `Xray`). Typing a name is the job of `q`; this filter is for the choices in `/meta`. |
| `area` | string | – | One of `/meta` areas; any other value is a 422. An unknown `category` or `service` is not an error: it returns an empty list. |
| `open_now` | bool | `false` | Only places open at the current Africa/Lagos time |
| `is_24_hours` | bool | `false` | Only confirmed 24-hour places |
| `lat`, `lng` | float | – | Caller's location. Both or neither, else 422. |
| `radius_km` | float | `10` | Only applies when `lat`/`lng` are sent. Max 50. |
| `limit`, `offset` | int | 20, 0 | Pagination |

**Rules**
1. Apply the trust rules, then exclude listings flagged by FR-22: 2 or more `open` reports with reason `not_working`, made in the last 7 days, with 2 different `reporter_key` values. A report with no `reporter_key` counts for nothing. Resolved and dismissed reports do not count.
2. Apply filters. "Open now" checks today's hours and yesterday's past-midnight shift (see spike).
3. Sort by distance when location is given, otherwise by name.
4. Sponsored slot (FR-45, built in phase 12, decision I11): at most **one** listing with `featured_until` in the future that matches all filters (and is within the radius) and whose category is not an emergency category is placed first with `sponsored: true`. It is the first such listing in the normal order (nearest first with a position, otherwise by name). It is not repeated lower down; `total` is unchanged; paging works on the whole ordered list, so the slot is on page 1 only. `/emergency`, `/blood/*` and the listing page never mark anything sponsored.

**Privacy (NFR-07):** `lat` and `lng` are a visitor's position. They are used for this request only. The server logs must never keep
them: the API access log shows `lat=redacted&lng=redacted`.

**Response 200:** `{ "items": [ListingSummary], "total": 37 }`

**Tests:** past-midnight open/closed (01:30 vs 03:00) · distance order · flagged listing excluded · overdue listing labelled `verification_due` · draft never returned · only one sponsored item · a featured listing comes first with `sponsored: true` and is not repeated · an ended period, an emergency category and a listing that does not match the filters are not sponsored · with two featured listings the first in the normal order wins · `total` and paging stay right.

### GET /listings/{slug}
FR-09 to FR-13, FR-47, US-06, US-07, FR-22. **Path:** `slug` (exact match; no query parameters). **Response 200:** `ListingDetail` · **404** `{ "detail": "Listing not found" }` if there is no listing with this slug, or its `status` is not `"published"` (draft, pending review, hidden and re-check due all look the same to the public, so nothing leaks about unpublished listings). A listing past its re-check date but still published is returned with `verification_due: true` (FR-08). The call changes nothing and writes no audit entry.
**Tests:** published returns 200 with every field · draft, pending, hidden, `recheck_due` and unknown slug return 404 · 7 opening-hours entries (missing day closed, past-midnight row) · primary phone first · `is_whatsapp` per phone (false unless set) · fees as 2-decimal strings, a null fee stays null · overdue listing has `verification_due: true` and is still returned · 2 different reporters in 7 days set `recently_reported_not_working` and the listing is still returned · 1 reporter, an old report, a resolved report, and 2 reports from the same reporter do not · `hours_note` and `is_open_now` agree with `/search` · none of the internal fields appear · the number of database queries does not grow with the number of phones or services.

### GET /emergency
FR-14 to FR-19, FR-26. The SwiftRescue page data. (FR-25, the 24-hour pharmacies, was removed from SwiftRescue on 2026-10-22 by the owner: the answer has no `pharmacies_24h` any more; pharmacies are found with `/search` and Find by type. Decision K6 in `specs/2026-10-22-swiftrescue-order/`.)

**Query:** `lat`, `lng` (optional).

**Response 200:**
```json
{
  "national_line": { "name": "National emergency number", "number": "112" },
  "groups": [
    { "category": { "slug": "ambulance", "name": "Ambulance" }, "contacts": [ListingSummary] }
  ],
  "disclaimer": "SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In danger, call 112."
}
```

**Rules:** `groups` always has all nine groups, in this order (category slugs, headings): Ambulance `ambulance`, Fire service `fire`, Police `police`, Hospital emergency (24 hours) `emergency-unit`, Road accidents `roadside-assistance`, Security `security`, Disaster and flooding `disaster-flooding`, Sexual and gender-based violence support `gbv-support`, Mental health crisis support `mental-health-crisis` (feature `specs/2026-10-22-swiftrescue-groups/`; the headings come from the API's own list, not from the category rows, which carry the same names since the migration of that feature). Which groups the page draws is the page's job: the first five always, the other four only with a contact. (There is no blood bank group since 2026-10-22: blood banks are listed only by `GET /blood/banks`, which SwiftRescue links to; decision M1 in `specs/2026-10-22-blood-only-on-blood-page/`. A listing in the category `blood-bank` is therefore nowhere in this answer.) A group with no contact has `"contacts": []` (the page hides it). Within a group, nearest first if a location is given, otherwise by name (then id). No sponsored placement anywhere: every item has `sponsored: false`, even a listing with `featured_until` in the future (FR-19). The answer has no pharmacy list (no `pharmacies_24h` key). The trust rules of section 1 apply (published only, overdue ones stay with `verification_due: true`) and a listing flagged by FR-22 is left out, as in `/search`. `is_open_now` and `hours_note` are filled as in `/search`. `lat` and `lng` come together or not at all (else 422) and are never logged (NFR-07). `national_line` is a constant of the API, so `112` is present even with an empty database.

**Tests:** 112 always present · all nine groups in order with the new headings, empty ones as `[]` · a published contact in each of the nine categories is in its group · no `blood-bank` group, and a published blood bank is nowhere in the answer · nearest first with a location, by name without · no `sponsored: true` anywhere, even for a featured listing · no `pharmacies_24h` key, and a 24-hour pharmacy is nowhere in the answer · draft, hidden and flagged listings left out · `lat` without `lng` is a 422.

### GET /blood/banks
FR-27, US-15. **Query:** `blood_group` (optional, one of `/meta` blood groups), `lat`, `lng`, `limit`, `offset`.

Returns published blood banks and hospitals with a blood bank service. Each item is a `ListingSummary` plus:
```json
{ "blood_groups": ["O+", "A+"], "blood_groups_confirmed_at": "2026-10-01", "stock_note": "Stock changes daily; call to confirm before you go." }
```
`blood_groups` come from the listing's `services` whose names are blood groups. With `blood_group`, only listings offering that group are returned.

### GET /blood/donation-centres
FR-28, US-16. **Query:** `lat`, `lng`, `limit`, `offset`.

Returns published listings with a `Blood donation` service, as `ListingSummary` plus `donation_hours` (their opening hours). Groups needed by a centre are not in the MVP (Phase 3).

**Phase 8 rules for both blood endpoints** (feature `specs/2026-10-20-blood/`, decisions F1 to F5). The answer of each is `{ "items": [...], "total": n }`. The trust rules of section 1 apply (published only, overdue stays with `verification_due: true`) and a listing flagged by FR-22 is left out. Nothing is sponsored (`sponsored: false`). `is_open_now` and `hours_note` are filled as in `/search`. Nearest first with `lat` and `lng` (both or neither, else 422), otherwise by name then id; no distance limit; `limit` 1 to 100 (default 20), `offset` from 0. `blood_group` that is not one of the eight groups of `/meta` is a 422.
- **Blood banks:** a published listing in the category `blood-bank`, or any published listing that has a service named "Blood bank" or at least one blood group among its services (matched by the same-service rule of `/meta`). `blood_groups` are the listing's services whose name is one of the eight groups (same rule), in the order A+, A-, B+, B-, AB+, AB-, O+, O-; `blood_groups_confirmed_at` is the newest `fee_collected_at` among those rows (`YYYY-MM-DD`, or `null`). With `blood_group`, only listings that offer that group.
- **Donation centres:** a published listing with a service named "Blood donation" (same rule). `donation_hours` is the 7-entry week of the listing page (`day_of_week` 0 = Monday, `opens_at` and `closes_at` as `HH:MM` or `null`, `is_closed`).
**Tests:** only published, unflagged listings · a hospital with a "Blood bank" service or a blood group is in, a plain hospital is out · groups in order and spelling-tolerant · the confirmed date · the group filter and its 422 · nearest first and A to Z · paging and total · nothing sponsored · half a location is 422 · the number of queries does not grow with the number of listings.

### POST /reports
FR-20 to FR-22, US-08. Report a problem. No login. Rate limited to 5 per IP per hour (429).

**Request:**
```json
{ "listing_id": 12, "reason": "not_working", "comment": "Rang twice, no answer", "reporter_phone": "08030000000" }
```
`comment` and `reporter_phone` are optional.

**Response 201:** `{ "id": 88, "message": "Thank you. We will check this listing." }`

**Rules:** `listing_id` must be published (else 404, the same answer as for an unknown id). `reason` is one of the `/meta` `report_reasons` (else 422). `comment` is at most 500 characters (blank counts as none). `reporter_phone` is normalised to `+234…` and stored; a value that is not a Nigerian number is a 422. The report stores `reporter_key`: the keyed hash `hash_reporter_key` of the normalised phone if given, else of the client IP (never the raw IP). If this makes 2+ `not_working` reports from different reporters (different `reporter_key`) within 7 days, set the listing to `recheck_due` and `next_check_due` to now, write an audit entry (no user, action `flag`, field `status`, old `published`, new `recheck_due`, reference `auto-flag`), and tell the staff in the background: an email to every active editor and admin (Resend) and an SMS to every active admin with a phone (Termii). The messages hold the listing name only, never the comment or the reporter. A failed email or SMS never fails the report. With no Resend or Termii key nothing is sent (logged without personal data). The rate limit is 5 reports per client IP per hour, in memory.

**Tests:** creates report · reporter key is a hash, not the phone or IP · auto-flag after second report from a different reporter, not from the same one · an unpublished or unknown listing is 404 · bad reason, long comment, bad phone are 422 · the staff alert holds no personal data · rate limit returns 429.

### POST /facility-submissions
**Replaced in accounts phase 7 (D14): this route now always answers 401 and writes nothing; use `POST /provider/facilities` (see "Phase 7" in section 7). The text below is the old behaviour, kept for the record.**

FR-37. "List your facility" form. No login. Rate limited to 3 per IP per day.

**Request:**
```json
{
  "facility_name": "Example Clinic", "category": "clinic", "area": "Trans-Ekulu", "address": "4 Example Street",
  "phone": "08030000000", "contact_name": "Dr. Example", "contact_email": "owner@example.com", "notes": "Open 24 hours"
}
```
**Response 201:** `{ "message": "Thanks. Our team will verify your facility before it is listed." }`

**Rules:** creates a `draft` listing (no `created_by`, no `description`) with the submitted name, category, area, address and phone (stored as the primary number). `facility_name` 2 to 120 characters, `address` 3 to 200, `notes` at most 500; `category` must be an everyday category (not an emergency one) else 422; `area` must be in `/meta` areas; `phone` is required and must be a Nigerian number (422); `contact_email` is checked with a simple pattern. The map pin is the centre of the pilot city (`DEFAULT_MAP_CENTRE` in `core/config.py`), because a listing cannot have no position; the verifier sets the real pin. **The contact name, email and notes are never put in `description`** (it is public once the listing is published, and they are personal data, NDPA): they are written in an audit entry (`submission`, field `contact`) that only staff can read. A second audit entry `create` is written with no user. 3 submissions per client IP per day, in memory (429 "You've sent several submissions. Please try again tomorrow."). **Tests:** creates a draft with no created_by, the pin is the default, the contact details are not in the listing's description and not in any public answer, an emergency category is 422, a bad phone or email is 422, the fourth submission is 429.

---

## 4. Auth

Login is two steps: password, then a 6-digit code by SMS through Termii. Termii has no sandbox: locally with no key
the code is logged to the console; real sending needs a live account with the DND route activated and an approved
sender ID. The code is never stored in the database; it travels inside a short-lived signed `challenge_token`, so no
extra table is needed.

### POST /auth/login
**Request:** `{ "email": "ada@example.com", "password": "..." }`

**Response 200:** `{ "challenge_token": "<jwt, 5 min>", "sent_to": "+234******0001", "method": "sms", "can_use_sms": false }`. **`method` (FR-58, owner's answers D18 and D19, 2026-10-24) says what the second step asks for:**
- `"totp"`: the person has switched on the **authenticator app**. **Nothing is sent** (no SMS, no email: it is free); `sent_to` is `null`; the challenge token holds no code. `can_use_sms` is true only when Termii is set up (`TERMII_API_KEY`) and the person's phone is confirmed: then `POST /auth/use-sms` may be used.
- `"sms"`: a 6-digit code was sent by SMS (as before). With no Termii key (development, or production today) the code is only logged.
- `"email"`: a 6-digit code was sent by **email** (`sent_to` is `a***@example.com`). Used for a person **without the app** when **Termii is not set up and Resend is** (so a new account is never left with no way to log in); no phone is needed. Termii set up always means `"sms"`.

**Rules:** wrong email or password → 401 with the same message for both. Inactive user → 403 (checked only after the password is correct). **Account state (FR-48, FR-49, owner's plan of 2026-10-24):** a user that is not ready is also refused with 403 and a plain sentence in `detail`, after the password is correct and before any SMS: "This account is closed.", "This account was not approved.", "This account is waiting for approval by an admin.", "This account is deactivated.", "Confirm your email address first.", "Confirm your phone number first." (`users.approval_status`, `closed_at`, `is_active`, `email_verified_at`, `phone_verified_at`; checked in this order). Every account that exists before the sign-up work is approved with both confirmed. User with no phone number → 400. Sends the code by SMS; if no Termii key is set (local dev), logs the code to the API console instead. If the SMS cannot be sent → 502 `"Could not send the code. Try again."` and no challenge token is returned. Wrong-password and unknown-email requests take the same time (an unknown email still runs a dummy password check). Rate limited to 10 attempts per IP per 15 minutes → 429.

### POST /auth/resend-code
FR-57 (owner's request, 2026-10-24). A new login code for the person who is on the code step, **without sending the password again**.

**Request:** `{ "challenge_token": "<the current token>" }`. **Response 200:** the same as `POST /auth/login`: `{ "challenge_token": "<a new jwt, 5 min>", "sent_to": "+234******0001" }`.

**Rules:**
- The token must be a valid, unexpired login challenge: any other, expired or tampered token → 401 `"Invalid or expired code"`. After 5 minutes the person starts again with `/auth/login`. The older code is **not** cancelled (nothing is stored): it works until its token expires.
- The account is checked again: deactivated → 403, not ready (account state) → 403 with the sentence, no phone → 400.
- **At least 60 seconds after the previous send.** The token carries its send time (`sent_at`, the API's clock). Sooner → **429** `"Wait N seconds before asking for a new code."` with the header `Retry-After: N`, and no SMS.
- **At most 5 codes per account per hour, the first one counted, and a new login counts too** (`POST /auth/login` also answers 429 `"Too many codes. Try again in M minutes."` for the sixth). `Retry-After` is in seconds. The count is in the API's memory (per instance, forgotten at a restart): a cost limit, not a security control. Other accounts are not affected.
- The per-address limit of `/auth/login` (10 calls in 15 minutes) applies to this route too.
- SMS cannot be sent → 502 `"Could not send the code. Try again."`, no token. Nothing about the code, the phone or the tokens is logged.

### POST /auth/verify-code
**Request:** `{ "challenge_token": "...", "code": "482913" }`

**Response 200:**
```json
{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 300, "user": UserRead }
```
**`expires_in` is the idle limit of the account's role (2026-10-29, `specs/2026-10-29-idle-sign-out/`):** 300 seconds for an `admin`, 900 for every other role (settings `IDLE_MINUTES_ADMIN`, default 5, and `IDLE_MINUTES_OTHER`, default 15; each at least 2). The token expires that long after it was made; `POST /auth/keep-alive` renews it while the person is active. It used to be 43200 (the whole session); the whole session is still limited to `JWT_MINUTES` (default 720 = 12 hours).

**Rules:** wrong, malformed or expired code or challenge → 401. User deactivated since login → 403. Sets `last_login_at`. Rate limited to 10 attempts per IP per 15 minutes → 429 (separate counter from login).

**`POST /auth/verify-code` with the app (FR-58).** The same request. The token says what is checked: a code that was sent (as above), or, for `"totp"`, **a code from the app** (6 digits, spaces ignored; the current 30-second step and one step either side; **each step only once**, so a copied code cannot be used again) **or a backup code** (10 characters, any case, dashes and spaces ignored; **each works once**). A backup code needs no secret, so it still works if the encryption key is lost. **Wrong code → 401 `"Invalid or expired code"` and it is counted: 10 wrong codes in an hour for one account lock its second step for the rest of the hour** (429 `"Too many wrong codes. Try again in N minutes."`, `Retry-After`, even for the right code; the password step still works; the admins are told by email, with the person's name only). If the encryption key cannot be used, a code from the app → 503 `"Codes from the app cannot be checked right now. Use a backup code."`. The per-address limit applies too.

### POST /auth/use-sms
FR-58. For a person whose `/auth/login` answered `"totp"` with `can_use_sms: true`. **Request:** `{ "challenge_token": "<the app challenge>" }`. **Response 200:** like `/auth/login` with `method: "sms"`, a new challenge token and `sent_to`. **Rules:** another kind of token, an expired one, or an account whose app was switched off since → 401 `"Invalid or expired code"`; account not ready → 403; SMS not possible (Termii not set up, or phone not confirmed) → **409 `"SMS codes are not available."`** and nothing is sent; the code counts in the **5 codes an hour** (429 as for `/auth/login`); SMS failure → 502. The screen offers this only when `can_use_sms` is true.

### POST /auth/keep-alive
Automatic sign-out after no activity (NFR-06, 2026-10-29). Any logged-in user; the access token in `Authorization: Bearer`. **No body.** **Response 200:** `{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 300 }` — a **new** token for the same session, with the idle limit of the role the database has **now** (300 for an admin, 900 otherwise). It carries the moment the session began (`sts`), so renewing never stretches a session past `JWT_MINUTES`. **Rules:** the same checks as every protected endpoint (`get_current_user`: password changed after the token was made → 401; deactivated or not ready → 403); a token not renewed within its idle limit has expired → 401 `"Invalid or expired token"`; a session older than `JWT_MINUTES` → 401. The browser calls it while the person clicks, types or scrolls, at most once a minute; an idle session is therefore refused by the server after the limit even if the browser were closed or tampered with. No new table, nothing stored on the server. **Tests:** `tests/integration/test_idle_session.py`.

### GET /auth/me
Any logged-in user. Send the access token as `Authorization: Bearer <access_token>`. **Response 200:** `UserRead`

**Rules:** the access token only identifies the user (it carries no role). Every protected endpoint loads the user from the database and uses `role` and `is_active` from that row, so a role change or deactivation applies on the next request. Missing or invalid token → 401. Deactivated user → 403.

**Account state (FR-48, FR-49):** the same check runs for **every** endpoint that needs a login (it is in `get_current_user`, one place): an account that is waiting for approval, rejected, closed, deactivated, or whose email or phone is not confirmed gets 403 with the sentence above, even with a valid token. A test calls every operation that needs a login with an admin in each of these states.

**Tests:** wrong password · wrong code · expired challenge · token works on `/auth/me` · inactive user blocked · user with no phone · login and verify-code rate limits (429) · role read from database · every login-protected route refuses an account that is not ready.

`UserRead` (also in the answer of `/auth/verify-code` and `/admin/users`) has **`two_factor_enabled`** (boolean, FR-58). It never holds the secret or a backup code.

---

## 4b. The authenticator app (FR-58, Phase 2c)

Feature `specs/2026-10-23-accounts-and-facility-ownership/`; the owner's answers D17 to D19 of 2026-10-24. **A free second step instead of an SMS code.** Standard time-based codes (RFC 6238: SHA-1, 6 digits, 30 seconds), written with the Python standard library and tested against the RFC's own values; the secret is **encrypted** in the database with Fernet (the `cryptography` package) and the key `TOTP_ENCRYPTION_KEY` (a Render variable; in development and the tests a public development key, refused elsewhere). **With no usable key the API starts normally and the set-up answers 503 `"The authenticator app is not available yet."`**; nothing is ever stored in the clear. **Every route needs a login** (so a ready account); the account is never named in the request.

| Route | Needs | Answer |
| --- | --- | --- |
| `GET /account/two-factor` | login | `{ "enabled": bool, "backup_codes_left": n, "available": bool }` (`available`: a usable key exists here) |
| `POST /account/two-factor/start` `{ "password" }` | login, password (rate-limited per address like the login) | 200 `{ "secret": "<32 letters>", "otpauth_uri": "otpauth://totp/..." }`, **shown this once**; 403 `"The password is not right."` (not 401: that means "log in again"); 409 `"The authenticator app is already switched on."`; 503 as above. A second start before the first code replaces the unfinished secret. The app is **not on** yet. |
| `POST /account/two-factor/confirm` `{ "code" }` | login, a start | The first code from the app. 200 `{ "backup_codes": [10 codes] }`, **shown this once**; the app is on from now and the login asks for it. 400 `"That code is not right. Check that your phone's time is set automatically."`; 400 `"Start the set-up first."`. |
| `POST /account/two-factor/disable` `{ "password", "code" }` | login, password, a code (app or backup) | 200 `{ "enabled": false }`; clears the secret and the backup codes. 400 `"The authenticator app is not switched on."`, 403, 400 as above. |
| `POST /account/two-factor/backup-codes` `{ "password", "code" }` | login, password, a code | 200 `{ "backup_codes": [10 new codes] }`; **the old ones stop working**. |
| `POST /admin/users/{id}/reset-two-factor` | **admin** | 200 `{ "enabled": false }`: clears another account's app and backup codes (lost phone). **400 `"Another admin must reset your two-step login."` for oneself**; 404 unknown id; 403 for any other role. |

**Rules:** wrong codes of `confirm`, `disable` and `backup-codes` count in the same limit as the login (10 an hour per account, then 429 `"Too many wrong codes. Try again in N minutes."` with `Retry-After`). A backup code is 10 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0, O, 1, I), stored only as keyed hashes, each worth one use. **Audit entries** (`field_changed` "two_factor"): `two_factor_on`, `two_factor_off`, `two_factor_codes` (new codes), `two_factor_backup_used` (the number left), `two_factor_reset` (by an admin, or `startup-reset`); **none holds a secret or a code**, and the secret is in no log and no answer after the set-up.

**What the API says about the key when it starts (found on 2026-10-25, when production said "not available yet" and nothing in the log said why).** One fixed line in the Render log (the `uvicorn.error` logger, so it shows at INFO), **never the key or any part of it**: `Authenticator app: TOTP_ENCRYPTION_KEY is set and usable.` (INFO); or, as a WARNING, that it **is not set**, that it **is the public development key** (refused outside development), or that it **is not a usable key: the value has N characters, and a key has 44 characters (32 random bytes in URL-safe base64, ends with =)**. A lost `=` shows as 43; a hex key as 64. In development with no key: `using the public development key (development only)`. The API starts in every case.

**One-time start-up step for the only admin** (no other admin to ask): `python -m app.reset_two_factor --at-startup`, run by the Dockerfile before the API. It reads `RESET_TWO_FACTOR_FOR_EMAIL`; **nothing happens, and nothing is logged, if it is missing or blank**; with an email it clears that account's app, writes an audit entry (`startup-reset`) and logs only `two-factor reset for an account` (or `...: no account has the email in RESET_TWO_FACTOR_FOR_EMAIL`); a failure is logged without details and never stops the API. The owner sets the variable in Render, lets the API start once, and deletes it.

**Tests:** the RFC 6238 values; the window of one step and the one-use step; backup codes (once, case, dashes, 10 of 10 characters); the encryption (not readable, tampered or wrong key refused, development key refused elsewhere); every route's login, password and code rules; the lock after 10 wrong codes (per account only) and the admin email; no SMS for an account with the app (the SMS function is asserted not called); SMS only when Termii is set up; the email code when Termii is off and Resend on; nothing secret in a log, an audit entry or an answer; the migration; the admin and start-up resets.

---

## 4c. Sign-up (FR-48, FR-49, FR-56; Phase 3a, the pages are Phase 3b)

Feature `specs/2026-10-23-accounts-and-facility-ownership/`. **Every route is public and closed with 503 `"Sign-up is not open yet."` unless sign-up is open:** the setting `SIGNUP_ENABLED` is true (**off by default, so off in production until the owner turns it on**), and, outside development, Resend (`RESEND_API_KEY` and `RESEND_FROM_EMAIL`) is set up (a code that cannot be sent cannot be confirmed, so no account is made that nobody can use). **Termii is not needed to open sign-up (D20, 2026-10-25):** the phone is confirmed by an SMS code **only when Termii is live** (`TERMII_API_KEY` set); without it the phone stays not confirmed until an admin records a call (see "Phone confirmed by call" below). The routes are in the "Auth" group.

| Route | Request | Answer |
| --- | --- | --- |
| `POST /auth/signup` | `{ "name", "email", "phone", "password", "account_type": "staff" or "provider", "note"? }` | 200 `{ "confirm_token", "sent_to": "a***@example.com" }` |
| `POST /auth/confirm-email` | `{ "confirm_token", "code" }` (the code of the email) | 200 `{ "status": "phone_code_sent", "confirm_token", "sent_to": "+234******0123" }`: the email is confirmed and, **only when Termii is live**, a code is **texted** to the phone. Without Termii: 200 `{ "status": "active" }` (provider) or `{ "status": "waiting_for_approval" }` (staff), with no token and no `sent_to`: the sign-up is finished and the phone stays not confirmed |
| `POST /auth/confirm-phone` | `{ "confirm_token", "code" }` (the code of the phone; only reached when Termii is live) | 200 `{ "status": "active" }` for a provider, `{ "status": "waiting_for_approval" }` for staff |
| `POST /auth/signup-resend-code` | `{ "confirm_token" }` (the token of the current step) | 200 like the step it repeats (a new token and the hint) |

**Rules**
- **The account:** made by `signup` with the email lower-cased, the phone made international (`+234...`), the password hashed (Argon2), `email_verified_at` and `phone_verified_at` empty. A **provider** has the role `provider` and `approval_status` `approved`; **staff** has the role `verifier` (the lowest) and `approval_status` `pending` and keeps the `note` (at most 500 characters; a provider's note is dropped). Until both codes are confirmed the account is refused everywhere (login 403 "Confirm your email address first." / "Confirm your phone number first."). After them a provider can log in; staff still get 403 `"This account is waiting for approval by an admin."` and **no route that needs a login answers them** (the same check as Phase 2, tested over every route).
- **The password rule of FR-56** for the account type (8 for a provider, 10 for staff, nothing common, not the email): refused with 422 and a plain sentence. Name 1 to 100 characters, a valid email, a Nigerian phone, `account_type` only `staff` or `provider` (an admin or an editor is never made by sign-up): else 422.
- **The same answer for an email that is already an account** (and confirmed): 200 with a token that is signed like the others but for a code that was **never sent**, so it fails like a wrong code (401); no code is sent, nothing of the account is changed, and **its owner gets an email "You already have an account"** (no code, no link). Asking for a new code for such a token also gives 200 and sends nothing. The time taken is the same (the password is hashed in both cases). Nobody can learn who has an account.
- **An unfinished sign-up with the same email is started again:** "unfinished" means the **email is not confirmed**. Its name, phone, password, type and note are replaced, the codes are sent again, and its 7 days start again. (It was never usable, and the email's owner must give the code.) An account whose email is confirmed is never restarted, even with its phone not confirmed (D20): it gets the "you already have an account" answer. Known limit: with Termii live, a person who confirmed the email and lost the page cannot restart; they use the resend route with the token they were given, or wait for the 7-day clean-up.
- **Codes:** 6 digits, signed tokens, nothing stored: the email code lasts 15 minutes, the SMS code 5. A code works once (a token for a step that is already done gives 401). **A new code** (`signup-resend-code`): at least 60 seconds after the previous one (429 with the seconds and `Retry-After`), and **at most 5 codes an hour per account** (the same limit as the login codes, 429 `"Too many codes. Try again in N minutes."`). A wrong code, a wrong, expired or other-purpose token, or a token whose step is not next: 401 `"Invalid or expired code"`; **10 wrong codes in an hour lock that account's sign-up codes** (429 `"Too many wrong codes. Try again in N minutes."`).
- **Limits:** 10 sign-ups per client address per hour (429 `"You've tried to sign up several times. Please try again later."`), 3 per email per hour **whether or not it is an account** (429 `"Too many sign-up attempts for this email. Try again later."`), the confirm routes use the same per-address limit as the login code (10 in 15 minutes), the new-code route the login's. All are kept in the API's memory (per instance, forgotten at a restart).
- **If the email cannot be sent:** nothing is made (the whole step is undone): 502 `"Could not send the email. Try again."`, or 503 as above when Resend is not set up. **If the SMS cannot be sent** at `confirm-email`: everything of that step is undone, so the email stays unconfirmed and the same code can be tried again: 502 `"Could not send the code. Try again."`.
- **Audit:** nothing is written at `signup`. At the **last confirmation** (`confirm-phone` when Termii is live, `confirm-email` when it is not) one entry `signup_confirmed` (`field_changed` "account", `new_value` e.g. `provider (approved)` or `verifier (pending)`); it holds no password, email, phone or code. For staff, **the admins are emailed** "Someone is waiting for approval" with the person's name only and one fixed sentence: the phone is confirmed, or it is not and they should phone the person and record it ("phone confirmed by call").
- **Phone confirmation by SMS only when Termii is live (D20).** Without Termii, `confirm-email` finishes the sign-up: no SMS is sent and `phone_verified_at` stays empty. The account check (`ensure_account_is_ready`) asks for a confirmed phone **only when Termii is live**, so a provider can log in after the email code (the login code goes by email, D19, or the authenticator app is used; the app is offered at the first login). With Termii live, login says 403 `"Confirm your phone number first."` until the phone is confirmed. An email that is already an account (and confirmed) is recognised by its email alone, so the same-answer rule holds without Termii. A phone token from before Termii was switched off still works.
- **The clean-up** deletes an account whose email is not confirmed, and one whose phone is not confirmed only while Termii is live.
- **Never logged or returned:** the password, a hash, a code, a token, the email, the phone.
- **The nightly clean-up** `python -m app.jobs.purge_signups` (no schedule is set up in the repository, like the re-check job): deletes every account whose email **or** phone was not confirmed within **7 days** of the sign-up and that **no other row names** (an audit entry, a listing as owner or creator, a report, a check). It is the only deletion of an account in the whole plan; a confirmed account, and a staff sign-up waiting for approval, are never deleted. Prints `N unfinished sign-up accounts deleted.`

### POST /admin/users/{user_id}/confirm-phone-by-call (D20)

Admin only (role read from the database row). The admin has phoned the person at the number on the account and heard them confirm it. **Request:** no body. **Response 200:** `{ "phone_confirmed": true }`. It sets `phone_verified_at` to now. Rules: 404 `"User not found"`; the account must have a phone and an **already confirmed email** (else 409 `"Confirm the email first."`); asking again for an account whose phone is already confirmed is 200 and changes nothing (no second audit entry). **Audit:** one entry `phone_confirmed_by_call` (`user_id` = the admin, `field_changed` "phone", `new_value` `confirmed for user N`; no number). It does not approve the account: approving staff is Phase 4a, which refuses an account whose phone is not confirmed.

**Tests:** the whole road for a provider and for staff, with Termii and without it; closed unless open, and outside development until Resend is set up (Termii is not needed); the password rule per type; bad input; an email that is already an account (the same answer shape, no code, a notice, an unchanged account, a decoy that fails, resend looks the same); an unfinished sign-up started again; wrong, expired, used and other-purpose tokens; the lock after 10 wrong codes; an SMS or email that cannot be sent; new codes (60 seconds, 5 an hour, email and phone); the limits per email and per address; the audit entry; the admin email; a waiting staff account refused by every route that needs a login; no password, code, token, email or phone in a log or an answer; the clean-up.

---

## 4d. Account self-service (FR-54, US-21; Phase 5)

Feature `specs/2026-10-23-accounts-and-facility-ownership/`. The routes under `/account` need a login and act on **the caller's own account only** (the id is never in the request; 401 with no login, 403 for an account that is not ready, as everywhere). `forgot-password` and `reset-password` are public.

| Route | Request | Answer |
| --- | --- | --- |
| `GET /account` | none | 200 `{ id, name, email, phone, role, approval_status, email_confirmed, phone_confirmed, two_factor_enabled }` |
| `PATCH /account` | `{ "name" }` (1 to 100 characters) | 200 the same shape. Audit `account_update`, `field_changed` `name`, old and new name. |
| `POST /account/email/start` | `{ "email" }` | 200 `{ confirm_token, sent_to }`: a 6-digit code is **emailed to the new address** (Resend; 503 `"Email is not set up yet."` when it cannot be sent outside development, 502 when Resend fails). The old email keeps working. 409 `"That email is already used."` if another account has it (checked again at the confirm step). |
| `POST /account/email/confirm` | `{ confirm_token, code }` | 200 the account. The email is replaced, `email_verified_at` set, the **old address gets a notice** ("your email was changed"; best effort). Audit `account_update`, `field_changed` `email`, `old_value`/`new_value` = `changed` (never the address). A wrong, expired, used or foreign code is **400** `"Invalid or expired code"` for every `/account` code route (not 401: a 401 means "log in again" and the screens would log the person out); the public `reset-password` keeps 401. |
| `POST /account/phone/start` | `{ "phone" }` (Nigerian number) | With Termii live: 200 `{ confirm_token, sent_to }`, a code is texted to the **new** number (502 on failure). Without Termii: the number is replaced at once and left **not confirmed** until an admin records a call (D20): 200 `{ confirm_token: null, sent_to: null }`. Audit `account_update`, `field_changed` `phone`, `changed`. |
| `POST /account/phone/confirm` | `{ confirm_token, code }` | 200 the account; the phone is replaced and confirmed. |
| `POST /account/password` | `{ current_password, new_password }` | 200 `{ access_token, token_type, expires_in }` (`expires_in` is the idle limit of the role, as at the login): a **new** token, because the old ones stop working. 403 `"The password is not right."` for a wrong current password (10 wrong in 15 minutes: 429). 422 plain sentence from the password rule of FR-56 (8 for a provider, 10 for staff and admin, nothing common, not the email); the new password must differ from the old one (422). Sets `password_changed_at`; audit `account_update`, `field_changed` `password`, `changed`. |
| `POST /account/close` | `{ password, confirmation: "CLOSE" }` | 200 `{ closed: true }`. See below. 403 wrong password; 422 wrong confirmation; 409 `"This is the last active admin."` |
| `POST /auth/forgot-password` | `{ "email" }` | **Always** 200 `{ reset_token, sent_to }`, whether the email is an account or not (a decoy token that can never be confirmed for an unknown one). Known limit: sending the email takes a little time that an unknown email does not, so the timing is not identical; the 3-an-hour limit counts both. For an account that is active and not closed or rejected, a 6-digit code is emailed (15 minutes). 3 requests an hour per email and 10 per address (429), every call counted. 503 when email is not set up outside development. |
| `POST /auth/reset-password` | `{ reset_token, code, new_password }` | 200 `{ reset: true }`. 401 `"Invalid or expired code"` (10 wrong in an hour: 429). 422 password rule. Sets the password and `password_changed_at` (every older token stops working) and **does not log the person in**. Audit `account_update`, `password`, `changed`, user = the person. |

**Old tokens stop working (D10).** Access tokens now carry their issue time (`iat`). A token issued before the account's `password_changed_at` (compared in whole seconds) is refused with 401 on every route; a token made before this change has no `iat` and is refused once the password has been changed. Changing the password returns a fresh token, so the person stays logged in.

**Closing an account** keeps the row and every audit entry, and removes the personal data: name becomes `Closed account`, email becomes `closed-{id}@closed.invalid` (unusable, unique), phone and sign-up note are emptied, the password hash is replaced by that of a random value nobody knows, the authenticator app and backup codes are cleared, `closed_at` is set and `is_active` false. It needs the password and the typed word `CLOSE`, is refused for the **last active admin**, and sends the old address a notice first (best effort). Owner links are marked removed when they exist (Phase 6). Audit `account_close` (no personal data). A closed account cannot log in ("This account is closed.").

**Limits and privacy.** Codes: 5 an hour per account (the same counter as login codes; a new "start" is not a resend, so there is no 60-second wait here), a wrong code is 401 and 10 wrong codes an hour lock that account's account-codes (429). Nothing here logs a password, a code, a token, an email address or a number.

**Tests (written first):** each route with a wrong, an expired and a right code; the old email works until the new one is confirmed; an email already used is refused at both steps; the password rule; a wrong current password and its limit; the old token refused after a password change and the new one accepted; the answer of forgot-password identical for a known and an unknown email (shape, status, hint), and no email sent for the unknown one; reset sets `password_changed_at` and does not log in; close anonymises every personal column and keeps the audit rows; the last admin cannot close; a closed account cannot log in; no secret in a log, an audit entry or an answer; every route in the list of routes that need a login (Phase 2 test) except the two public ones.

---

## 5. Staff: listings and verification

### GET /listings
Staff only. List for the admin panel.

**Query:** `status`, `category`, `area`, `q`, `due` (`overdue` | `this_week`), `mine` (bool, verifier's own drafts), `limit`, `offset`.

**Response 200:** `{ "items": [ListingSummary + { "status": "draft", "next_check_due": "...", "created_by": 3 }], "total": n }`

### GET /listings/id/{listing_id}
Staff only. Full `ListingDetail` plus `status`, `next_check_due`, `owner_id`, `created_by`, `featured_until`.

### POST /listings
FR-31. Verifier, editor, admin. Creates a `draft`.

**Request:**
```json
{
  "name": "Night Pharmacy A", "category": "pharmacy", "area": "New Haven",
  "address": "12 Example Road", "landmark": "Opposite the market",
  "latitude": 6.452, "longitude": 7.51, "description": null, "is_24_hours": false,
  "phones": [ { "number": "08030000000", "label": "Front desk", "is_primary": true, "is_whatsapp": false } ],
  "opening_hours": [ { "day_of_week": 0, "opens_at": "20:00", "closes_at": "02:00", "is_closed": false } ],
  "services": [ { "name": "Malaria test", "fee_min_naira": "1500.00", "fee_max_naira": "3000.00", "fee_collected_at": "2026-09-28" } ]
}
```
**Response 201:** staff `ListingDetail`

**Rules:** slug generated from name + area (unique; add `-2`, `-3` if taken). `created_by` = caller. Exactly one primary phone. `is_whatsapp` is optional and defaults to `false` (the endpoint itself is phase 10; the column is added in phase 6a). `area` must be in `/meta` areas. Audit entry `create`.

### PATCH /listings/{listing_id}
FR-31. Same body as POST, all fields optional. `phones`, `opening_hours` and `services`, when sent, **replace** the existing lists.

**Rules:** verifier may edit only `draft` listings they created (else 403); editor/admin may edit any. Audit entry per changed field.

### POST /listings/{listing_id}/checks
FR-32, US-10. Verifier, editor, admin. Logs a call or visit.

**Request:** `{ "method": "visit", "result": "pass", "person_reached": "Pharmacist on duty", "notes": "Hours confirmed", "photo_url": "https://res.cloudinary.com/..." }`

**Response 201:** the check, with `checked_at`.

**Rules:** a passing visit with `photo_url` sets the listing's `entrance_photo_url`. If the listing is `published` and `result = fail`, the listing moves to `hidden`, editors are emailed, and an audit entry is written (FR-36). A pass updates `last_working_at` on the primary phone.

### GET /listings/{listing_id}/checks
Staff only. Check history, newest first.

### POST /listings/{listing_id}/submit
Verifier (own draft), editor, admin. `draft` → `pending_review`.
**Rules:** requires at least one passing `call` **and** one passing `visit`, else 400.

### POST /listings/{listing_id}/publish
FR-33. Editor, admin. `pending_review` or `recheck_due` → `published`.
**Rules:** requires a passing check within the last 14 days, else 400. Sets `last_verified_at` = latest passing check, `next_check_due` = now + category `recheck_days`. Audit entry `publish`.

### POST /listings/{listing_id}/hide
Editor, admin. Any status → `hidden`. **Request:** `{ "reason": "Facility closed" }` · Audit entry `hide`.

### POST /listings/{listing_id}/reopen
Editor, admin. `hidden` → `draft`, so it can be re-verified.

**Tests:** verifier cannot publish · verifier cannot edit another verifier's draft · submit without checks → 400 · failed check hides a published listing · every change writes an audit entry.

### Phase 10 clarifications for section 5 (feature `specs/2026-10-20-staff-screens/`, decisions C1 to C13)

- **Staff shapes.** A staff list item is a `ListingSummary` plus `status`, `next_check_due` and `created_by`. A staff detail (`GET /listings/id/{id}`, and the answer of POST and PATCH) is a `ListingDetail` plus `status`, `next_check_due`, `owner_id`, `created_by`, `featured_until`, `map_pin_is_default` (true while the pin is `DEFAULT_MAP_CENTRE`, so the editor can warn) and `submission_details` (the text of the `submission` audit entry of a "List your facility" draft, else `null`). `ListingDetail.opening_hours` is the 7-entry week as for the public page.
- **`GET /listings`** (staff): `status`, `category` (slug), `area`, `q` (name contains, ignoring case), `due`, `mine` (listings created by the caller), `limit`, `offset`; sorted by name then id; `due=overdue` means `next_check_due` in the past, `this_week` means within the next 7 days (phase 11 builds the screen that uses `due`; from phase 11 `due` counts only `published` and `recheck_due` listings, decision H6). Any staff role may read; a provider gets 403.
- **`POST /listings`:** `category` must be an existing slug (422), `area` one of `/meta` areas (422), exactly one primary phone (422), phones are normalised to `+234…` (422 if not a Nigerian number), every service `name` must be in `service_catalogue` (422; the stored name is the catalogue's spelling), fee minimum not above fee maximum (422), `latitude` and `longitude` in range (422), at most one opening-hours row per day (422); `opens_at` and `closes_at` are `HH:MM`, both given unless `is_closed`.
- **`PATCH /listings/{id}`:** the same rules for what is sent. The audit entries: one per changed scalar field (`field_changed`, `old_value`, `new_value`), and one per replaced list (`phones`, `opening_hours`, `services`) with the old and new list as short text. Nothing changed, nothing written. A verifier may edit only a draft they created; the rule is `access_service.ensure_can_edit_listing`.
- **Checks.** Any staff role may log a check on any listing and read its history (decision C3). `person_reached` and `notes` are at most 200 and 1000 characters; `photo_url` is accepted only as an `https://res.cloudinary.com/` address (422). `GET /listings/{id}/checks` answers `{ "items": [...], "total": n }`. The history item holds `id`, `method`, `result`, `person_reached`, `notes`, `photo_url`, `checked_at`, `staff_id` and `staff_name`. Audit action `check`. A failed check of a published listing hides it, writes an audit entry (`hide`, reference `failed re-check`) and tells the editors by the best-effort alert of phase 9 (FR-36, decision C9).
- **Moves.** `submit`: draft to pending review, by a verifier on their own draft, an editor or an admin, with a passing call and a passing visit. `publish`: pending review or re-check due to published; editor or admin; a passing check in the last 14 days; sets `last_verified_at` to the newest passing check and `next_check_due` to now plus the category's `recheck_days`. `hide`: any status to hidden; editor or admin; `reason` is required (1 to 200 characters); the reason is kept in the audit entry's `reference` (decision C4). `reopen`: hidden to draft; editor or admin. A move that is not in the table of the PRD, or a role that may not do it, is 400 or 403 (an impossible move is 400, a wrong role is 403). The answer of each move is the staff detail.
- **`POST /uploads/sign`:** `folder` must be `entrances` (422). The answer is as above. Without `CLOUDINARY_URL` it answers 503 `{ "detail": "Photo upload is not set up." }`. The signature is the SHA-1 hex of the signed parameters sorted by name and written as `name=value` joined with `&`, followed directly by the API secret (Cloudinary's documented rule); the signed parameters are `folder`, `timestamp` and, only when `CLOUDINARY_UPLOAD_PRESET` is set, `upload_preset` (which is then also in the answer). The secret is never returned or logged.

---

### SwiftRescue contacts for staff (2026-10-27)

`GET /staff/emergency-contacts` (editor, admin; a verifier or a provider gets 403, no token 401) returns the contacts of **every SwiftRescue group, of every status**, so staff can add, edit and remove them from one screen:
```json
{ "groups": [ { "category": { "slug": "ambulance", "name": "Ambulance" }, "contacts": [ /* StaffListingSummary: the staff list item, with status */ ], "total": 3 } ] }
```
The groups are the nine of `emergency_service.GROUPS`, in that order (the order of the SwiftRescue page); the national line `112` is not a listing and is not here. `contacts` holds the group's listings by name, at most 100 (`total` is the real number). A draft, a hidden one and one waiting for a re-check are included, with their `status`, so a contact that was removed can still be found. Nothing here changes what the public sees (`GET /emergency` is unchanged).
**Adding, editing and removing use the routes that exist:** a new contact is `POST /listings` with the group's category (a draft that is verified and published like any listing, so it appears in SwiftRescue only after that); editing is `PATCH /listings/{id}`; **removing is hiding** (`POST /listings/{id}/hide` with a reason, editor or admin): the listing and its history stay and `reopen` brings it back as a draft. **Nothing is deleted.** The seed adds no real phone number.
**Tests:** access (401, 403 for verifier and provider, 200 for editor and admin) · the nine groups in the page's order · contacts of every status, by name · only the group's own category · `total` and the 100 limit · a draft or hidden contact is still absent from `GET /emergency` · the primary phone is in the item · hiding one removes it from the public list and leaves it on this screen.

## 6. Staff: reports

### GET /reports
FR-35. Editor, admin. **Query:** `status` (default `open`), `limit`, `offset`.
Urgent first (listings auto-flagged by FR-22), then newest.
**Response 200:** `{ "items": [ { "id": 88, "listing": ListingSummary, "reason": "not_working", "comment": "...", "created_at": "...", "status": "open", "urgent": true } ], "total": n }`

`reporter_phone` is shown masked (`+234******0000`).

### PATCH /reports/{report_id}
Editor, admin. **Request:** `{ "status": "resolved" }` or `{ "status": "dismissed" }`
**Rules:** sets `resolved_by`, `resolved_at`, and **deletes `reporter_phone` and `reporter_key`** (NDPA). Audit entry.

**Phase 11 rules (decisions H1 to H3, H7 in `specs/2026-10-20-reports-queue/requirements.md`):**
- **`GET /reports`** answers `{ "items": [ReportRead], "total": n }`. `status` is `open` (default), `resolved` or `dismissed` (else 422); `limit` 1 to 100 (default 20); `offset`. Order: urgent first, then newest first, then id. `ReportRead` is `{ "id", "listing": { "id", "slug", "name", "area", "status" }, "reason", "comment", "reporter_phone", "created_at", "status", "urgent", "resolved_at" }`; the listing is a small reference, not a `ListingSummary`, so a report of a `recheck_due` listing still shows. **Urgent** means the report is open, its reason is `not_working` and its listing is `recheck_due` (the state the flag of FR-22 gives); a closed report is never urgent. `reporter_phone` is masked (`+234******0000`: the first four characters, six stars, the last four) while a phone is stored, else `null`; a resolved or dismissed report always has `null`. A verifier and a provider get 403.
- **`PATCH /reports/{report_id}`** takes `{ "status": "resolved" | "dismissed" }` (`open` is 422) and answers the `ReportRead`. An unknown id is 404. A report that is already resolved or dismissed is 400 ("This report is already closed."). It sets `resolved_by` (the caller) and `resolved_at`, sets `reporter_phone` and `reporter_key` to null, and writes an audit entry: action `report_resolve` or `report_dismiss`, the listing, field `status`, old `open`, new the status, reference `report-<id>`. The entry never holds the phone or the comment. It does not change the listing.
- **Tests:** a verifier and a provider get 403, no token 401 · the status filter · urgent first, then newest · the masked phone, and `null` without one · a resolved report lost its phone and key in the database · closing twice is 400 · an unknown id is 404 · the audit entry has the editor, the listing and no phone · a report of a hidden or `recheck_due` listing is listed.

---

## 7. Provider

### GET /provider/listing
FR-43. Provider only. Their own listing (`owner_id` = caller) as `ListingDetail` plus `status`, `featured_until`. 404 if none linked.

### PATCH /provider/listing
FR-43. Provider only. **Allowed fields:** `description`, `services`, `opening_hours`, `phones`.
**Rules:** any change to `phones` or `opening_hours` sets `next_check_due` = now (urgent re-check; listing stays visible with `verification_due: true`). Audit entry per field. Any other field → 422.

**Tests:** provider cannot read or edit another provider's listing · phone change triggers urgent re-check.

**Phase 12 rules (decisions I1 and I2 in `specs/2026-10-20-providers-payments/requirements.md`):**
- **`GET /provider/listing`** answers the staff detail (`StaffListingDetail`) of the listing whose `owner_id` is the caller, plus `featured_price_naira` (a string with 2 decimals, from `FEATURED_PRICE_NAIRA`). No linked listing: 404 "No listing is linked to your account." Any role but provider: 403; no token: 401.
- **`PATCH /provider/listing`** takes any of `description`, `services`, `opening_hours`, `phones` (the same shapes and checks as `PATCH /listings/{id}`); any other field is 422 and nothing changes; an empty body changes nothing. The change is live at once. Each changed field writes an audit entry (action `update`, the caller as user). If `phones` or `opening_hours` really changed, `next_check_due` is set to now and one more audit entry is written (field `next_check_due`, reference `provider-change`); the status does not change, so the listing stays visible with `verification_due: true`. The answer is the same as `GET`.
- **Tests:** a provider reads only their own listing (another provider's, a staff role, no token: 403, 401) · no linked listing is 404 · the four fields change and the audit entries say which · name, category, area, address, `status`, `owner_id`, `featured_until` and `is_24_hours` are 422 and unchanged · a phone or hours change sets `next_check_due` and the listing is still in `/search` with `verification_due: true` · a description change does not touch `next_check_due` · the same value writes nothing · the price is a 2-decimal string.

### Phase 6a: owner links, the 10th table (FR-50, US-19; owner's yes to D1, 2026-10-24)

Feature `specs/2026-10-23-accounts-and-facility-ownership/`. A provider reaches a listing only through a row of **`facility_owners`**: `id`, `listing_id`, `user_id`, `role` (`owner` or `manager`), `status` (`pending`, `approved`, `removed`), `requested_at`, `approved_by`, `approved_at`, `removed_at`, `removed_by`, `note` (who staff reached on the phone, at most 300 characters). One row per (listing, person): asking again after a removal sets the same row back to `pending` (the audit log keeps the history). **`listings.owner_id` is no longer read**; it stays in the table, untouched. The migration copies every existing owner once as an `approved` `owner` link (`note` `migrated from listings.owner_id`), so nobody loses access; a second run adds nothing; the downgrade drops only the new table.

**Rules.** *Editing:* a provider may read the staff detail of, and edit, a listing only with an **approved** link on it (`PATCH` takes the four fields of Phase 12). A pending or removed link, or none, answers **404** (so the existence of a listing is not revealed). *Paying for Featured:* only an approved link with the role **`owner`** (decision D4); a manager gets 403 `"Only an owner can pay."`. *Many owners on one listing and one owner on many listings* are both allowed. A removed link loses access at once (checked on every request).

| Route | Who | Answer |
| --- | --- | --- |
| `GET /provider/listings` | provider | 200 `{ "items": [ { "link_id", "listing_id", "name", "area", "category", "role", "status", "requested_at" } ] }`: every link of the caller, any status, by listing id. Nothing about a listing the caller has no link to. |
| `GET /provider/listings/{listing_id}`, `PATCH /provider/listings/{listing_id}` | provider with an approved link | The same as `/provider/listing` for that listing; 404 otherwise. |
| `GET /provider/listing`, `PATCH /provider/listing` | provider | **Kept as before** for a provider with one listing: they act on the caller's approved link with the lowest listing id (404 `"No listing is linked to your account."` if none). |
| `GET /staff/owner-requests` | editor, admin | 200 `{ "items": [ { "id", "role", "requested_at", "person": { "id", "name", "email", "phone" }, "listing": { "id", "name", "area", "phones": [ { "number", "label", "is_primary" } ] } } ], "total" }`: the **pending** links, oldest first, with the facility's own phone numbers to call. A verifier or a provider gets 403. |
| `POST /staff/owner-requests/{id}/approve` | editor, admin | `{ "note" }` (1 to 300 characters: who was reached) → 200 the link, `status` `approved`, `approved_by`, `approved_at`, `note`. 409 `"This request is not waiting."` if it is not `pending`; 404 if it does not exist. |
| `POST /staff/owner-requests/{id}/reject` | editor, admin | `{ "note"? }` → 200, `status` `removed` (`removed_at`, `removed_by`). Only a `pending` link. |
| `POST /staff/owner-requests/{id}/remove` | editor, admin | `{ "note"? }` → 200, `status` `removed`. Only an `approved` link (409 otherwise). |

**Audit** (the listing in `listing_id`, the person asking in `reference` as `user:{id}`, so the activity log shows "About: name"): `owner_request` (new link, Phase 7), `owner_approve`, `owner_reject`, `owner_remove`, each with `field_changed` `status`, `old_value` and `new_value` the two states. No phone number is written. **`PATCH /admin/users/{id}` with `listing_id`** (Phase 10) now also creates an `approved` `owner` link and keeps its old audit row. **Closing an account** (Phase 5) marks all of the person's links `removed`.

**Tests (written first):** the migration (an old owner is linked, nothing else changes, a second run adds nothing, the downgrade restores, up-down-up) · a pending link cannot edit, read the staff detail or pay · an approved manager can edit but not pay · many owners on a listing and one owner on many listings · a provider cannot see or edit another's listing (404) · approve needs the note, reject and remove, each audited · a verifier and a provider get 403 on the queue · a removed link is refused at once · asking again after a removal reuses the row · the old `/provider/listing` still works for one listing · closing an account removes the links · the table count is 10 and no other table was added.

---

### Phase 7: register or claim a facility (FR-50, FR-51, US-17; decisions D14 and D15)

Feature `specs/2026-10-23-accounts-and-facility-ownership/`. A provider makes an owner link `pending` in one of two ways; staff decide it on `/admin/owner-requests` (Phase 6). Both need a provider account (an approved, confirmed one: a person who is not ready cannot log in). A staff account gets 403.

| Route | Who | Answer |
| --- | --- | --- |
| `POST /provider/facilities` | provider | Body `{ "facility_name", "category", "area", "address", "phone", "role"?, "notes"? }` (`role` is `owner` or `manager`, default `owner`; `notes` at most 300 characters; the other fields as the old form, but **no contact name or email: they come from the account**). 201 `{ "message", "listing_id", "link_id" }` with `message` "Thanks. Our team will verify your facility before it is listed." Makes a `draft` listing exactly as the old form did (no `created_by`, the default pin, the phone as the primary number), a `pending` link with the chosen role (the `notes` are kept in the link's `note` while it waits), and two audit rows: `create` (`user_id` = the provider, `reference` `facility-registration`) and `owner_request` (see below). 409 on a duplicate (below). 422 for a bad field or an emergency category. 3 registrations per client IP per day (429). |
| `GET /provider/claimable?q=` | provider | 200 `{ "items": [ { "id", "name", "area", "category": { "slug", "name" } } ] }`: listings whose status is **published or recheck_due** and whose name or area is trigram-similar to `q` (2 to 100 characters, else 422), best match first, at most 10. Nothing else is returned: **no phone number, no address, no description, and never a draft or a hidden listing**. 60 searches per client IP per hour (429). (The plan said `/listings/claimable`; that path would meet the staff route `/listings/{listing_id}`, so it lives under `/provider`.) |
| `POST /provider/claims` | provider | Body `{ "listing_id", "role"?, "reason" }` (`reason` 3 to 300 characters, kept in the link's `note` while it waits). 201 `{ "message": "Thanks. Our team will phone the facility to check.", "link_id" }`. 404 if the listing is not published or recheck_due (nothing is revealed about others). 409 `"You already manage this facility."` for an approved link and `"Your request for this facility is waiting for our team."` for a pending one. A **removed** link goes back to `pending` (the same row). A listing that already has an approved owner still gets a `pending` request: staff decide. 10 claims per client IP per day (429). |
| `POST /facility-submissions` | anyone | **Always 401** `"Sign up or log in to list your facility."` (D14). The body is not read. The anonymous drafts already in the database are untouched: they have no owner, and an admin can attach one (Phase 10 `listing_id`). |

**Duplicate check (D15)** inside the registration, before anything is written. A listing of **any status** counts if (a) one of its phone numbers equals the normalised phone, or (b) it is in the same area and its name has trigram `similarity` of at least **0.6** (`DUPLICATE_NAME_SIMILARITY` in `core/config.py`) with the new name. A hit stops the registration with **409** and `detail` `{ "message", "listing_id" }`: for a published or recheck_due listing `message` is "A facility like this is already listed. You can ask to manage it instead." and `listing_id` is its id (so the person can claim it); for a draft or hidden one `message` is "This facility is already registered. Please contact us." and `listing_id` is `null`, so nothing about it leaks. Nothing is written on a 409.

**Audit:** `owner_request` (listing in `listing_id`, the provider in `user_id` **and** in `reference` as `user:{id}`, `field_changed` `status`, `new_value` `pending`). No phone, note or reason is written to it.

**Tests (written first):** anonymous 401 on all four routes; a staff account 403; a registration makes the draft, one pending link with the chosen role, the audit rows with the provider's user id, and the contact fields are never asked; the phone is stored as +234; an emergency category is 422; duplicate by phone (any status), by similar name in the same area, a different area is not a duplicate, a clearly different name is not; the 409 shows the id only for a published or recheck_due listing; nothing is written on a 409; claim search finds a published and a recheck_due listing, never a draft or hidden one, returns no phone number or address, rejects a 1-character `q`; claim creates a pending link and the audit row, 404 for a draft/hidden/unknown listing, 409 for approved and pending links, a removed link goes back to pending, a listing with an approved owner still gets a pending request; the three rate limits answer 429; `POST /facility-submissions` is 401 and writes nothing; the owner-requests queue shows the reason.

**Queue change:** `GET /staff/owner-requests` items get `"reason"` (the link's `note` while it waits, or `null`). An approval or rejection replaces `note` with the staff member's own note.

### Phase 8a: moves and closures (FR-53, US-20; decision D3)

Feature `specs/2026-10-23-accounts-and-facility-ownership/`. **Migration (additive, revision `b8a1c3d5e7f9` after `7d1c4b9e5a32`):** `listings.closed_at` (timestamptz, nullable) and `listings.closed_reason` (varchar 200, nullable). Nothing else; **no status value is added** (a closed listing is `hidden` with `closed_at` set). The downgrade drops only those two columns. Every existing row keeps both `NULL`.

| Route | Who | Answer |
| --- | --- | --- |
| `POST /listings/{id}/move` | editor, admin, or a provider with an **approved link** (owner or manager) | Body `{ "address", "area", "landmark"?, "latitude"?, "longitude"? }` (`address` 3 to 200, `area` from `/meta`, `landmark` at most 200 and `null` clears it, the two pin values both or neither, else 422). 200 `{ "listing_id", "status", "changed": ["address", ...], "pin_needs_setting", "message" }`. 400 `"Nothing changed."` if every value equals the stored one; 400 `"A closed listing cannot be moved. Reopen it first."` for a closed one. A verifier, or a provider with a pending, removed or no link, gets 403; an unknown listing 404. |
| `POST /listings/{id}/close` | editor, admin, or a provider with an approved **owner** link (a manager gets 403) | Body `{ "reason" }` (3 to 200 characters). 200 `{ "listing_id", "status": "hidden", "closed_at" }`. 400 `"This listing is already closed."` |
| `GET /listings/{id}/address-history` | any staff role, or a provider with an approved link | 200 `{ "items": [ { "changed_at", "field", "old_value", "new_value", "kind", "by" } ] }`, newest first. `field` is `address`, `area` or `landmark`; `kind` is `move` or `edit` (an older `update` row of the same field, so history before this phase is kept); `by` is the staff member's name, and always `null` for a provider (a provider sees no staff names). The pin is not in the history (it is in the audit log). |
| `POST /listings/{id}/reopen` | editor, admin (existing) | Also clears `closed_at` and `closed_reason`. |

**Move rules.** One audit row per changed field (`address`, `area`, `landmark`, `latitude`, `longitude`), each `action` `move` with `old_value` and `new_value`, the person in `user_id`, and `reference` `by-owner` when a provider moved it. A `published` listing becomes **`recheck_due`** with `next_check_due` = now, and one more `move` row records `status` published to recheck_due: it leaves search, `/emergency` and its page at once and comes back only when staff re-check and publish it (D3). A `recheck_due` one stays so (`next_check_due` = now). A draft, pending or hidden listing keeps its status (it is not public anyway). **A provider's move never sets the pin:** any pin sent is ignored and the pin goes back to the default centre, so `map_pin_is_default` is true and staff must set the real pin (`pin_needs_setting` is true). An editor or admin may send the pin; without it the pin is left as it is. When a provider moved a listing the editors and admins get an email (names only, no SMS).
**Close rules.** `status` becomes `hidden`, `closed_at` and `closed_reason` are set, one audit row `close` (`field_changed` `status`, old and new status, `reference` = the reason). Phones, hours, services, checks and the audit log are kept. A closed listing is a hidden one for the public: search, `/emergency` and the listing page do not show it (404). The nightly job does not touch it. `closed_at` and `closed_reason` appear in the staff detail. When a provider closed it the editors and admins get an email.
**No deletes.** No route deletes a listing, an account or an audit row; one test lists every route and fails on any `DELETE` method.

**Tests (written first):** the migration (columns exist and are null for old rows, a second run is refused or harmless, the downgrade drops only the two columns, up-down-up); a move writes the right rows and keeps the old value; a second move adds a second set; the listing leaves the public search at once and returns only after publish; a verifier, a provider with a pending or removed link, and a stranger cannot move (403); a manager moves; a provider's pin is ignored and reset, an editor's pin is used; nothing changed is 400; a closed listing cannot be moved; a draft keeps its status; close by editor, by owner, refused for a manager and a verifier; close keeps phones, hours, services, checks and audit; a closed listing is not in search, `/emergency` or its page; reopen clears the closure; the nightly job leaves a closed listing alone; the address history is complete, newest first, hides names from a provider and includes older `update` rows; the alert goes to the editors and admins when a provider moves or closes; no `DELETE` route exists; the existing `test_listing_moves.py` is not changed and the new cases are in `test_listing_address_moves.py`.

### Phase 8b: branches (FR-52, US-20; decision D5)

Feature `specs/2026-10-23-accounts-and-facility-ownership/`. A **branch** is a listing of its own (own address, pin, phones, hours; verified and published on its own) that points to a **main** facility. **Migration (additive, revision `c9d2e4f6a8b0` after `b8a1c3d5e7f9`):** `listings.parent_id` (integer, nullable, foreign key to `listings.id`, indexed). Every existing row keeps `NULL`, so every existing listing is a main listing and **nothing is rewritten**. The downgrade drops the index and the column only.

**Rules** (one place, `branch_service`): a branch needs a parent that exists, is **not itself a branch** (one level only), is **not closed**, and has **the same category** as the branch (the plan's "same family": the project has no category families, so it is the same category). A listing that **has branches** cannot become a branch; a listing cannot be its own parent. Each refusal answers 422 with its own sentence. Closing or hiding a main facility does not change its branches.

| Route | Who | Answer |
| --- | --- | --- |
| `POST /provider/facilities/{id}/branches` | provider with an approved link (owner or manager) **on the main facility** | Body `{ "facility_name", "area", "address", "phone", "notes"? }` (as for `POST /provider/facilities`, no category: **the branch takes its parent's category**). 201 `{ "message", "listing_id" }`: a `draft` listing with `parent_id`, the default pin, the phone as primary number, no owner link of its own (access is inherited), audit `create` with `reference` `branch-of:{id}`. 409 `"This branch is already registered. Please contact us."` when the phone number or the address (same text, ignoring case and spaces) is already on the main facility or on one of its branches; nothing else is compared. 404 when the caller has no approved link on that listing, 422 when the parent breaks a rule (it is a branch, closed, ...). 10 per client address per day (429). |
| `GET /provider/facilities/{id}/branches` | the same | 200 `{ "items": [ { "id", "name", "area", "status" } ] }`: every branch of the main facility, any status, by id. |
| `PATCH /listings/{id}` with `parent_id` | **editor, admin only** (a verifier gets 403) | `parent_id` a number sets it, `null` clears it (the listing becomes a main facility again). The rules above apply (422 with the sentence). One audit row `update` with `field_changed` `parent_id`. |

**Access inherits (D5), one way:** wherever an approved link on a listing gives access (edit through `/provider/listings/{id}`, move, close, address history), an approved link on its **parent** gives the same access to the branch. A link on a branch gives **nothing** on the main facility. A pending or removed link on the parent gives nothing. Paying for Featured and "My facilities" still use the person's **own** links only (a branch is not paid for through its parent).
**Public:** `ListingSummary` gets `branch_of` (`{ "name", "slug" }` or `null`) filled in **search results** and on the listing page when the main facility is **published**, else `null` (a hidden main facility's name is never shown); `ListingDetail` gets `branches` (`[ { "name", "slug", "area" } ]`, published branches only, by name). The SwiftRescue lists and the blood bank lists do not fill `branch_of` (it stays `null`) and are otherwise unchanged. The staff detail also gets `parent_id` and `parent_name`.

**Tests (written first):** the migration (old rows null, downgrade, up-down-up, nothing else added); every rule above; both directions of inheritance (a parent's owner may edit, move, close and read the history of a branch; a branch's owner gets 404/403 on the parent); a pending parent link gives nothing; the duplicate check compares only phone and address inside one facility; a branch is verified and published on its own (publishing the main one does not publish the branch); search and the listing page show "Branch of"; a hidden parent's name is not shown; the parent page lists only published branches; a test over the demo data shows search, SwiftRescue, blood and the listing page unchanged apart from the two new empty fields.

---

## 8. Payments (Paystack test mode)

### POST /payments/featured
FR-44. Provider only. Starts a 30-day featured listing payment.
**Request:** `{ "plan": "monthly" }`
**Response 200:** `{ "authorization_url": "https://checkout.paystack.com/...", "reference": "SH-12-1730000000" }`
**Rules:** amount from settings (`FEATURED_PRICE_NAIRA`, a Decimal), sent to Paystack in kobo as `int(price * 100)`. Response also includes `"amount_naira": "5000.00"`. Listing must be `published`, else 400. `metadata.listing_id` included. Callback URL: `/provider/payment-complete` on the web app.

### GET /payments/verify/{reference}
Provider only. Used by the payment-complete page. Returns `{ "status": "success", "featured_until": "..." }` once the webhook has been processed, else `{ "status": "pending" }`.

### POST /payments/webhook
FR-44, FR-46. Called by Paystack only. No login.
**Rules:**
1. Verify the `x-paystack-signature` header (HMAC SHA-512 of the raw body with the secret key). Invalid → 401, nothing changes.
2. On `charge.success`: find the listing from `metadata.listing_id`; set `featured_until` = later of (now, current `featured_until`) + 30 days; write an audit entry with action `payment` and the Paystack reference.
3. Idempotent: if an audit entry with this reference exists, do nothing and return 200.
4. Always return 200 quickly for valid signatures.

**Tests:** bad signature rejected · valid event extends `featured_until` and writes audit · same event twice only applies once.

**Phase 12 rules (decisions I3 to I10 in `specs/2026-10-20-providers-payments/requirements.md`). Test mode only; no payment is ever live.**
- **Paystack, per its documentation** (`https://paystack.com/docs/api/transaction/` and `https://paystack.com/docs/payments/webhooks/`): *Initialize Transaction* is `POST https://api.paystack.co/transaction/initialize` with `Authorization: Bearer <secret key>` and a JSON body with `email`, `amount` (kobo, an integer), `reference`, `callback_url` and `metadata`; the answer holds `data.authorization_url` and `data.reference`. A webhook carries the header `x-paystack-signature`, the HMAC SHA-512 (hex) of the raw request body made with the secret key; `charge.success` has `data.reference`, `data.status`, `data.amount` and the `metadata` we sent. The code is tested with a mock transport only; it must be checked once against the Paystack test dashboard.
- **`POST /payments/featured`** accepts only `{ "plan": "monthly" }` (else 422), provider only. The listing is the caller's own and must be `published` (no listing: 404; not published: 400). The reference is `SH-<listing id>-<unix seconds>`; `metadata` is `{ "listing_id": <id> }`; `email` is the caller's login email; `callback_url` is `<web address>/provider/payment-complete` (`WEB_APP_URL`, or the first `CORS_ORIGINS` value when empty). `amount` is `int(FEATURED_PRICE_NAIRA * 100)`; the answer is `{ "authorization_url", "reference", "amount_naira": "5000.00" }` with the price as a 2-decimal string. A secret key that starts with `sk_live_` is refused with 503 "Live payments are switched off."; no key: 503 "Payments are not set up yet."; Paystack unreachable or not accepting (not a success answer): 502 "Could not start the payment. Try again." The error text never holds the key or the email.
- **`POST /payments/webhook`** reads the raw body first. A missing or wrong signature is 401 and nothing changes (the comparison is constant-time). A valid signature with a body that is not JSON is 400. A valid event that is not `charge.success` is ignored (200). For `charge.success` the call is applied only when `data.status` is `success`, `data.reference` has the shape `SH-<id>-<digits>` with the same `<id>` as `data.metadata.listing_id`, the listing exists, and `data.amount` is an integer of at least `int(FEATURED_PRICE_NAIRA * 100)`; otherwise it is ignored (200) and only the reference is logged. Applying: take a Postgres advisory lock on the reference, return 200 without a change if an audit entry with action `payment` and this reference exists, else set `featured_until` to the later of now and its current value plus 30 days, and write the audit entry (no user, action `payment`, field `featured_until`, old and new value as ISO times, reference = the Paystack reference), in one transaction. The answer is `{ "status": "ok" }`. Nothing of the body, the email or the card is logged or stored.
- **`GET /payments/verify/{reference}`**: provider only; the reference must start with `SH-<caller's listing id>-` (else 404). `{ "status": "success", "featured_until": "..." }` once an audit entry with this reference exists, else `{ "status": "pending", "featured_until": null }`. It does not call Paystack.
- **Tests:** only a provider (403 for others, 401 without a token) · amount in kobo `int(price*100)` in the request to Paystack and the price as a string in the answer · a live key and a missing key (503) · an unpublished listing 400 · Paystack failing is 502 without the key or email in the message · bad signature 401 and nothing changes · valid `charge.success` extends 30 days from now, or from the end of a running period · the audit entry holds the reference and no user · the same event twice applies once · an event for another type, a status that is not success, a reference that does not match its metadata, a too-small amount and an unknown listing are ignored with 200 and change nothing · verify says pending, then success, and 404 for another provider's reference.

---

### Owner fee (FR-59 to FR-64; owner's yes 2026-10-29; feature `specs/2026-10-29-owner-fee/`)
Listing stays free; staff can still add any facility. A facility owner pays **₦10,000 per calendar month** (`OWNER_FEE_NAIRA`, a Decimal, JSON string `"10000.00"`) through Paystack **test mode only** to claim and manage a listing. Money is a Decimal in the code and goes to Paystack as `int(amount * 100)` kobo. There is **no payments table**: a payment is an `audit_entries` row (`action` `payment`, `field_changed` `paid_until`, `old_value`/`new_value` the old and new end of the paid month, `reference` = ours, `SO-<link id>-<unix seconds>`; a Featured payment is `SH-...`).

**The link and its months.** `facility_owners.paid_until` (nullable, timestamp with time zone) is the end of the paid month. Statuses (plain text) are now `awaiting_payment` (asked for; the first month unpaid; **staff do not see it**), `pending` (first month paid; in the staff queue), `approved`, `lapsed`, `ending` (the owner cancelled) and `removed`. **A provider may manage a listing only through** an `approved` link with `paid_until + OWNER_FEE_GRACE_DAYS` (default 7) not yet passed, or an `ending` link with `paid_until` not yet passed; no `paid_until` never gives access (checked in the one place that decides access, the repository). A lapsed owner cannot edit, move, close, read the address history or buy Featured (404 "not linked"); **the listing is untouched: public, free, verified as before.** Staff are never charged. Existing approved links got `paid_until` = the migration date + 1 month (a free first month).

| Route | Who | What |
| --- | --- | --- |
| `POST /payments/owner-fee` | provider | Body `{ "link_id" }` only (any other field, such as an amount, is 422). 200 `{ "authorization_url", "reference", "amount_naira": "10000.00" }`. Nothing is saved. 404 not the caller's link; **409** `"There is nothing to pay for this request now."` for a `pending` or `removed` link; 502 / 503 as for Featured (`"Payments are not set up yet."`, `"Live payments are switched off."` for a `sk_live_` key). Payable: `awaiting_payment`, `approved`, `lapsed`, `ending`. Callback: `<web>/provider/fee-complete`. |
| `GET /payments/owner-fee/{reference}` | provider | 200 `{ "status": "success"\|"pending", "link_status", "paid_until" }`; `success` only when the webhook was applied. 404 for a reference that is not one of the caller's links. |
| `POST /payments/webhook` | Paystack | The same signed webhook (HMAC SHA-512, constant-time). `charge.success` with `data.reference` `SO-<n>-<digits>`, `data.metadata` `{ "link_id": n, "kind": "owner_fee" }`, `data.amount` a whole number of kobo at least the fee: **applied once per reference** (advisory lock + the audit entry). `awaiting_payment` → `pending`; `lapsed` or `ending` → `approved` (no new staff approval); `approved` / `pending` stay; **`removed` is recorded but unchanged**. `paid_until` = one calendar month after the old end if it is ahead (an early payment loses nothing), else after now. A receipt email is sent after the commit (best effort). |
| `POST /provider/links/{link_id}/cancel` | provider | 200 `{ "link_id", "status", "access_until", "refund" }`. `approved` → `ending` (editing to `paid_until`, **no refund of the paid month**); `awaiting_payment` / `lapsed` → `removed`; `pending` → `removed` **with a full refund** (`refund` `done` or `pending`). 404 not the caller's; 409 already `ending` or `removed`. Audit `owner_cancel`. |
| `GET /provider/payments` | provider | 200 `{ "items": [ { "reference", "kind": "owner_fee", "listing_id", "listing_name", "paid_at", "paid_until" } ] }`, newest first, only the caller's own links. |
| `GET /provider/listings` | provider | Now `{ "fee_naira", "grace_days", "items": [ { ..., "status", "paid_until", "fee_state" } ] }`; `fee_state` is `awaiting_payment`, `waiting_for_staff`, `paid`, `grace`, `lapsed`, `ending`, `ended` or `removed`. |
| `POST /provider/facilities`, `POST /provider/claims` | provider | Now create the link as **`awaiting_payment`** and answer 201 with `"status": "awaiting_payment"` and `"fee_naira": "10000.00"` besides `message` and ids. The duplicate checks run first, so nobody pays for a request refused for a technical reason. A second claim on an unpaid request gives back the same link (201). `lapsed` / `ending` / `approved` → 409 `"You already manage this facility."`; `pending` → 409 `"Your request for this facility is waiting for our team."` |
| `POST /staff/owner-requests/{id}/reject` | editor, admin | Also **refunds the owner's payment in full, automatically** (Paystack refund of the payment's reference): the answer has `"refund": "done"\|"pending"\|null`. The rejection is committed first, so a refund that fails is never lost: an audit `refund_pending` entry is written and the nightly job asks again. |

**Nightly job `python -m app.jobs.owner_fee`** (run by `.github/workflows/nightly-jobs.yml`, job `owner-fee`): (1) `approved` links past `paid_until` + grace → `lapsed` (audit `owner_lapse`, email); (2) `ending` links past `paid_until` → `removed` (audit `owner_end`); (3) a reminder email 7, 3 and 1 days before `paid_until` (`OWNER_FEE_REMINDER_DAYS`), once each (an audit `owner_fee_reminder` entry); (4) refunds not accepted are asked again (`refund` entry when done). Safe to run again; prints one line of counts. Settings: `OWNER_FEE_NAIRA`, `OWNER_FEE_GRACE_DAYS`, `OWNER_FEE_REMINDER_DAYS`.

**Paystack calls used** (read from Paystack's documentation, not tested against the real service): Initialize Transaction (as Featured) and **Create Refund** `POST https://api.paystack.co/refund` with `{ "transaction": "<reference>" }`, no `amount` = the whole payment (<https://paystack.com/docs/payments/refunds/>).

**Tests:** `tests/unit/test_owner_fee_rules.py`, `tests/unit/test_paystack_refund.py`, `tests/integration/test_owner_fee_{migration,access,payment,cancel_refund,job}.py`.

### Sponsored rules (one place; the owner's check of 2026-10-27; FR-19, FR-44, FR-45)

Four rules, each with tests in `backend/tests/integration/test_sponsored_rules.py` and in the frontend tests named below.
1. **Always labelled.** The one featured listing that takes the sponsored slot in `GET /search` has `sponsored: true`; no other answer of the API has it true (the listing page, `/emergency`, the blood lists, the staff lists are all false). Wherever the web app draws a result whose `sponsored` is true (the result card and the map popup) it shows the word **Sponsored**, and it shows the word on nothing else.
2. **Paying never changes verification.** A confirmed payment changes `featured_until` and writes its audit entry, and nothing else: `status`, `last_verified_at` and `next_check_due` stay, so a paid listing is re-checked on the same cycle, shows the same "Verified" date and the same "Verification due", and an overdue one stays overdue.
3. **Nothing paid in SwiftRescue or above 112.** `GET /emergency` is the same with or without `featured_until`: the national line `112` is first, no contact is moved, none is sponsored. A listing of an emergency category is never sponsored in search either (existing rule, FR-45).
4. **Only published, verified listings can be featured.** *Starting a payment* needs a `published` listing (else 400 `"Only a published listing can be featured."`) that has a `last_verified_at` and is **not overdue** (`next_check_due` not passed; else 400 `"Only a verified listing can be featured."`). *The slot in search* needs the same: published (as every search result), a `last_verified_at`, and not overdue; otherwise the next featured listing in the normal order takes the slot, or nobody does. *A payment confirmed for a listing that is no longer eligible* (it was hidden or went overdue after the person paid) is still recorded, with its audit entry and `featured_until`, because the money was taken; it shows nothing until the listing is eligible again. The web app shows "Get featured" only for an eligible listing and says why when it is not.

---

## 9. Uploads

### POST /uploads/sign
Staff only. Signed parameters for a direct browser upload to Cloudinary.
**Request:** `{ "folder": "entrances" }`
**Response 200:** `{ "cloud_name": "...", "api_key": "...", "timestamp": 1730000000, "signature": "...", "folder": "swifthealth/entrances" }`
**Rules:** images only, max 5 MB (enforced via upload preset); the API secret is never sent to the browser.

---

## 10. Dashboard

### GET /dashboard/stats
Editor, admin.
```json
{
  "listings_by_status": { "draft": 12, "pending_review": 4, "published": 140, "recheck_due": 6, "hidden": 3 },
  "rechecks_due_this_week": 18,
  "overdue_rechecks": 2,
  "open_reports": 5,
  "urgent_reports": 1,
  "checks_last_30_days": [ { "date": "2026-10-01", "passed": 14, "failed": 2 } ],
  "featured_active": 3
}
```
**Phase 11 rules (decision H6):** `listings_by_status` always has all five keys (0 when none). `overdue_rechecks` counts `published` and `recheck_due` listings whose `next_check_due` is in the past; `rechecks_due_this_week` counts those whose `next_check_due` is from now to now plus 7 days; `GET /listings?due=overdue` and `?due=this_week` count the same listings (they are restricted to these two statuses from phase 11, so the number on the dashboard equals the length of its list). `open_reports` counts open reports, `urgent_reports` the open ones that are urgent (see `GET /reports`). `checks_last_30_days` has one entry for each of the last 30 days, today included, oldest first, as Lagos dates, with `passed` and `failed` counts (0 when none). `featured_active` counts listings whose `featured_until` is in the future. A verifier and a provider get 403.
**Tests:** all five statuses present · each number against known data, at a chosen time · a hidden and a draft listing with a past date are not overdue · the list and the number agree · 30 entries, zero-filled, a check late in the evening UTC lands on the next Lagos day · roles.
---

## 11. Admin

### GET /admin/users · POST /admin/users · PATCH /admin/users/{user_id}
FR-41. Admin only.
- **POST request:** `{ "name": "...", "email": "...", "phone": "...", "role": "verifier", "password": "..." }` → 201 `UserRead`. Duplicate email → 409. **Password rule (FR-56, owner 2026-10-24, one function `app/core/passwords.py`):** at least **8 characters for a provider** and at least **10 for a verifier, editor or admin**, at most 128, **not a very common password** (the list `app/core/common_passwords.txt`, compared in lower case, for every role) and not the user's email. A refused password is a **422 with a plain sentence** in `detail` ("The password needs at least 10 characters.", "This password is too common. Choose another one.", "The password cannot be the same as the email.", "The password can be at most 128 characters."); the sentence never holds the password. The first-admin command (`python -m app.bootstrap_admin`) uses the same function with the admin rule.
- **PATCH:** `name`, `phone`, `role`, `is_active`, `password` (all optional). An admin cannot deactivate themselves (400). A `password` is checked with the rule above for the role the account **will have** (the sent `role`, else the stored one). **Making a provider staff (`role` verifier, editor or admin) needs a new `password` of at least 10 characters in the same request** (422 "To make a provider staff, give a new password of at least 10 characters in the same request."), so a short provider password never becomes a staff password; staff to provider needs none.
- Providers are linked to a listing by setting that listing's `owner_id` via `PATCH /admin/users/{user_id}` with `{ "listing_id": 12 }`.
- **Phase 10 clarifications (decision C10):** `GET /admin/users` answers `{ "items": [UserRead], "total": n }`, by id. `phone` is normalised to `+234…` (422 if it is not a Nigerian number); `email` is lower-cased and checked with a simple pattern (422); `name` 1 to 100 characters. Every role of `Role` may be created. `listing_id` is only allowed for a user whose role is `provider` (422 otherwise), must be an existing listing (404) and sets that listing's `owner_id`; a listing already owned by another user is a 409. `password` is hashed like the login password (in a thread pool) and never returned. A role change or deactivation applies on the user's next request (the role is read from the database). Every create or change writes an audit entry (`user_create`, `user_update`; no listing, `field_changed` is the field, never the password: the entry says only "changed"). All answers need the admin role (403 for others). **Tests:** a verifier and an editor get 403 · duplicate email 409 · short password 422 · an admin cannot deactivate themselves (400) · a deactivated user is blocked on the next request · linking a provider sets `owner_id` · the password hash is never in an answer or an audit entry.

### POST /admin/import
FR-39. Admin only. The request body is the CSV text with `Content-Type: text/csv` (decision E1 in `specs/2026-10-20-launch-readiness/requirements.md`: a multipart upload would need a new package). The screen reads the chosen file in the browser and sends its text.
Columns: `name, category, area, address, landmark, latitude, longitude, phone, is_24_hours`.
Creates `draft` listings. **Response 200:** `{ "created": 48, "errors": [ { "row": 7, "detail": "Unknown area" } ] }`

**Rules (decision E2):** at most 500 data rows and 1 MB (else 413 / 422 with a sentence); UTF-8, a leading byte-order mark ignored; the first row is the header and must hold every column above (any order, other columns ignored; else 422 naming the missing ones); row numbers count the header as row 1; a row with a problem is skipped and reported (`Name is required`, `Unknown category`, `Unknown area`, `Latitude must be a number from -90 to 90`, `Longitude must be a number from -180 to 180`, `Phone is not a Nigerian number`, `Already listed`, `is_24_hours must be true or false`) and the good rows are created in the same call as drafts owned by the caller, with the phone as the primary number and a `create` audit entry whose reference is `csv-import`; a row whose name and area already exist (any case, in the file before it or in the database) is `Already listed`, so importing the same file twice creates nothing the second time. `landmark` may be empty. No file is stored.

### GET /admin/export
FR-40. Admin only. **Query:** `type=listings` or `type=checks` (anything else is 422). Returns `text/csv; charset=utf-8` as an attachment (`listings.csv`, `checks.csv`). Columns (decision E3): listings `id, slug, name, category, area, address, landmark, latitude, longitude, phone, is_24_hours, status, last_verified_at, next_check_due`; checks `id, listing_id, listing_name, staff_name, method, result, person_reached, notes, photo_url, checked_at`. A cell that begins with `=`, `+`, `-`, `@`, a tab or a carriage return gets a `'` in front (CSV injection). Times are UTC ISO 8601.

### Phase 4a: approving, rejecting, suspending accounts and the activity log (FR-49, FR-55, US-18; owner's plan of 2026-10-24)

Feature `specs/2026-10-23-accounts-and-facility-ownership/`. **Every route here is admin only** (the role is read from the database row; 403 for any other role, 401 with no login). **No route deletes an account**, and a test fails if one is added.

**`GET /admin/users`** (replaces the plain list). **Query:** `role` (one of `Role`), `approval_status` (`pending`, `approved`, `rejected`), `is_active` (bool), `q` (text; part of the name or the email, any case), `limit` (1 to 200, default 100), `offset` (default 0). **Response 200:** `{ "items": [AdminUserRow], "total": n }`, `total` is the number of accounts that match the filters, oldest id first. An `AdminUserRow` is the old `UserRead` plus `approval_status`, `last_login_at`, `created_at`, `email_verified_at`, `phone_verified_at` and `signup_note` (what a staff sign-up wrote about themselves). It never holds a password, a hash, a code or the authenticator secret. A bad filter value is 422.

**The four decisions** (all `POST`, all answer 200 with the changed `AdminUserRow`; 404 `"User not found"`; 409 with a plain sentence when the account is not in the right state; nothing changes on an error):

| Route | Body | Rule |
| --- | --- | --- |
| `POST /admin/users/{id}/approve` | `{ "role": "editor" or "verifier" }` | The account must be `pending` (409 `"This account is not waiting for approval."`). Its **email must be confirmed** (409 `"The email is not confirmed yet."`) and its **phone must be confirmed**, by SMS or by the admin's call (409 `"Confirm the phone first: phone the person, then record 'phone confirmed by call'."`, D20). The role is `editor` or `verifier` only: `admin` or `provider` is 422, so nobody becomes an admin by approval (an admin is made by `POST /admin/users` or by another admin through `PATCH`). Sets `approval_status` `approved` and the role. |
| `POST /admin/users/{id}/reject` | `{ "reason"?: text, 500 characters at most }` | The account must be `pending` (409 as above). Sets `approval_status` `rejected`; the person can never log in again (the login says `"This account was not approved."`). |
| `POST /admin/users/{id}/suspend` | `{ "reason": text, 1 to 500 characters }` | The account must be active (409 `"This account is already suspended."`) and not closed. Sets `is_active` false: the next request of that person is refused. **An admin cannot suspend themselves** (400, the existing sentence), and the **last active admin can never be suspended**: the target must leave at least one other active, approved admin (409 `"This is the last active admin."`). |
| `POST /admin/users/{id}/reactivate` | none | The account must be suspended, approved and not closed (409 `"This account is not suspended."`). Sets `is_active` true. A rejected or closed account is not reactivated. |

**Audit (FR-38).** One entry per change, `user_id` = the admin, no listing: `user_approve` (`field_changed` `approval_status`, old `pending`, new `approved`) plus `user_update` for the `role` if it changed (old and new role); `user_reject` (`approval_status`, old `pending`, new `rejected`) and, when a reason was given, a second `user_reject` entry with `field_changed` `reason` and the reason as `new_value`; `user_suspend` (`is_active`, old `true`, new `false`) and a second entry with `field_changed` `reason`; `user_reactivate` (`is_active`, old `false`, new `true`). **The account the decision is about is in `reference` as `user:{id}`** on every one of these entries (the column is a free reference; payments use it for Paystack references, which never start with `user:`). No password, hash, phone, email or code is ever written.

**Email to the person** (Resend, best effort: a failure is logged without any address and never fails the decision; with no key nothing is sent): approved ("you can log in"), rejected (with the reason if one was given), suspended (with the reason), reactivated. Plain text, the app's name, no link, no code, no password, no medical text.

**`GET /admin/activity`**: the audit entries, newest first. **Query:** `user_id` (who did it), `action` (exact, e.g. `user_approve`), `from` and `to` (dates `YYYY-MM-DD`, both included, Africa/Lagos days), `limit` (1 to 200, default 50), `offset`. **Response 200:** `{ "items": [ { "id", "at", "user_id", "user_name", "action", "listing_id", "listing_name", "target_user_id", "target_user_name", "field_changed", "old_value", "new_value" } ], "total": n }`. `user_name` and `listing_name` are null when there is none (the nightly job, an anonymous submission). `target_user_id` and `target_user_name` are filled only for an entry whose `reference` is `user:{id}` (the decisions above), else null. Values are shown as stored (the account entries already hold only states, never a secret). The `reference` column itself is **not** returned (it can hold a Paystack reference).

**Tests (written first):** the filters and the page size · a verifier, an editor and a provider get 403 on every route here, anonymous 401 · approve as editor and as verifier, never as admin or provider (422) · approve refused for an account that is not pending, with an unconfirmed email, with an unconfirmed phone (then allowed after `confirm-phone-by-call`) · reject, with and without a reason, and the person can then never log in · suspend and reactivate, the next request of a suspended person is refused · an admin cannot suspend themselves and the last active admin cannot be suspended · reactivate refused for a rejected account · each audit entry exactly as listed · the emails (text, no password, a failure does not fail the decision) · the activity filters, order and paging, and that `reference` is not returned · no DELETE route exists under `/admin/users` · every route is in the OpenAPI list of routes that need a login (the Phase 2 test).

---

## 12. Scheduled job (not an endpoint)

`python -m app.jobs.recheck` — run nightly at 01:00 WAT (Render Cron Job).
Moves `published` listings with `next_check_due` in the past to `recheck_due`, writes audit entries (no user), and emails editors a summary.

**Phase 11 rules (decisions H4, H5):** no Render Cron Job is created (it is a paid service): the owner runs the command by hand or from a scheduler of their choice. Each moved listing gets an audit entry: no user, action `recheck`, field `status`, old `published`, new `recheck_due`, reference `nightly-recheck`. Then one email to every active editor and admin with the number moved and the listing names (never anything else); no SMS. With no Resend key nothing is sent, and a failed email never undoes the moves. The command prints one line with the number moved and exits 0. Running it again straight away moves nothing. A listing that is not `published`, or whose date is today or later, is not touched. **Tests:** the rules above, at a chosen time; the email goes to active editors and admins only; two runs.
