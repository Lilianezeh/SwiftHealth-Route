# Validation: automatic sign-out after no activity

Check every line before the pull request leaves draft.

## Done by me (2026-10-29)

- [x] Backend: `ruff check .` clean; the whole backend suite passes (2216 passed, 5 skipped) including `tests/integration/test_idle_session.py` (login `expires_in` per role, both limits are settings, an idle token is refused, keep-alive gives a fresh token with the role of the database, keeps the session start, refuses a session older than 12 hours, 401 without a token, 403 for a deactivated account, 401 for a token made before a password change) and the new cases in `test_security.py` and `test_config.py`.
- [x] Frontend: `tsc --noEmit` and `eslint` clean; new `IdleSignOut.test.tsx` (25 tests: who is watched, the limits, the warning text and its accessibility, Stay signed in, sign-out, a sleeping computer, 401 and other failures of the renewal, each kind of activity, activity in another tab, once-a-minute renewal), `SignedOutNotice.test.tsx`, and the additions to `LoginForm.test.tsx`, `StaffGate.test.tsx`, `ListYourFacility.test.tsx` (the newest token is always the one sent).
- [x] The token never goes into `localStorage`: the login test checks that the only key written there is `swifthealth.last-activity` and that it is a bare number.

## Not done by me: needs a real browser and a real login (yours)

I did not run the real-browser (Playwright) suite or a live login for this change. Please try, on the preview or locally:

- [ ] Log in as an **admin**, do nothing: after 4 minutes the dialog "Are you still there?" / "You'll be signed out in 60 seconds" appears with the focus on **Stay signed in**; press it; wait another 4 minutes; let it run out: you land on `/log-in` with "You were signed out because you were inactive."
- [ ] The same as an **editor** or **provider** with 15 minutes (14 for the dialog).
- [ ] Two tabs: keep clicking in tab A; tab B must not sign out. Leave both alone: both sign out.
- [ ] After "Stay signed in", the next page action still works (the token was renewed). Do something that calls the API (save a listing) right after: no 401.
- [ ] With a screen reader (or the browser's accessibility tree) the dialog is announced once when it opens; the countdown is not read every second; Tab stays on the button.
- [ ] Optional: set `IDLE_MINUTES_ADMIN=2` locally (`.env` is yours, I do not touch it) and check the warning comes after 1 minute.
- [ ] A computer that sleeps for 30 minutes with the tab open: on waking, the next click goes to the login.

## Known limits (see requirements.md, decisions I3, I5, I7)

- The server counts "idle" from the last renewal; the browser renews at most once a minute, so the server can allow up to a minute more than the browser's timer, never less than the limit from the last renewal.
- A half-typed form is lost at sign-out.
- Sessions made before the change keep their 12-hour token until the first renewal.
