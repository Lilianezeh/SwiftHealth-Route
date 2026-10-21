# First admin at start-up: requirements

How the first admin is made on the production server. How we build it is in [plan.md](plan.md); how we know it is done is in [validation.md](validation.md).
Branch: `feature/bootstrap-admin-at-startup`, from `main`. It follows the owner's decision of 2026-10-21: "Go with option b."

## Why

A new production database has no users, so nobody can log in or add staff (FR-41, FR-30). The command `python -m app.bootstrap_admin` makes the first admin, but the
production database allows no outside connections (`ipAllowList: []` in `render.yaml`), so it cannot be run from a laptop. The free Render service has no shell
that I could rely on. So the same command runs when the container starts, like the demo listings step, and only when asked.

## Requirements

[prd.md](../prd.md): **FR-41** (an admin manages staff accounts), **FR-30** (staff log in with a password and an SMS code), **NFR-06** (no secret in the code or the logs),
**NFR-07** (no personal data in the logs). Nothing else changes: no table, no migration, no package, no endpoint.

## What it does

- `backend/Dockerfile` runs `python -m app.bootstrap_admin --at-startup` after `alembic upgrade head` and the demo listings step, and before the API. A failure is
  shrugged off (`|| echo ...`), so the service always starts.
- It does **nothing** (and logs nothing) unless the four variables `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PHONE` and `BOOTSTRAP_ADMIN_PASSWORD` are all set. A blank value counts as not set.
- If only some are set, it creates nothing and logs which are missing, **by name**.
- If a user with that email already exists, it changes nothing and logs `admin already exists`. Starting again with the variables still set is therefore safe.
- Otherwise it creates one active admin (the password hashed with Argon2, an audit entry with the reference `bootstrap-admin`) and logs `first admin created`.
- A bad value (a password under 10 characters, a phone that is not Nigerian, an email that is not an email) creates nothing and logs `first admin not created: <the variable> ...`.
- Any other failure (the database is down) logs `first admin step failed (<ErrorClass>). The API will start without it.`
- **It never logs the password, the email, the phone or the text of a database error** (that text can hold an address). Tests read the log to check this.
- The manual command (`python -m app.bootstrap_admin`, with no argument) is unchanged: it still stops with a message when the email exists.

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| G1 | **Both conditions are "all four set".** A half-set list does nothing and says which names are missing (so a typo in a variable name is visible in the log). | Create with defaults for the missing ones (not safe) |
| G2 | **A bad value is logged as a sentence, not as one of the two fixed lines.** You asked that only "first admin created" or "admin already exists" be logged for the two normal outcomes; for a mistake you need to know what to fix, and the sentence names a variable, never a value. | Say nothing |
| G3 | **The variables are not in `render.yaml`.** A password must not be in a file in the repository. You add them by hand in the Render dashboard and delete them afterwards. | A `sync: false` entry in the Blueprint |
| G4 | **"Already exists" means the email, whatever its role.** Nothing is overwritten, not even a changed password. | Update the password |

## Owner steps (outside the code, I changed none of them)

See step 3 of [release-checklist.md](../2026-10-20-launch-readiness/release-checklist.md).
