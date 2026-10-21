# Staff screens and "List your facility" (Phase 10): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## How to run
- Backend: `docker compose exec backend pytest -q -W error` and `ruff check .`
- Frontend: `cd frontend && npm run lint && npm run typecheck && npm test`; real browser: `npx playwright test staff facility` (the browser needs three libraries from `apt-get download`, see the memory note of this machine in `LOG.md`)

## Results (2026-10-20)
- Backend: **1101 passed** with `-W error`, `ruff check` clean (the whole suite, 234 new since phase 9).
- Frontend: lint and typecheck clean; **1231 unit tests passed** in 92 files.
- Build: every new page builds (`/admin/login` 107 kB, `/admin/listings` 112 kB, the editor 118 kB, the log 115 kB, `/admin/staff` 112 kB, `/list-your-facility` 106 kB first load).
- Real browser, 320, 360, 768 and 1024 px: **52 of 52 passed** (staff: login with both steps and the landing by role, the list with a filter, the editor with all sections and a one-field save, Hide with a reason, the verification log in two taps, the staff accounts with the self-protection, a role that may not open a page and a visitor sent to the login; facility: a send, wrong phone and email named in words, the rate limit message). Nothing sideways, every control at least 48 px, every text at least 16 px. The API was faked in these checks (no staff password exists here and nothing is written to the database); the real rules are in the backend tests.
- Not checked by me: a real SMS code, a real Cloudinary upload (no account here: the signing follows Cloudinary's documented example and a test uses its example), a real phone camera, a real phone.
- Found on the way: the unit-test stubs of the router made the gate loop until the stub returned one object (a test artefact, Next.js's router is stable); the guard test of the page addresses and the `/meta` list test needed the new pages and list.

## Tests per task
- Task 1 (`b60b1c9`): `test_service_catalogue` (the seed's services are all in it, spellings, blood groups), `test_meta` (six lists).
- Task 2 (`2b09a6f`): `test_staff_listings_read` (every status, filters, `mine`, `due`, paging, the detail with `map_pin_is_default` and `submission_details`, provider 403, deactivated user blocked).
- Task 3 (`9114b83`): `test_staff_listings_write` (create for every role, slug numbers, 20 kinds of bad input, edit by role and ownership, one audit entry per changed field, lists replaced, no change writes nothing).
- Task 4 (`ffee546`): `test_staff_checks`, `test_listing_moves` (submit, publish with the dates and the 14-day rule, hide with the reason, reopen, the whole road to the public search, a failed check of a published listing hides it and alerts the editors).
- Task 5 (`4f991c8`): `test_cloudinary` (Cloudinary's documented signature example), `test_uploads` (503 without an account, the secret never in the answer, only the entrances folder).
- Task 6 (`fe66e26`): `test_facility_submissions` (a draft with no creator, the contact details only in the staff audit entry and in no public answer, the fourth a day is 429).
- Task 7 (`be6edd9`): `test_admin_users` (admin only, 409, 422, no self-lockout, a role change and a deactivation apply on the next request, a provider is linked, no password in any answer or audit entry).
- Tasks 8 to 13 (`d697119` to `ff6d845`): `requestStaff`, `staffSession`, `staffApi`, `StaffGate`, `LoginForm`, `AdminHome`, `StaffListings`, `staffListingForm`, `ListingEditor`, `VerificationLog`, `StaffAccounts`, `FacilityForm`.
- Task 14: `staff.spec.ts`, `facility.spec.ts` (with `tests/helpers/browserApi.ts`).

## Security and privacy checklist
- [x] Every staff endpoint loads the user from the database and checks role and `is_active` from that row (tests: a role change and a deactivation apply on the next request)
- [x] A verifier cannot publish, hide, reopen, edit another verifier's draft or open the staff accounts (tests, API and screens)
- [x] A provider has no access to any staff endpoint of this phase (tests)
- [x] A facility submission's contact details are in no public answer and not in the listing's `description` (tests)
- [x] No password or hash in any answer, log line or audit entry (tests; the audit entry says only "changed")
- [x] The session is in `sessionStorage` only; the token is in no address and no log (unit and browser checks)
- [x] The Cloudinary secret is never returned or logged; `photo_url` only from res.cloudinary.com (tests, API and form)
- [x] Every listing change and move writes an audit entry (tests)
- [ ] **For the owner, before real staff use:** SMS codes need Termii live; photos need `CLOUDINARY_URL` and `CLOUDINARY_UPLOAD_PRESET` on Render; staff accounts are created in `/admin/staff`, so the first admin must exist (the seed's admin, or one made by hand)

## Smoke test (owner)
See the end of [requirements.md](requirements.md).

## Merge checklist
- [x] Lint, typecheck, tests, build clean; numbers written above
- [ ] Both CIs green (checked after the pull request is opened)
- [x] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] The owner checked the preview (the API part shows only after the merge and the Render redeploy)
- [ ] The pull request stays a draft until every box above is ticked.
