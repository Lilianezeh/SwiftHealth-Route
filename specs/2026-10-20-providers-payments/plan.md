# Providers and featured listings (Phase 12): plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, one commit per task, IDs (FR-43 to FR-46, FR-19,
FR-38, NFR-06, NFR-10) in every commit and test; `git branch --show-current` before every commit and push; the PR stays a draft; Paystack test mode only.

## Files

| File | Change |
| --- | --- |
| `backend/app/schemas/provider.py`, `services/provider_service.py`, `api/routes/providers.py` | Task 1 |
| `backend/app/services/staff_listing_service.py`, `repositories/listing_repository.py` | Task 1: `update_listing` can start an urgent re-check; `get_by_owner_id` |
| `backend/app/integrations/paystack.py`, `core/config.py` (`web_app_url`, `featured_price`), `.env.example` | Task 2 |
| `backend/app/schemas/payment.py`, `repositories/audit_repository.py`, `services/payment_service.py`, `api/routes/payments.py` | Tasks 2 and 3 |
| `backend/app/services/search_service.py` | Task 4 |
| `frontend/src/types/staff.ts`, `lib/api/provider.ts`, `lib/staff/roles.ts`, `hooks/useProviderListing.ts`, `components/provider/*`, `components/admin/StaffBar.tsx`, `ListingFormFields.tsx`, pages `app/(dashboards)/provider/**` | Tasks 5 and 6 |
| `frontend/tests/unit/*`, `tests/end-to-end/provider.spec.ts` | each task |
| `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md` | Task 0 and Task 9 |

## Tasks

### Task 0: Spec
- [x] This folder, api-spec (sections 3, 7, 8) and ui-spec 4.1 to 4.4. (`f9f0277`, `9920d47`)
### Task 1: `GET` and `PATCH /provider/listing` (tests first)
- [x] Rules I1, I2: ownership, the four fields, 422 for others, audit, urgent re-check. (`4d4e380`)
### Task 2: `POST /payments/featured` and the Paystack integration (tests first)
- [x] Rules I3, I5, I10: kobo, test key only, errors. (`63d5193`)
### Task 3: webhook and verify (tests first)
- [x] Rules I4, I6 to I9: signature, idempotency, amount, 30 days, audit with reference. (`6a2b0af`)
### Task 4: the sponsored slot in `GET /search` (tests first)
- [x] Rule I11: one, first, not repeated, never emergency, never elsewhere. (`441e870`)
### Task 5: provider dashboard and edit screens (tests first)
- [x] `/provider`, `/provider/edit`, staff bar, gate. (`f770e80`)
### Task 6: get featured and payment complete (tests first)
- [x] `/provider/featured`, `/provider/payment-complete`. (`f770e80`, same commit as Task 5: one test file, one hook, one set of pages)
### Task 7: Sponsored label in the results (tests first)
- [x] The label shows only on the sponsored item; none in SwiftRescue or blood. (`f770e80`; the blood and SwiftRescue tests already existed)
### Task 8: real-browser checks at 320, 360, 768 and 1024 px
- [x] Layout and flow of the provider screens and the label: 28 checks passed. (`9e47030`)
### Task 9: Wrap-up
- [x] Suites, docs, draft PR (base `feature/reports-queue-dashboard`).
