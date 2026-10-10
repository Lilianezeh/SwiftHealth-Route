# Show hours_note on the cards (small frontend PR): requirements

What this small frontend change must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it
is done is in [validation.md](validation.md). It follows the
[backend change](../2026-10-10-next-open-close-time/requirements.md): `GET /search` now returns `hours_note`, and in production
it is already filled. The card ignores it until this PR.

## Requirements

- **FR-06:** each result shows name, category, distance, open or closed status, and the Call and Directions buttons. The status
  now has a second line of meaning: when the listing next closes or opens.
- **US-01:** a resident finds an open place quickly. "Closes 9:00 PM" tells them if it is worth the trip.
- **NFR-10:** 16 px text, tokens only, words and an icon that is decorative and beside a label, no sideways scrolling at 320 px.

Source of truth: [ui-spec.md](../frontend/ui-spec.md) (the `ListingCard` row), [api-spec.md](../backend/api-spec.md)
(`ListingSummary`, `hours_note`), [prd.md](../prd.md). Branch: `feature/hours-note-on-card`. Every commit and test references
these IDs.

Fit with the project: [mission.md](../mission.md) wants a resident to find open care quickly; [tech-stack.md](../tech-stack.md) is
unchanged. No new package, no backend change.

## In scope

- `ListingSummary` in `types/api.ts` gets `hours_note: string | null`.
- A small component `HoursNote` (a `Clock` icon and the text) and one line in `ListingCard`, under the address block.
- The UI spec's `ListingCard` row and the Figma "hours line" difference row say so (Task 0).

## Out of scope (planned elsewhere)

- Refreshing the results when a tab is reopened after a long time (`LOG.md`, "idea"): the text and the "Open now" badge are fixed
  at the moment the results load.
- The listing page's weekly hours (`ListingDetail`): roadmap phase 6.
- The words themselves, English only: `LOG.md`. The backend writes them.

## Decisions (owner, 2026-10-10)

1. **Under the address, as in the Figma reference.** A grey line in the details block of the card, not in the badge row (which
   would crowd a 320 px screen).
2. **The `Clock` icon.** It is also used by the amber "Verification due" label. Here it is grey (`ink-soft`) and beside plain
   text, so it does not read as a warning. The icon is decorative (`aria-hidden`) and always beside the text.
3. **Nothing when `hours_note` is `null` (or empty).** For a 24-hour listing the badge already says "Open 24 hours"; for a
   listing with no hours recorded there is no honest thing to say. No empty row, no gap, no icon. A "Hours not recorded" line
   was considered and left out.
4. **Text only.** The note is rendered as text (React escapes it), never as HTML, and the card does not parse or change it.
5. **The type is required, not optional.** `hours_note: string | null` matches the api-spec: the API always sends the key.
