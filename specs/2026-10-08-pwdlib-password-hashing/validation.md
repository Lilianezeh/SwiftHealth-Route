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

### Task 1: `tests/unit/test_security.py` and `tests/unit/test_seed_data.py` (212 of 212 passing; 7 new)
- [x] `test_verify_password_accepts_right_and_rejects_wrong` (already exists; must still pass unchanged)
- [x] `test_hash_password_uses_argon2` (the hash starts with `$argon2`)
- [x] `test_same_password_gives_different_hashes` (a random salt per hash)
- [x] `test_verify_password_rejects_a_bcrypt_hash` (an old `$2b$` hash gives `False` or the same domain result as a
  wrong password, never an unhandled exception; the exact behaviour is fixed in Task 0)
- [x] `test_verify_password_rejects_garbage_hash`
- [x] `test_hash_password_does_not_store_plain_text` (in `test_seed_data.py`, now checks `$argon2`)
- [x] `test_login_with_unknown_hash_format_gives_401` (in `tests/integration/test_auth.py`; same message as a wrong
  password)
- [x] `test_dummy_hash_uses_the_same_algorithm_as_real_hashes` (the `_DUMMY_PASSWORD_HASH` in `auth_service` starts
  with `$argon2`)
- [x] All earlier tests still pass (205 before this feature; 212 now), and `pytest -q -W error` shows no passlib `crypt`
  `DeprecationWarning`.

## Review-focus edge cases

- [x] A user whose stored hash is not readable gets 401, never 500 (decision 6).
- [x] Unknown email and wrong password still take about the same time: both run one Argon2 check (decision 5).
- [x] Hashing still runs through `run_in_threadpool` in `auth_service` and `seed.py`, never directly on the event loop.
- [x] `hash_password` and `verify_password` keep their names and signatures; no caller changed except comments.
- [x] No plain password or hash appears in a log line or error message.

## Security checklist

- [x] `pwdlib[argon2]` is pinned to an exact version in `requirements.txt` (`==`, not `>=`).
- [x] In a clean container (rebuilt image, `docker compose exec backend pip list`) `passlib` and `bcrypt` are not
  installed.
- [x] `git grep -n -i "passlib\|bcrypt" -- backend` finds no import and nothing in `requirements.txt`. The only hits are
  one comment in `security.py` and the unreadable-hash tests, which name bcrypt on purpose.
- [x] No secrets in the commits; no `.env` change.

## Smoke test

- [x] Re-seed as in "How to run". In the database, every `users.password_hash` starts with `$argon2`.
- [x] With a re-seeded demo user: log in, read the code from the console, verify the code, call `/auth/me`.
- [x] A wrong password still gives 401 with the same message as an unknown email.
- [x] The test and application logs show no `crypt` deprecation warning and no bcrypt version error.

## Merge checklist

- [x] `pytest -q` and `ruff check .` are clean, with no warnings.
- [ ] `backend.yml` is green on the pull request. Not checked yet: the last push was before Task 1.
- [x] The spec, the [roadmap](../roadmap.md), `LOG.md` and [tech-stack.md](../tech-stack.md) are up to date.
- [ ] The pull request stays a draft until every box above is ticked.
