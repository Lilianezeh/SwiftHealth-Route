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
  "report_reasons": ["not_working", "wrong_number", "closed", "moved", "wrong_hours", "other"]
}
```
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
4. Sponsored slot (FR-45, **built in roadmap phase 12c**; until then `sponsored` is always `false` and no listing is moved first): at most **one** listing with `featured_until` in the future that matches all filters (and is within the radius) is placed first with `sponsored: true`. It is not repeated lower down.

**Privacy (NFR-07):** `lat` and `lng` are a visitor's position. They are used for this request only. The server logs must never keep
them: the API access log shows `lat=redacted&lng=redacted`.

**Response 200:** `{ "items": [ListingSummary], "total": 37 }`

**Tests:** past-midnight open/closed (01:30 vs 03:00) · distance order · flagged listing excluded · overdue listing labelled `verification_due` · draft never returned · only one sponsored item.

### GET /listings/{slug}
FR-09 to FR-13, FR-47, US-06, US-07, FR-22. **Path:** `slug` (exact match; no query parameters). **Response 200:** `ListingDetail` · **404** `{ "detail": "Listing not found" }` if there is no listing with this slug, or its `status` is not `"published"` (draft, pending review, hidden and re-check due all look the same to the public, so nothing leaks about unpublished listings). A listing past its re-check date but still published is returned with `verification_due: true` (FR-08). The call changes nothing and writes no audit entry.
**Tests:** published returns 200 with every field · draft, pending, hidden, `recheck_due` and unknown slug return 404 · 7 opening-hours entries (missing day closed, past-midnight row) · primary phone first · `is_whatsapp` per phone (false unless set) · fees as 2-decimal strings, a null fee stays null · overdue listing has `verification_due: true` and is still returned · 2 different reporters in 7 days set `recently_reported_not_working` and the listing is still returned · 1 reporter, an old report, a resolved report, and 2 reports from the same reporter do not · `hours_note` and `is_open_now` agree with `/search` · none of the internal fields appear · the number of database queries does not grow with the number of phones or services.

### GET /emergency
FR-14 to FR-19, FR-25, FR-26. The SwiftRescue page data.

**Query:** `lat`, `lng` (optional).

**Response 200:**
```json
{
  "national_line": { "name": "National emergency number", "number": "112" },
  "groups": [
    { "category": { "slug": "ambulance", "name": "Ambulance" }, "contacts": [ListingSummary] }
  ],
  "pharmacies_24h": [ListingSummary],
  "disclaimer": "SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In danger, call 112."
}
```

**Rules:** `groups` always has all seven groups, in this order (category slugs): Ambulance `ambulance`, Fire `fire`, Police `police`, 24-hour emergency units `emergency-unit`, Roadside assistance `roadside-assistance`, Security `security`, Blood banks `blood-bank`. A group with no contact has `"contacts": []` (the page hides it). Within a group, nearest first if a location is given, otherwise by name (then id). No sponsored placement anywhere: every item has `sponsored: false`, even a listing with `featured_until` in the future (FR-19). `pharmacies_24h` = published pharmacies with `is_24_hours = true`, nearest first (by name without a location), max 10, with no distance limit. The trust rules of section 1 apply (published only, overdue ones stay with `verification_due: true`) and a listing flagged by FR-22 is left out, as in `/search`. `is_open_now` and `hours_note` are filled as in `/search`. `lat` and `lng` come together or not at all (else 422) and are never logged (NFR-07). `national_line` is a constant of the API, so `112` is present even with an empty database.

**Tests:** 112 always present · all seven groups in order, empty ones as `[]` · nearest first with a location, by name without · no `sponsored: true` anywhere, even for a featured listing · only confirmed 24-hour pharmacies, max 10 · draft, hidden and flagged listings left out · `lat` without `lng` is a 422.

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

**Rules:** creates a `draft` listing (no `created_by`) with the submitted details; contact details go in `description` for the verifier. Writes an audit entry.

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

---

## 7. Provider

### GET /provider/listing
FR-43. Provider only. Their own listing (`owner_id` = caller) as `ListingDetail` plus `status`, `featured_until`. 404 if none linked.

### PATCH /provider/listing
FR-43. Provider only. **Allowed fields:** `description`, `services`, `opening_hours`, `phones`.
**Rules:** any change to `phones` or `opening_hours` sets `next_check_due` = now (urgent re-check; listing stays visible with `verification_due: true`). Audit entry per field. Any other field → 422.

**Tests:** provider cannot read or edit another provider's listing · phone change triggers urgent re-check.

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

---

## 11. Admin

### GET /admin/users · POST /admin/users · PATCH /admin/users/{user_id}
FR-41. Admin only.
- **POST request:** `{ "name": "...", "email": "...", "phone": "...", "role": "verifier", "password": "..." }` → 201 `UserRead`. Duplicate email → 409. Password at least 10 characters.
- **PATCH:** `name`, `phone`, `role`, `is_active`, `password` (all optional). An admin cannot deactivate themselves (400).
- Providers are linked to a listing by setting that listing's `owner_id` via `PATCH /admin/users/{user_id}` with `{ "listing_id": 12 }`.

### POST /admin/import
FR-39. Admin only. `multipart/form-data` with a CSV file.
Columns: `name, category, area, address, landmark, latitude, longitude, phone, is_24_hours`.
Creates `draft` listings. **Response 200:** `{ "created": 48, "errors": [ { "row": 7, "detail": "Unknown area" } ] }`

### GET /admin/export
FR-40. Admin only. **Query:** `type=listings` or `type=checks`. Returns `text/csv`.

---

## 12. Scheduled job (not an endpoint)

`python -m app.jobs.recheck` — run nightly at 01:00 WAT (Render Cron Job).
Moves `published` listings with `next_check_due` in the past to `recheck_due`, writes audit entries (no user), and emails editors a summary.
