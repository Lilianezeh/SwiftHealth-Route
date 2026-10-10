# Hide the emergency categories in the Filters sheet: plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and checks
that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (FR-05, FR-15, FR-01, NFR-10) in every commit and test. Tick a box with
its commit hash only when the step is really done. Check `git branch --show-current` before every commit and push, and never
push to `main` (CLAUDE.md). The pull request stays a draft until the merge checklist in [validation.md](validation.md) is ticked.

## Files

| File | Change |
| --- | --- |
| `specs/frontend/ui-spec.md` | 2.3 item 1: which categories the sheet offers, in which order, and the selected-from-a-link rule (Task 0) |
| `specs/2026-10-10-hide-emergency-filters/` | This folder (Task 0) |
| `specs/roadmap.md`, `LOG.md` | Status of the item (Task 0, and again after the merge) |
| `frontend/src/components/search/FiltersDialog.tsx` | Task 1: `categoryChoices` filters, sorts and keeps the selected one |
| `frontend/tests/helpers/api.ts` | Task 1: `META.categories` becomes the 12 categories of production, in production's id order |
| `frontend/tests/unit/FiltersDialog.test.tsx` | Task 1: new tests |

No backend change, no new package, no change to `GET /meta`, the Find page or `/search`.

## Tasks

### Task 0: Spec (done, `7919925`)
- [x] Write this folder, the UI spec sentence, the roadmap line and the `LOG.md` note. Commit:
  `docs(specs): hide the emergency categories in the Filters sheet, spec (FR-05, FR-15, NFR-10)`.

### Task 1: The sheet (tests first) (done, `846c879`)
- [x] Widen `META.categories` in `tests/helpers/api.ts` to the 12 categories, in the order production gives, and write the tests
  (names in [validation.md](validation.md)). They fail: today the sheet lists whatever `/meta` gives.
- [x] Add the pure function `lib/search/categoryChoices.ts` (`chooseFilterCategories`, with its own unit tests) and use it for
  `categoryChoices` in `FiltersDialog.tsx` (decisions 1 to 3). (The plan said one function in the dialog; a separate small
  file is easier to test.)
- [x] Run `npm run lint`, `npm run typecheck` and `npm test` (on the host, because Docker Desktop was off), then commit:
  `feat(web): the Filters sheet offers only everyday categories, in the Find order (FR-05, FR-15, NFR-10)`.

### Task 2: Wrap-up
- [ ] Push the branch and open the draft pull request. Check that `Frontend CI` ran and `Backend CI` did not; write what
  `gh pr checks` shows in [validation.md](validation.md).
- [ ] The owner checks the Netlify preview (see [validation.md](validation.md)). After the merge, update the roadmap and
  `LOG.md`, and tick the boxes with their commit hashes.
