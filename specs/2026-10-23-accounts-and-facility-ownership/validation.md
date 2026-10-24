# Accounts, sign-up and facility ownership: validation

Requirements: [requirements.md](requirements.md). Plan: [plan.md](plan.md). One section per phase, filled in when the phase is built; a phase is not "done" until its checklist is ticked and the owner has merged its pull request.

## Phase 1: one password rule (merged, PR #46)

- 8 characters minimum for a provider, 10 for staff and admin, common passwords blocked for everyone, a provider made staff needs a new 10-character password. Backend 1486 tests, frontend 1566 of 1567 (a load flake that passed alone).

## Phase 2: account foundation (draft PR, 2026-10-24)

**What it adds (no visible change for anyone today):** six columns on `users` (`approval_status`, `email_verified_at`, `phone_verified_at`, `signup_note`, `password_changed_at`, `closed_at`); one check, `ensure_account_is_ready`, used by the login and by `get_current_user`; signed code tokens for the email, phone and reset codes; `send_email(required=True)` for an account code; `account_mail_service.send_email_code`. No endpoint, page or setting is new, no package is added, no variable is needed on Render.

- **Backend tests:** the new tests were written first and failed first (import errors, then the route list). Files: `tests/unit/test_code_tokens.py`, `tests/unit/test_account_mail.py`, `tests/integration/test_account_foundation_migration.py`, `tests/integration/test_account_state.py`, plus additions in `test_admin_users.py` and `test_bootstrap_admin.py`. `ruff check` clean.
- **Every route that needs a login refuses an account that is not ready.** The routes are read from the app's own OpenAPI document (24 operations today), and each one is called with an admin who is waiting for approval, rejected, email not confirmed, phone not confirmed, closed, or deactivated: all answer 403 with the right sentence. The same routes answer 401 with no token, and none refuses a ready admin with a login error. (A first version of this test read the route table and found **zero** routes, because FastAPI 0.142 keeps included routers in a wrapper; a check that the list is not empty caught it, so the test cannot pass by testing nothing.)
- **The migration** (`ea0fdca0cfca`, after `c3d71e9b5a20`): tested on the test database from "the database as it was" (the new columns removed, one user of each role, one deactivated): every user becomes approved with a confirmed email and phone, nothing else in the rows changes (compared column by column), a deactivated user stays deactivated, a user added by old code gets `approved` by the database default, the downgrade drops only the six columns and keeps all users, and up, down, up gives the same result. **Also run on the local development PostgreSQL** (4 demo users): `alembic upgrade head`, `downgrade -1` (4 users kept, columns gone), `upgrade head`, `alembic check` ("No new upgrade operations detected").
- **Login is unchanged for every account that exists:** the tests of `test_auth.py` pass without change.
- **Full backend run:** 1536 tests. The first full run had 1533 passed and 3 failed, for two reasons that the change itself explains: two tests built a second provider with `User(...)` by hand, which is now an unconfirmed account that cannot log in (they now set the two confirmation times, like an admin-made account), and one test said the groups revision is the last one (it now says the history is still one line with one head). The three pass now (110 tests in those four files); the rest was not run again.

**Render, when this deploys (for the owner):** the Dockerfile already runs `alembic upgrade head` when the service starts, so the migration runs by itself once. It adds the six columns and fills the two confirmation times for the users that exist (one `UPDATE` on a table of a handful of rows). **No environment variable, no package and no Render setting changes. Nothing to do before or after.** The production admin keeps logging in exactly as today. If a deploy has to be rolled back to the previous version of the code, the extra columns do no harm (the old code ignores them, and the database default keeps `approved`); the downgrade is not run by the deploy. The Render database that expires about 2026-11-07 (LOG.md, "To do later") is a separate matter.

## Checklist (Phase 2)
- [x] Additive migration only; existing users keep working; downgrade drops only the new columns
- [x] The one dependency refuses every account that is not ready; a test calls every login-protected route
- [x] Admin-made accounts, the seed and the first-admin command create approved, confirmed accounts
- [x] Code tokens with purposes; the email with no key: logged in development, refused elsewhere, and unchanged for staff alerts
- [ ] The owner merges the pull request
