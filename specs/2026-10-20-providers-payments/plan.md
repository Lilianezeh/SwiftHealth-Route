# Providers and featured listings (Phase 12): plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, one commit per task, IDs (FR-43 to FR-46, FR-19,
FR-38, NFR-06, NFR-10) in every commit and test; `git branch --show-current` before every commit and push; the PR stays a draft; Paystack test mode only.

## Files

| File | Change |
| --- | --- |
| `backend/app/schemas/provider.py`, `services/provider_service.py`, `api/routes/providers.py` | Task 1 |
| `backend/app/services/staff_listing_service.py` | Task 1: `update_listing` returns the names of the fields it changed |
| `backend/app/integrations/paystack.py`, `core/config.py` (`web_app_url`), `.env.example` | Task 2 |
| `backend/app/schemas/payment.py`, `repositories/audit_repository.py`, `services/payment_service.py`, `api/routes/payments.py` | Tasks 2 and 3 |
| `backend/app/services/search_service.py`, `repositories/search_repository.py` | Task 4 |
| `frontend/src/types/staff.ts` (provider types), `lib/api/provider.ts`, `lib/staff/roles.ts`, `components/provider/*`, `components/admin/StaffBar.tsx`, `ListingFormFields.tsx`, pages `app/(dashboards)/provider/**` | Tasks 5 to 7 |
| `frontend/tests/unit/*`, `tests/end-to-end/provider.spec.ts` | each task |
| `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md` | Task 0 and Task 9 |

## Tasks

### Task 0: Spec
- [ ] This folder, api-spec (sections 3, 7, 8) and ui-spec 4.1 to 4.4.
### Task 1: `GET` and `PATCH /provider/listing` (tests first)
- [ ] Rules I1, I2: ownership, the four fields, 422 for others, audit, urgent re-check.
### Task 2: `POST /payments/featured` and the Paystack integration (tests first)
- [ ] Rules I3, I5, I10: kobo, test key only, errors.
### Task 3: webhook and verify (tests first)
- [ ] Rules I4, I6 to I9: signature, idempotency, amount, 30 days, audit with reference.
### Task 4: the sponsored slot in `GET /search` (tests first)
- [ ] Rule I11: one, first, not repeated, never emergency, never elsewhere.
### Task 5: provider dashboard and edit screens (tests first)
- [ ] `/provider`, `/provider/edit`, staff bar, gate.
### Task 6: get featured and payment complete (tests first)
- [ ] `/provider/featured`, `/provider/payment-complete`.
### Task 7: Sponsored label in the results (tests first)
- [ ] The label shows only on the sponsored item; none in SwiftRescue or blood.
### Task 8: real-browser checks at 320, 360, 768 and 1024 px
- [ ] Layout and flow of the provider screens and the label.
### Task 9: Wrap-up
- [ ] Suites, docs, draft PR (base `feature/reports-queue-dashboard`).
