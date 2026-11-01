# Plan: Facility owner form, part (b): exact location, entrance photo, staff review, Request changes

Spec: [requirements.md](requirements.md). Validation: [validation.md](validation.md). Branch `feature/owner-form-location-photo`. Every task was tests first.

## Backend

- **The form** (`schemas/facility_registration.py`, `services/facility_registration_service.py`): `latitude`, `longitude` (both or neither, inside the
  box around Nigeria, constants in `core/config.py`) and `entrance_photo_url` (checked by `core/photo_address.py`: https, `res.cloudinary.com`,
  our cloud, the folder `swifthealth/owner-entrances`). A save with the field absent keeps what is stored; a null photo removes it. The save goes
  through `staff_listing_service.update_listing`, which now also knows `entrance_photo_url` (so the change is an audit entry). `GET
  /provider/requests/{link_id}` answers the pin, `map_pin_is_default`, the photo and `change_note`.
- **Uploads** (`api/routes/uploads.py`): new `POST /uploads/owner-sign` for the owner folder only, provider only, 20 a day per address
  (`core/rate_limit.py`, `api/dependencies.py`). The staff route is unchanged.
- **Staff review** (`services/owner_link_service.py`, `schemas/owner_link.py`): `GET /staff/owner-requests` shows every field of the listing;
  `POST /staff/owner-requests/{id}/request-changes` (editor and admin), two audit entries (`owner_changes_requested`, `owner_changes_note`).
  `GET /provider/listings` items gain `change_note`.
- **Tests:** `test_owner_form_location_photo.py` (pin, photo, audit), `test_owner_request_changes.py` (queue shows every field, request
  changes, notes, owner side, sending again), `test_uploads.py` (owner folder, roles, limit, 503); `test_owner_links.py` updated for the new keys.

## Frontend

- `lib/map/parseLocation.ts` (plain coordinates and long Google Maps links, short links recognised and not read, outside Nigeria refused);
  `config/map.ts` (the box around Nigeria).
- `components/map/PinPicker.tsx` (Leaflet, red draggable pin, tap to place, clamped to Nigeria);
  `components/facility/LocationFields.tsx` (use my location, paste, map, readout) and `PhotoField.tsx` (signed upload to the owner folder);
  both used by `RegisterFacility.tsx`. `lib/facility/requestForm.ts` and `lib/api/facility.ts` carry the pin and the photo.
- `components/admin/OwnerRequestDetails.tsx` and `OwnerRequests.tsx` (every field with the pin on a map, "Request changes");
  `lib/api/staff.ts` `requestOwnerChanges`; `MyFacilities.tsx` and the edit page show "Our team asked: …".
- **Tests:** `parseLocation.test.ts`, `PinPicker.test.tsx` (real Leaflet in jsdom), `OwnerLocationPhoto.test.tsx`, `OwnerRequests.test.tsx` (extended),
  `requestForm.test.ts`, `EditRequest.test.tsx`, `MyFacilities.test.tsx`, `ListYourFacility.test.tsx` (the picker is a stand-in).

## Specs

`specs/backend/api-spec.md` (section 7, "The exact location, the entrance photo, the staff review and Request changes"),
`specs/frontend/ui-spec.md` (2.9 and 3.10), `LOG.md` (rows FL1 to FL3).

## Tasks

- [ ] 1. Pin and photo in the form (API), with audit entries
- [ ] 2. `POST /uploads/owner-sign` for the owner folder
- [ ] 3. The staff queue shows every field; Request changes with a note in the audit log
- [ ] 4. The owner reads the note and sends again
- [ ] 5. `parseLocation`, `PinPicker`, `LocationFields`, `PhotoField`
- [ ] 6. Staff screen: every field, the map, Request changes
- [ ] 7. Specs, LOG, validation run
