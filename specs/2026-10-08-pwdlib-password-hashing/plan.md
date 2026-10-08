# Move password hashing to pwdlib: plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests
and checks that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, NFR-06 in every commit and test. Tick a box with its commit hash only
when the step is really done.

## Files

| File | Change |
| --- | --- |
| `specs/tech-stack.md` | Decision line "passlib with bcrypt now, pwdlib right after" becomes "pwdlib (Argon2)" |
| `specs/2026-10-08-pwdlib-password-hashing/requirements.md` | Fill in what Task 0 finds (Argon2 parameters, unknown-hash behaviour, exact versions) |
| `backend/requirements.txt` | Remove `passlib[bcrypt]` and `bcrypt`; add `pwdlib[argon2]` with an exact version |
| `backend/app/core/security.py` | `PasswordHash.recommended()` instead of `CryptContext`; same `hash_password` and `verify_password` |
| `backend/app/services/auth_service.py` | Comment only: the thread-pool note names Argon2, not bcrypt |
| `backend/seed/seed.py` | Comment only: same note |
| `backend/tests/conftest.py` | Docstring only: the hashing is slow on purpose, not "bcrypt" |
| `backend/tests/unit/test_security.py` | New tests for the Argon2 format, salt, and unreadable hash |
| `backend/tests/unit/test_seed_data.py` | `startswith("$2")` becomes `startswith("$argon2")` |
| `LOG.md` | Remove the "pwdlib change" reminder at the end of the feature |
| `specs/roadmap.md` | Phase 3 status (done at the end) |

## Tasks

### Task 0: Spec and library check
- [ ] Read the official pwdlib documentation: the Argon2 parameters `recommended()` uses, and what `verify()` does
  with a hash in another format (an old bcrypt hash and a garbage string). Write the answers in
  [requirements.md](requirements.md), "Library choice".
- [ ] Install `pwdlib[argon2]` in a throwaway way (not in `requirements.txt` yet) and confirm the real latest version
  and the `argon2-cffi` version pip resolves.
- [ ] Update the decision line in [tech-stack.md](../tech-stack.md).
- [ ] Commit: `docs(specs): pwdlib password hashing requirements and plan (NFR-06)`.

### Task 1: Swap the hashing library
- [ ] Write the tests first in `tests/unit/test_security.py` and `test_seed_data.py` (listed in
  [validation.md](validation.md)). They fail while bcrypt is still in use.
- [ ] Change `requirements.txt`: remove `passlib[bcrypt]` and `bcrypt`, add `pwdlib[argon2]==<exact version>`.
  Rebuild the backend image (`docker compose up --build`).
- [ ] Change `core/security.py` to `PasswordHash.recommended()`. Keep the two function names and signatures.
  Handle an unreadable hash as decided in Task 0 (decision 6).
- [ ] Update the comments in `auth_service.py`, `seed.py` and `conftest.py` that say bcrypt.
- [ ] Run `pytest -q` and `ruff check .`, then commit: `feat(auth): hash passwords with pwdlib and Argon2 (NFR-06)`.

### Task 2: Re-seed and wrap-up
- [ ] Reset the development database with the Alembic commands in decision 2, then run the seed. Check the stored
  hashes start with `$argon2`.
- [ ] Run the checks and the smoke test in [validation.md](validation.md), including a clean container
  (`pip list` shows no `passlib` or `bcrypt`).
- [ ] Update `LOG.md` (remove the pwdlib reminder, add today's entry), the [roadmap](../roadmap.md), and tick the
  boxes in this folder with their commit hashes.
- [ ] Commit: `docs(specs): pwdlib wrap-up (NFR-06)`.
