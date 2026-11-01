# Plan: Facility owner form, part (a): fields, draft, statuses, fee text

Spec: [requirements.md](requirements.md). Validation: [validation.md](validation.md). Branch `feature/owner-form-fields`. Every task was tests first.

## Backend

- **Migration** `e4f6a8b0c2d4_listing_email.py`: `listings.email`, nullable text. No table is added; the 10 stay. Test:
  `tests/integration/test_listing_email_migration.py`.
- **Link states** `draft` and `changes_requested` in `models/base.py` (`LinkStatus`; plain text, no enum migration).
- **Schemas:** `schemas/facility_registration.py` (`FacilityRegister` gets landmark, description, email, `phone_has_whatsapp`, `other_phones`,
  `is_24_hours`, `opening_hours`, `services`, `save_as_draft`; new `OtherPhone`, `FacilityRequestRead`); `schemas/staff_listing.py` (`email` on
  the create, update and staff detail shapes, never on a public one); `schemas/owner_link.py` (`listing_status`).
- **Service** `services/facility_registration_service.py`: `register_facility` saves every field and makes the link `draft` or
  `awaiting_payment`; new `read_request` and `save_request` (edits through `staff_listing_service.update_listing`, so every changed field is an
  audit entry; the state change and the listing change are one commit). `services/owner_fee_service.py`: `fee_state` knows the two new states;
  withdrawing a `changes_requested` request gives the payment back.
- **Repositories:** `facility_owner_repository.request_link(status=)`; `listing_repository` duplicate checks can leave one listing out;
  `not_an_unpaid_request` also hides a draft from staff.
- **Routes** `api/routes/providers.py`: `GET` and `PUT /provider/requests/{link_id}`.
- **Tests:** `tests/integration/test_owner_form_fields.py` (38): every field kept, the short form still works, bad fields give 422, blank means
  none, 24 hours, draft makes a `draft` link and asks for no payment, staff see nothing of a draft, a draft cannot be paid, duplicates, reading and
  editing, another provider gets 404, sending a draft and sending a request that needed changes, other states give 409, the statuses in
  `GET /provider/listings`, withdrawing, and the email is staff only.

## Frontend

- `lib/api/facility.ts` (the full body, `getFacilityRequest`, `saveFacilityRequest`); `lib/api/request.ts` allows `PUT`.
- `lib/facility/requestForm.ts` (values, checks in words, body, filling again) and `lib/formatters/ownerStatus.ts` (the five words).
- `hooks/useOwnerFee.ts`: the amount for the fee words, from `GET /provider/listings`.
- `components/facility/RequestFields.tsx` (more phones, opening hours, services); `RegisterFacility.tsx` (the form, now also for a saved request);
  `EditRequest.tsx` and `app/(dashboards)/provider/request/page.tsx`; `ListYourFacility.tsx` (the placeholder no longer says "free").
- `components/provider/MyFacilities.tsx` and `types/staff.ts`: the statuses, "Edit and send", "Delete this draft".
- **Tests:** `requestForm.test.ts`, `ownerStatus.test.ts`, `EditRequest.test.tsx` (new); `ListYourFacility.test.tsx` and `MyFacilities.test.tsx`
  (updated and extended).

## Specs

`specs/backend/api-spec.md` ("The full owner form and drafts"), `specs/frontend/ui-spec.md` (2.9 and 4.2b), `LOG.md` (rows FD1 to FD4).

## Tasks

- [ ] 1. Migration, model and link states
- [ ] 2. Registration with the full form, and Save as draft
- [ ] 3. Reading and editing a request; sending
- [ ] 4. Statuses in `GET /provider/listings`; withdrawing; staff see nothing of a draft
- [ ] 5. Frontend helpers (form values, checks, body, status words)
- [ ] 6. The form: new fields, fee words, Save as draft
- [ ] 7. Edit a saved request; My facilities statuses
- [ ] 8. Specs, LOG, validation run
