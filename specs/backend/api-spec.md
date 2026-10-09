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
  "sponsored": false
}
```

- `distance_km` is `null` when the caller sends no location.
- `sponsored` is `true` only for a featured listing shown in a sponsored slot (see `/search`).

### ListingDetail

`ListingSummary` plus:

```json
{
  "landmark": "Opposite the market",
  "description": "Open late every day.",
  "entrance_photo_url": "https://res.cloudinary.com/...",
  "phones": [ { "number": "+2348030000000", "label": "Front desk", "is_primary": true } ],
  "opening_hours": [
    { "day_of_week": 0, "opens_at": "20:00", "closes_at": "02:00", "is_closed": false }
  ],
  "services": [
    { "name": "Malaria test", "fee_min_naira": "1500.00", "fee_max_naira": "3000.00", "fee_collected_at": "2026-09-28" }
  ],
  "disclaimer": "SwiftHealth is a directory and does not give medical advice. Fees are estimates; confirm with the facility."
}
```

- `opening_hours` always has 7 entries, `day_of_week` 0 = Monday … 6 = Sunday. `closes_at` earlier than `opens_at` means the shift runs past midnight.

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
  "blood_groups": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  "report_reasons": ["not_working", "wrong_number", "closed", "moved", "wrong_hours", "other"]
}
```

### GET /search — the hard part
FR-04 to FR-08, US-01, US-05. Open-now, nearest-first search over trusted listings.

**Query parameters**

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `q` | string | – | Matches name, area, service names; tolerant of small misspellings (PostgreSQL `pg_trgm` similarity). Max 100 characters. |
| `category` | string | – | Category slug |
| `service` | string | – | Service name, e.g. `X-ray` |
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

**Response 200:** `{ "items": [ListingSummary], "total": 37 }`

**Tests:** past-midnight open/closed (01:30 vs 03:00) · distance order · flagged listing excluded · overdue listing labelled `verification_due` · draft never returned · only one sponsored item.

### GET /listings/{slug}
FR-09 to FR-13, US-06, US-07. **Response 200:** `ListingDetail` · **404** if not published.

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

**Rules:** groups in this order: Ambulance, Fire, Police, 24-hour emergency units, Roadside assistance, Security, Blood banks. Within a group, nearest first if location given. No sponsored placement anywhere. `pharmacies_24h` = published pharmacies with `is_24_hours = true`, nearest first, max 10.

**Tests:** 112 always present · no `sponsored: true` anywhere · only confirmed 24-hour pharmacies.

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

**Rules:** `listing_id` must be published (else 404). The report stores `reporter_key`: the keyed hash `hash_reporter_key` of the normalised phone if given, else of the client IP (never the raw IP). If this makes 2+ `not_working` reports from different reporters (different `reporter_key`) within 7 days, set the listing to `recheck_due`, write an audit entry, and email editors (Resend) and SMS the admin (Termii).

**Tests:** creates report · auto-flag after second report · rate limit returns 429.

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
  "phones": [ { "number": "08030000000", "label": "Front desk", "is_primary": true } ],
  "opening_hours": [ { "day_of_week": 0, "opens_at": "20:00", "closes_at": "02:00", "is_closed": false } ],
  "services": [ { "name": "Malaria test", "fee_min_naira": "1500.00", "fee_max_naira": "3000.00", "fee_collected_at": "2026-09-28" } ]
}
```
**Response 201:** staff `ListingDetail`

**Rules:** slug generated from name + area (unique; add `-2`, `-3` if taken). `created_by` = caller. Exactly one primary phone. `area` must be in `/meta` areas. Audit entry `create`.

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
