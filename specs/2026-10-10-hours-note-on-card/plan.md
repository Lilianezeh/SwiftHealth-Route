# Show hours_note on the cards: plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and checks that
prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (FR-06, US-01, NFR-10) in every commit and test. Tick a box with its
commit hash only when the step is really done. Check `git branch --show-current` before every commit and push, and never push to
`main` (CLAUDE.md). The pull request stays a draft until the merge checklist in [validation.md](validation.md) is ticked.

## Files

| File | Change |
| --- | --- |
| `specs/frontend/ui-spec.md` | `ListingCard` row: the hours line (Task 0) |
| `specs/2026-10-09-search-frontend/validation.md` | The Figma "hours line" difference row (Task 0) |
| `specs/2026-10-10-hours-note-on-card/` | This folder (Task 0) |
| `specs/roadmap.md`, `LOG.md` | Status; the "refresh when the tab is reopened" idea (Task 0) |
| `frontend/src/types/api.ts` | Task 1: `ListingSummary.hours_note` |
| `frontend/src/components/listings/HoursNote.tsx` | Task 1: new, the icon and the text |
| `frontend/src/components/listings/ListingCard.tsx` | Task 1: the line under the address |
| `frontend/tests/helpers/api.ts`, `tests/unit/ListingCard.test.tsx`, `icons-in-components.test.tsx`, `search.test.ts` | Task 1: fixtures gain `hours_note`; new tests |
| `frontend/tests/unit/HoursNote.test.tsx`, `NearbySuggestions.test.tsx`, `SearchPage.test.tsx` | Task 1: new tests |

No backend change, no new package.

## Tasks

### Task 0: Spec (done, `658ab12`)
- [x] Write this folder, the UI spec sentence, the difference row, the roadmap line and the `LOG.md` notes (including the idea of
  refreshing stale results). Commit: `docs(specs): hours_note on the cards, spec (FR-06, US-01, NFR-10)`.

### Task 1: The line on the card (tests first) (done, `5ef2e6b`)
- [x] Write the tests (names in [validation.md](validation.md)) and give the fixtures `hours_note`. They fail: the component and
  the type do not exist.
- [x] Add the type, `HoursNote` and the line in `ListingCard`.
- [x] Run `npm run lint`, `npm run typecheck` and `npm test` in the frontend container, then commit:
  `feat(web): the card shows the next opening or closing time (FR-06, US-01, NFR-10)`.

### Task 2: Wrap-up
- [x] Run `npm run build` (page weight), push the branch and open the draft pull request (#18). Check that `Frontend CI` ran and
  `Backend CI` did not; write what `gh pr checks` shows in [validation.md](validation.md).
- [ ] The owner checks the live site after the merge (see [validation.md](validation.md)). Then update the roadmap and `LOG.md`,
  and tick the boxes with their commit hashes.
