# Move password hashing to pwdlib: validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves NFR-06 ("hashed passwords"). Tick a box only after the test exists and
passes.

## How to run

- Backend tests: `docker compose exec backend pytest -q`
- Warnings as errors: `docker compose exec backend pytest -q -W error`
- Backend lint: `docker compose exec backend ruff check .`
- Re-seed the development database (decision 2):
  `docker compose exec backend alembic downgrade base`, then `alembic upgrade head`, then
  `python -m seed.seed`.

## Tests per task

### Task 1: `tests/unit/test_security.py` and `tests/unit/test_seed_data.py`
- [ ] `test_verify_password_accepts_right_and_rejects_wrong` (already exists; must still pass unchanged)
- [ ] `test_hash_password_uses_argon2` (the hash starts with `$argon2`)
- [ ] `test_same_password_gives_different_hashes` (a random salt per hash)
- [ ] `test_verify_password_rejects_a_bcrypt_hash` (an old `$2b$` hash gives `False` or the same domain result as a
  wrong password, never an unhandled exception; the exact behaviour is fixed in Task 0)
- [ ] `test_verify_password_rejects_garbage_hash`
- [ ] `test_hash_password_does_not_store_plain_text` (in `test_seed_data.py`, now checks `$argon2`)
- [ ] `test_login_with_unknown_hash_format_gives_401` (in `tests/integration/test_auth.py`; same message as a wrong
  password)
- [ ] `test_dummy_hash_uses_the_same_algorithm_as_real_hashes` (the `_DUMMY_PASSWORD_HASH` in `auth_service` starts
  with `$argon2`)
- [ ] All earlier tests still pass (205 before this feature), and `pytest -q -W error` shows no passlib `crypt`
  `DeprecationWarning`.

## Review-focus edge cases

- [ ] A user whose stored hash is not readable gets 401, never 500 (decision 6).
- [ ] Unknown email and wrong password still take about the same time: both run one Argon2 check (decision 5).
- [ ] Hashing still runs through `run_in_threadpool` in `auth_service` and `seed.py`, never directly on the event loop.
- [ ] `hash_password` and `verify_password` keep their names and signatures; no caller changed except comments.
- [ ] No plain password or hash appears in a log line or error message.

## Security checklist

- [ ] `pwdlib[argon2]` is pinned to an exact version in `requirements.txt` (`==`, not `>=`).
- [ ] In a clean container (rebuilt image, `docker compose exec backend pip list`) `passlib` and `bcrypt` are not
  installed.
- [ ] `git grep -n -i "passlib\|bcrypt" -- backend` finds nothing in code or `requirements.txt` (comments and
  history in specs may still name them).
- [ ] No secrets in the commits; no `.env` change.

## Smoke test

- [ ] Re-seed as in "How to run". In the database, every `users.password_hash` starts with `$argon2`.
- [ ] With a re-seeded demo user: log in, read the code from the console, verify the code, call `/auth/me`.
- [ ] A wrong password still gives 401 with the same message as an unknown email.
- [ ] The test and application logs show no `crypt` deprecation warning and no bcrypt version error.

## Merge checklist

- [ ] `pytest -q` and `ruff check .` are clean, with no warnings.
- [ ] `backend.yml` is green on the pull request.
- [ ] The spec, the [roadmap](../roadmap.md), `LOG.md` and [tech-stack.md](../tech-stack.md) are up to date.
- [ ] The pull request stays a draft until every box above is ticked.
