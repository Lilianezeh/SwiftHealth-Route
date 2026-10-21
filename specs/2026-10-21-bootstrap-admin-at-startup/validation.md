# First admin at start-up: validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results (2026-10-21, branch `feature/bootstrap-admin-at-startup`)

- Backend: `pytest -q -W error` **1389 passed**; `ruff check .` clean. New: `test_bootstrap_admin_startup.py` (13 tests, among them 3 for the Dockerfile and the blueprint).
- Run for real in the development container (exit code 0 each time): no variable set (silent), one variable set (the missing names, no values), a password
  that is too short (a sentence naming the variable), and the full set against the TEST database (`admin already exists`, because an earlier test had made it).
- **Not run:** the step on Render. It runs the first time the service restarts with the four variables set.

## Security and privacy checklist
- [x] The password, the email, the phone and the text of a database error are never logged (tests read the log in every case)
- [x] The password is not in `render.yaml` or the Dockerfile (a test reads both)
- [x] An existing user is never overwritten (a test checks the password hash after a second run with another password)
- [x] A failure never stops the API from starting (the Dockerfile step ends with `|| echo`, and the function never raises)

## Merge checklist
- [ ] Both CIs green
- [ ] The owner adds the four variables in Render, lets the service restart, reads `first admin created` in the log, and deletes the variables
- [ ] The pull request stays a draft until the boxes above are ticked.
