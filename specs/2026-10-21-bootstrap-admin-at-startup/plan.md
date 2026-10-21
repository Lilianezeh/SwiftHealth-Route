# First admin at start-up: plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, IDs (FR-41, FR-30, NFR-06, NFR-07) in the commit and
the tests; `git branch --show-current` before every commit and push; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `backend/tests/integration/test_bootstrap_admin_startup.py` | Task 1: the tests (written first) |
| `backend/app/bootstrap_admin.py` | Task 1: `AdminAlreadyExistsError`, `run_at_startup`, `main_at_startup`, the `--at-startup` argument |
| `backend/Dockerfile` | Task 1: the new step between the demo listings step and the API |
| `specs/2026-10-20-launch-readiness/release-checklist.md`, `LOG.md` | Task 2: the new steps for the owner |

## Tasks

### Task 1: the start-up step (tests first)
- [x] All four set creates and logs "first admin created"; the email exists logs "admin already exists" and changes nothing; none set is silent; some set names the missing ones; bad values and a database failure never raise; the log holds no secret; the Dockerfile order.
### Task 2: the owner steps
- [x] Step 3 of the release checklist and the LOG correction.
