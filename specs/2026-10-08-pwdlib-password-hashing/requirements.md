# Move password hashing to pwdlib: requirements

What this feature must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it is
done is in [validation.md](validation.md).

## Requirements

- **NFR-06:** HTTPS everywhere, staff two-factor login, hashed passwords, role-based access, rate limiting.

Source of truth: [prd.md](../prd.md). Branch: `feature/pwdlib-password-hashing`. Every commit and test references
NFR-06. This is roadmap [phase 3](../roadmap.md). The login flow itself (FR-30) does not change.

Fit with the project: the mission says passwords and personal data are handled with care
([mission.md](../mission.md)), and the stack decision "passlib with bcrypt now, pwdlib right after auth and roles"
is in [tech-stack.md](../tech-stack.md). This change carries out that decision. It adds no table and no endpoint.

## In scope

- Hash and check passwords with `pwdlib` (Argon2) instead of `passlib` with bcrypt, in `core/security.py`.
- Remove `passlib` and `bcrypt` from `requirements.txt`; add `pwdlib[argon2]` pinned to an exact version.
- Re-seed the demo users so their stored hashes are Argon2.
- Remove the passlib `crypt` deprecation warning from the test run.
- Update the comments, the tests and the spec lines that name bcrypt.

## Out of scope (planned elsewhere)

- Changing the login flow, the tokens or the rate limits: done in the auth feature
  ([requirements](../2026-10-05-auth-and-roles/requirements.md)).
- Password reset, password change and password strength rules: not in any roadmap phase yet. Managing staff
  accounts is [roadmap](../roadmap.md) phase 10e.
- Tuning the Argon2 cost for the Render instance: decided at the production deploy, roadmap phase 4.

## Library choice: pwdlib instead of passlib

- The current FastAPI OAuth2 and JWT tutorial uses `pwdlib[argon2]` and `PasswordHash.recommended()`; passlib is
  not maintained for current Python (it logs the `crypt` deprecation warning, and we had to pin `bcrypt==4.0.1`
  because passlib 1.7 breaks with newer bcrypt).
- The pwdlib documentation shows `PasswordHash.recommended()`, `hash()` and `verify()`. It lists `verify_and_update()`
  too, but we do not need it (decision 1).
- Checked in Task 0 by installing it in the backend container: pwdlib 0.3.1 (with `argon2-cffi` 25.1.0) is what
  pip resolves, and it matches the PyPI page. It needs Python 3.10 or newer.
- `PasswordHash.recommended()` makes Argon2id hashes with `Argon2Hasher` defaults: `time_cost=3`,
  `memory_cost=65536` (64 MiB), `parallelism=4`, 32-byte hash, 16-byte salt. A hash looks like
  `$argon2id$v=19$m=65536,t=3,p=4$...`.
- `verify()` does not return `False` for a hash it cannot identify. An old bcrypt hash, a garbage string and an
  empty string all raise `pwdlib.exceptions.UnknownHashError`. Decision 6 depends on this.

## Decisions

1. **Argon2 only, with a re-seed.** No bcrypt support is kept and no rehash-on-login. We only have demo data, so an
   old bcrypt hash simply stops working. The alternative (Argon2 plus bcrypt, upgraded at login with
   `verify_and_update()`) keeps the `bcrypt` dependency and adds code we would never use.
2. **The re-seed uses Alembic, no change to `seed.py`.** The seed skips users that already exist, so it cannot
   replace their hashes. The development database is reset with
   `docker compose exec backend alembic downgrade base`, then `alembic upgrade head`, then
   `python -m seed.seed`. Only demo data is lost. This is for the development database only, never for production.
3. **The public functions do not change.** `hash_password(plain_password)` and `verify_password(plain_password,
   password_hash)` keep their names and signatures, so `auth_service`, the seed and the tests call them as before.
   Only the body of `core/security.py` changes (layer rule: one place knows the hashing library).
4. **Still sync, still in a thread.** Hashing stays plain `def` CPU code in `core/security.py`. Async code still
   calls it through `run_in_threadpool` (CLAUDE.md, "Code style"). Argon2 is slow on purpose, so this matters even
   more than before.
5. **The unknown-email dummy hash uses the same hasher.** `auth_service` makes `_DUMMY_PASSWORD_HASH` with
   `hash_password`, so it has the same Argon2 settings as real hashes and the login time does not reveal which
   emails exist (auth decision 4).
6. **A hash we cannot read must give "wrong password", not a server error.** If a stored hash is in an unknown format,
   login returns the same 401 as a wrong password. pwdlib raises `UnknownHashError` for it (see "Library choice"),
   so `verify_password` catches that exception and returns `False`.
