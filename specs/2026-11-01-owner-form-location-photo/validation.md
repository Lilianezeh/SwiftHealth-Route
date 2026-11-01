# Validation: Facility owner form, part (b)

Spec: [requirements.md](requirements.md). Plan: [plan.md](plan.md). Boxes are ticked with the evidence at the end of the feature, after the owner
has looked at the preview. Check this file before saying the feature is done.

## Build results

(filled in with the real numbers from the final runs, see the pull request)

## Checks

- [ ] "Use my current location" asks the browser only after the tap, puts the pin there, shows it before saving, and the position is stored nowhere.
- [ ] A long Google Maps link and plain coordinates place the pin; a short link asks for the long link or the pin; a place outside Nigeria is refused.
- [ ] The pin can be dragged and the map can be tapped; it is the red facility pin of the listing page, never a cross.
- [ ] With no pin, the listing keeps the default centre and staff are told "The owner did not place the pin".
- [ ] A photo goes to the owner folder (signed for owners only), shows as a preview, can be removed, and only an https Cloudinary address of our account in the owner folder is accepted.
- [ ] Staff cannot sign for the owner folder and owners cannot sign for the staff folder; signing is limited to 20 a day.
- [ ] Owner requests shows every field with the pin on a map; the owner's email is shown to staff only and is in no public answer.
- [ ] Request changes needs a note, only works on a paid request that waits (`pending`), keeps the note in the audit log, and takes the card out of the queue.
- [ ] The owner sees "Our team asked: …" in My facilities and on the edit page, edits, sends again, and the request is back in the queue with "Last time you asked: …" and no new payment.
- [ ] Every changed field (including the pin and the photo) is an audit entry.
- [ ] Text is 16 px or more, targets 48 px or more, nothing runs past the screen at 320 px, and the map and the pin are readable in Light and Dark (real browser; the owner looks at the preview).
- [ ] The pin can be dragged with a finger on a real phone (not done by a test: jsdom has no touch dragging; the code path `dragend` is read, and tapping is tested).
- [ ] Backend tests and `ruff check .` pass; frontend `lint`, `typecheck` and `npm test` pass.

## Open for the owner

- Choices L5 to L11 in `requirements.md`.
- The owner is not emailed when staff ask for changes (L10); a request left in `changes_requested` is never cleaned up (L11).
- The photo upload was never tried against a real Cloudinary account: the tests use a fake (as for the staff photo, decision C8).
