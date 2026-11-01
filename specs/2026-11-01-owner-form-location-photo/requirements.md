# Requirements: Facility owner form, part (b): exact location, entrance photo, staff review, Request changes

Branch `feature/owner-form-location-photo`. Status: **spec written (2026-11-01); built tests first; draft pull request.** Part 1(b) of the owner's
request of 2026-11-01 (Part 1(a) is pull request #86, merged). The owner's answers 5 and 6 of that day are in "Decisions".

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| US-17 | A facility owner lists their facility with a complete, accurate form | Must |
| US-02 | A visitor can see exactly where a facility is | Must |
| FR-50 | Register a facility through a provider account; staff check it | Must |
| FR-32 | An entrance photo, sent straight to Cloudinary with a signed upload | Must |
| FR-31 | Every listing change writes an audit entry | Must |
| NFR-06 | A provider reaches only their own requests; uploads are signed per role | Must |
| NFR-07 | Privacy: the owner's position is not stored by the browser or logged; the owner's email is for staff only | Must |
| NFR-10 | 16 px text, 48 px targets, works at 320 px, readable in Light and Dark | Must |

## What the owner asked (Part 1, items for this part)

1. **Exact location** on the form: a **"Use my current location"** button, a small map with a **draggable red pin**, a place to **paste a Google
   Maps link or coordinates**, and the chosen spot shown **before saving**. Staff can correct the pin (they can already, in the editor).
2. An optional **entrance photo upload**.
3. **Staff review**: in Owner requests staff see **every field**, with the pin on a map, before approving.
4. **Request changes**: staff send a request back **with a note**; the owner edits and sends it again.

## Decisions (owner, 2026-11-01)

| ID | Decision |
| --- | --- |
| L1 | The pin is the red facility pin of the listing page, **never a cross**. It is the owner's pin picker (the exception in the UI spec, 2.3). |
| L2 | **Long Google Maps links and plain coordinates** are read. For a **short link** (maps.app.goo.gl, goo.gl/maps) the form asks for the long link or for the pin to be moved. |
| L3 | **Owner photos go to an owner-only Cloudinary folder** (`swifthealth/owner-entrances`), signed for providers only; staff keep `swifthealth/entrances`. |
| L4 | **"Request changes"** puts the link in the new state `changes_requested` (already added in part (a), plain text). **The staff note is kept in the audit log.** |

## Choices made in this part (for the owner to confirm)

| ID | Choice |
| --- | --- |
| L5 | The location is **optional** on the form. Without it the listing keeps the default map pin and the staff review says so ("the owner did not place the pin") so staff move it. |
| L6 | A pin outside Nigeria's bounding box (latitude 4 to 14, longitude 2.5 to 15) is refused by the browser and the API: it is almost always a typing mistake. |
| L7 | The owner's position from "Use my current location" is read by the browser **on the tap only**, becomes the pin, and is **not stored, not logged, not sent anywhere except as the pin the owner chose to save** (it is then the facility's coordinates, which are public anyway). |
| L8 | A photo link is accepted only if it is an `https://res.cloudinary.com/<our cloud>/...` address inside the owner folder; the browser checks the same. The file is at most 5 MB and an image. |
| L9 | In a form save, an **absent** `latitude`, `longitude` or `entrance_photo_url` **keeps what is stored**; an explicit `null` photo **removes** it. |
| L10 | Staff can **Request changes** only on a request that is `pending` (paid, waiting). The owner is not emailed in this part. |
| L11 | A request left in `changes_requested` is never cleaned up automatically. |
