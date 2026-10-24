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
  "service_catalogue": ["Antenatal care", "Blood bank", "Consultation", "X-ray"]
}
```
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

**Response 200:** `{ "challenge_token": "<jwt, 5 min>", "sent_to": "+234******0001" }`

**Rules:** wrong email or password → 401 with the same message for both. Inactive user → 403 (checked only after the password is correct). User with no phone number → 400. Sends the code by SMS; if no Termii key is set (local dev), logs the code to the API console instead. If the SMS cannot be sent → 502 `"Could not send the code. Try again."` and no challenge token is returned. Wrong-password and unknown-email requests take the same time (an unknown email still runs a dummy password check). Rate limited to 10 attempts per IP per 15 minutes → 429.

### POST /auth/verify-code
**Request:** `{ "challenge_token": "...", "code": "482913" }`

**Response 200:**
```json
{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 43200, "user": UserRead }
```
**Rules:** wrong, malformed or expired code or challenge → 401. User deactivated since login → 403. Sets `last_login_at`. Rate limited to 10 attempts per IP per 15 minutes → 429 (separate counter from login).

### GET /auth/me
Any logged-in user. Send the access token as `Authorization: Bearer <access_token>`. **Response 200:** `UserRead`

**Rules:** the access token only identifies the user (it carries no role). Every protected endpoint loads the user from the database and uses `role` and `is_active` from that row, so a role change or deactivation applies on the next request. Missing or invalid token → 401. Deactivated user → 403.

**Tests:** wrong password · wrong code · expired challenge · token works on `/auth/me` · inactive user blocked · user with no phone · login and verify-code rate limits (429) · role read from database.

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

---

## 12. Scheduled job (not an endpoint)

`python -m app.jobs.recheck` — run nightly at 01:00 WAT (Render Cron Job).
Moves `published` listings with `next_check_due` in the past to `recheck_due`, writes audit entries (no user), and emails editors a summary.

**Phase 11 rules (decisions H4, H5):** no Render Cron Job is created (it is a paid service): the owner runs the command by hand or from a scheduler of their choice. Each moved listing gets an audit entry: no user, action `recheck`, field `status`, old `published`, new `recheck_due`, reference `nightly-recheck`. Then one email to every active editor and admin with the number moved and the listing names (never anything else); no SMS. With no Resend key nothing is sent, and a failed email never undoes the moves. The command prints one line with the number moved and exits 0. Running it again straight away moves nothing. A listing that is not `published`, or whose date is today or later, is not touched. **Tests:** the rules above, at a chosen time; the email goes to active editors and admins only; two runs.
