# Staff screens and "List your facility" (Phase 10): plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, one commit per task, IDs (US-10, FR-30 to FR-32,
FR-36 to FR-38, FR-41, FR-42, NFR-06, NFR-07) in every commit and test; `git branch --show-current` before every commit and push; never push to `main`; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `backend/app/core/service_catalogue.py`, `core/config.py`, `schemas/meta.py`, `services/meta_service.py` | Task 1: the catalogue, `DEFAULT_MAP_CENTRE`, `service_catalogue` in `/meta` |
| `backend/app/schemas/staff_listing.py`, `repositories/listing_repository.py`, `services/staff_listing_service.py`, `api/routes/listings.py` | Tasks 2 and 3: staff read, create, edit |
| `backend/app/repositories/verification_repository.py`, `services/verification_service.py`, `services/listing_status_service.py`, `api/routes/verifications.py` | Task 4: checks and moves |
| `backend/app/integrations/cloudinary.py`, `api/routes/uploads.py`, `core/config.py` | Task 5 |
| `backend/app/schemas/submission.py`, `services/submission_service.py`, `api/routes/public.py`, `core/rate_limit.py` | Task 6 |
| `backend/app/schemas/admin_user.py`, `services/admin_user_service.py`, `api/routes/admin.py` | Task 7 |
| `frontend/src/lib/staff/`, `lib/api/staff.ts`, `lib/api/request.ts`, `types/staff.ts` | Task 8: the session and the staff API |
| `frontend/src/app/(dashboards)/admin/**`, `components/admin/**` | Tasks 8 to 12 |
| `frontend/src/app/(public)/list-your-facility/page.tsx`, `components/facility/**` | Task 13 |
| `frontend/tests/unit/*`, `frontend/tests/end-to-end/staff.spec.ts`, `facility.spec.ts` | each task; Task 14 |
| `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md` | Task 0 and Task 15 |

## Tasks

### Task 0: Spec
- [x] This folder, the api-spec text and the ui-spec text (`647790a`).

### Task 1: the service catalogue and `/meta` (tests first)
- [x] The catalogue (alphabetical, canonical spelling), the same-service matching, the default map centre (`b60b1c9`).

### Task 2: staff read: `GET /listings`, `GET /listings/id/{id}` (tests first)
- [x] Filters, roles, the staff detail with `map_pin_is_default` (`2b09a6f`).

### Task 3: create and edit: `POST /listings`, `PATCH /listings/{id}` (tests first)
- [x] Validation, slug, audit per field, ownership (`9114b83`, `d7cd677`).

### Task 4: checks and status moves (tests first)
- [x] Checks and history, submit, publish, hide, reopen, the failed-check rule and the alert (`ffee546`).

### Task 5: `POST /uploads/sign` (tests first)
- [x] Signature, 503 without a key, the folder rule (`4f991c8`).

### Task 6: `POST /facility-submissions` (tests first)
- [x] Draft, audit-only contact details, rate limit (`fe66e26`).

### Task 7: staff accounts: `/admin/users` (tests first)
- [x] List, create, edit, link a provider, the rules (`be6edd9`).

### Task 8: the staff session, the gate, the login screen and `/admin` (tests first)
- [x] `d697119`
### Task 9: the listings list (tests first)
- [x] `81dc833`
### Task 10: the listing editor (tests first)
- [x] `274001b`, `afd4ff9`
### Task 11: the verification log and the status buttons (tests first)
- [x] `67a7744` (the status buttons are in the editor, Task 10)
### Task 12: the staff accounts screen (tests first)
- [x] `ec93d43`
### Task 13: the "List your facility" form (tests first)
- [x] `ff6d845`
### Task 14: real-browser checks at 320, 360, 768 and 1024 px
- [x] `staff.spec.ts`, `facility.spec.ts` and `tests/helpers/browserApi.ts`, in the wrap-up commit
### Task 15: Wrap-up (suites, docs, draft PR with base `feature/reports`)
- [x] The PR number is in `LOG.md`, "Unattended run".
