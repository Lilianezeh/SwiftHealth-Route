# The next opening or closing time on search results: plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and checks
that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (FR-06, US-01, FR-05, NFR-02) in every commit and test. Tick a box with
its commit hash only when the step is really done. Check `git branch --show-current` before every commit and push, and never
push to `main` (CLAUDE.md). The pull request stays a draft until the merge checklist in [validation.md](validation.md) is ticked.

## Files

| File | Change |
| --- | --- |
| `specs/backend/api-spec.md` | `ListingSummary`: the `hours_note` field and its rules (Task 0) |
| `specs/2026-10-10-next-open-close-time/` | This folder (Task 0) |
| `specs/roadmap.md`, `LOG.md` | Status; the English-only reminder (Task 0) |
| `backend/app/services/hours.py` | Task 1: `NextChange`, `next_change(...)`, `describe_next_change(...)`, `hours_note(...)` |
| `backend/app/schemas/listing.py` | Task 2: `hours_note: str \| None` |
| `backend/app/services/search_service.py` | Task 2: `to_summary` fills it for the returned page |
| `backend/tests/unit/test_hours.py` | Task 1: `next_change`, the wording, and the week-long consistency check |
| `backend/tests/integration/test_search.py` | Task 2: the field in the answer, with a fixed clock |
| `backend/tests/unit/test_search_service.py` | Task 2 (if it builds a `ListingSummary`): the new field |

No migration, no model change, no frontend change.

## Tasks

### Task 0: Spec (done, `a265f68`)
- [x] Write this folder, the api-spec text, the roadmap line and the `LOG.md` notes (including "English only"). Commit:
  `docs(specs): the next opening or closing time on search results, spec (FR-06, US-01, FR-05)`.

### Task 1: The hours logic (tests first) (done, `2aac578`)
- [x] Write the tests for `next_change`, the wording and the consistency check (names in [validation.md](validation.md)).
  They fail: the functions do not exist.
- [x] Write `next_change`, `describe_next_change` and `hours_note` in `services/hours.py` (plain `def`: pure logic, no waiting).
- [x] Run `pytest -q -W error` and `ruff check .` in the backend container, then commit:
  `feat(search): the next opening or closing time, in Lagos time (FR-06, US-01, FR-05)`.

### Task 2: In the search answer (tests first) (done, `e76e18e`)
- [x] Write the integration tests (the field is in every item; the values for open, closed and 24-hour listings with a fixed
  clock; the field never disagrees with `is_open_now`; paging gives it to every returned item). They fail.
- [x] Add the field to `ListingSummary` and fill it in `to_summary`.
- [x] Run `pytest -q -W error` and `ruff check .`, time `GET /search`, then commit:
  `feat(search): GET /search returns hours_note (FR-06, US-01)`.

### Task 3: Wrap-up
- [x] Push the branch and open the draft pull request (#17). Check that `Backend CI` ran and `Frontend CI` did not; write what
  `gh pr checks` shows in [validation.md](validation.md).
- [ ] After the merge and the deploy, the owner checks production (see [validation.md](validation.md)). Then update the roadmap
  and `LOG.md`, and tick the boxes with their commit hashes. The card change is the next frontend PR.
