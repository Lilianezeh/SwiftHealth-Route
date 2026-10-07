# Auth and roles: validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-30 or NFR-06. Tick a box only after the test exists and passes.

## How to run

- Backend tests: `docker compose exec backend pytest -q`
- Backend lint: `docker compose exec backend ruff check .`

## Tests per task

### Task 1: `tests/unit/test_security.py` (15 of 15 passing)
- [x] `test_verify_password_accepts_right_and_rejects_wrong`
- [x] `test_access_token_round_trip`
- [x] `test_decoded_user_id_is_an_int`
- [x] `test_sub_claim_is_stored_as_a_string`
- [x] `test_expired_access_token_rejected`
- [x] `test_access_token_has_no_role_claim`
- [x] `test_challenge_token_does_not_contain_plain_code`
- [x] `test_challenge_token_carries_a_hash_that_matches_only_the_right_code`
- [x] `test_code_hash_depends_on_the_server_secret`
- [x] `test_expired_challenge_token_rejected`
- [x] `test_challenge_token_rejected_as_access_token`
- [x] `test_access_token_rejected_as_challenge`
- [x] `test_tampered_or_garbage_token_rejected`
- [x] `test_login_code_is_six_digits_with_leading_zeros_kept`
- [x] `test_generated_codes_are_always_six_digits`

### Task 2: `tests/unit/test_rate_limit.py`
- [ ] `test_allows_10_then_blocks_11th`
- [ ] `test_window_expires_after_15_minutes` (injectable clock)
- [ ] `test_ips_counted_separately`
- [ ] `test_endpoints_counted_separately`

### Task 2b: no new feature tests, behaviour unchanged
- [ ] Every test that passed before Task 2b still passes, with the same count, and the output has no
  `RuntimeWarning: coroutine ... was never awaited` and no `Event loop is closed` warning.
- [ ] `python -m seed.seed` runs and seeds the same rows as before.
- [ ] `grep -rn "from sqlmodel import.*Session" backend/app backend/seed` finds nothing: no sync `Session` is left.
- [ ] No `def` repository function remains in `backend/app/repositories/` (each one is `async def`).
- [ ] `alembic upgrade head` still works.
- [ ] `test_health.py` uses `AsyncClient`, so `grep -rn "TestClient" backend` finds nothing.

### Task 3: `tests/unit/test_termii.py`
- [ ] `test_without_key_logs_code_and_makes_no_http_call`
- [ ] `test_with_key_posts_to_termii` (mocked httpx)

### Task 4a: no new tests
- [ ] `grep -rn "TestClient" backend` finds nothing, and `httpx2` is not in `requirements.txt`.
- [ ] The backend test run shows no warning about `httpx` and `starlette.testclient`.
- [ ] A change under `backend/` runs only `backend.yml`; a change under `frontend/` runs only `frontend.yml`.

### Task 4b: no new tests
- [ ] The existing tests all pass on the async PostgreSQL test database, with no `Event loop is closed` warning.
- [ ] A row written in one test is gone in the next (the async truncate works).
- [ ] The `get_session` override gives routes an `AsyncSession` on `swifthealth_test`, never on the development database.

### Task 4c: `tests/integration/test_auth.py`
- [ ] `test_login_wrong_password_401`
- [ ] `test_login_unknown_email_401_same_message`
- [ ] `test_login_inactive_user_403`
- [ ] `test_login_no_phone_400`
- [ ] `test_login_returns_masked_phone_and_sends_code`
- [ ] `test_verify_wrong_code_401`
- [ ] `test_verify_expired_challenge_401`
- [ ] `test_verify_inactive_user_403`
- [ ] `test_verify_sets_last_login_at`
- [ ] `test_access_token_works_on_me`
- [ ] `test_me_without_token_401`
- [ ] `test_me_deactivated_user_403`
- [ ] `test_me_uses_role_from_database`
- [ ] `test_login_11th_attempt_429`
- [ ] `test_verify_code_11th_attempt_429`

### Task 5: access rules
- [ ] `tests/unit/test_access_service.py`: the full role by ownership matrix, including a verifier on another
  verifier's draft, a verifier on their own non-draft, and a provider on someone else's listing.
- [ ] `tests/integration/test_access_control.py`: `require_role` gives 403 for the wrong role and 401 for no token,
  using a throwaway test-only route.

## Review-focus edge cases

- [ ] Code "004821" keeps its leading zeros. A code that is not 6 digits gives 401 or 422, never 500.
- [ ] A tampered challenge token (changed `sub`) gives 401.
- [ ] A token for a deleted user gives 401.
- [ ] With no Termii key set, the login code is logged, and a startup warning says so, so it is not left on in production.

## Security checklist

- [ ] No secrets, keys or login codes in the code or in committed files. The only exception is the dev-mode console
  log of the code when no Termii key is set.
- [ ] `.env` is not committed.
- [ ] Wrong email and wrong password give the same 401 message.
- [ ] Passwords and login codes never appear in logs or error messages.

## Smoke test

- [ ] With a demo user: log in, read the code from the console, verify the code, call `/auth/me`.

## Merge checklist

Added when this folder was created; not part of the original plan.

- [ ] `pytest -q` and `ruff check .` are clean.
- [ ] `backend.yml` and `frontend.yml` are green on the pull request.
- [ ] The spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The pull request stays a draft until every box above is ticked.
