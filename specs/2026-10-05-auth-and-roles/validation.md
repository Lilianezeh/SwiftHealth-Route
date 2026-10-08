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

### Task 2: `tests/unit/test_rate_limit.py` and `tests/unit/test_dependencies.py` (13 of 13 passing)
- [x] `test_allows_10_then_blocks_11th`
- [x] `test_window_expires_after_15_minutes` (injectable clock)
- [x] `test_ips_counted_separately`
- [x] `test_endpoints_counted_separately`
- [x] `test_reset_clears_all_counts`
- [x] `test_client_ip_is_the_last_entry_added_by_our_proxy`
- [x] `test_client_ip_skips_one_entry_per_extra_trusted_proxy`
- [x] `test_fake_header_cannot_change_the_client_ip`
- [x] `test_client_ip_falls_back_to_socket_address_without_header`
- [x] `test_client_ip_falls_back_to_socket_address_when_header_is_too_short`
- [x] `test_client_ip_is_unknown_without_header_or_socket`
- [x] `test_dependency_raises_429_when_limit_reached` (in `test_dependencies.py`)
- [x] `test_dependency_counts_each_ip_separately` (in `test_dependencies.py`)
- [ ] On Render (roadmap phase 4): log one real `X-Forwarded-For` and confirm `TRUSTED_PROXY_COUNT`.

### Task 2b: behaviour unchanged (60 of 60 passing: the 56 from before plus 4 new test-setup tests)
- [x] Every test that passed before Task 2b still passes, and `pytest -W error::RuntimeWarning` shows no
  `RuntimeWarning: coroutine ... was never awaited` and no `Event loop is closed` warning.
- [x] `python -m seed.seed` runs. On the already seeded development database it reports 0 created; the seed tests
  create every row on an empty PostgreSQL database and check the counts. A first run on an empty development
  database was not repeated.
- [x] `grep -rn "from sqlmodel import.*Session" backend/app backend/seed` finds nothing: no sync `Session` is left.
- [x] No `def` repository function remains in `backend/app/repositories/` (each one is `async def`).
- [x] `alembic upgrade head` still works (it keeps its own sync engine).
- [x] `test_health.py` uses `AsyncClient`, so `grep -rn "TestClient" backend` finds nothing.
- [x] The seed and model tests run on the PostgreSQL test database: `grep -rn "sqlite" backend` finds nothing.
- [x] `test_a_row_written_in_the_previous_test_is_gone` fails when the truncate is removed (checked), and
  `test_the_test_database_is_never_the_development_database` guards the development database.
- [x] `seed.py` hashes passwords through `run_in_threadpool`, so it never blocks the event loop.
- Extra tests in `tests/unit/test_test_database.py` (3) and `test_models.py` (split into 2).

### Task 3: `tests/unit/test_termii.py` (29 of 29 passing)
The failure tests run once for each of 7 failures: 400, 401, 429, 500, `code` not `ok`, a reply that is not JSON,
and a network error. Each failing reply repeats the secrets in its body, to prove a body is never copied.
- [x] `test_without_key_logs_code_and_makes_no_http_call`
- [x] `test_with_key_posts_to_termii` (mocked httpx: URL, method and body fields, trailing slash on the base URL)
- [x] `test_phone_is_sent_without_the_plus_sign`
- [x] `test_mask_phone_keeps_prefix_and_last_four`
- [x] `test_the_default_channel_is_dnd`
- [x] `test_channel_comes_from_the_setting`
- [x] `test_key_without_base_url_raises_a_clear_error`
- [x] `test_a_failed_send_raises_sms_send_error` (7 cases)
- [x] `test_error_messages_contain_no_secrets` (7 cases: no API key, code or phone in the error)
- [x] `test_with_key_nothing_secret_is_logged_on_success`
- [x] `test_with_key_nothing_secret_is_logged_on_failure` (7 cases: no code, API key or full phone in the logs)
- [x] Checked by making the code leak on purpose (message in the success log, response text in the error): 7 tests
  failed, then the leaks were removed.

### Task 3b: `tests/unit/test_config.py` (14 of 14 passing)
- [x] `test_app_env_defaults_to_development`
- [x] `test_development_accepts_the_default_and_a_short_secret`
- [x] `test_production_refuses_a_missing_jwt_secret`
- [x] `test_production_refuses_an_empty_jwt_secret`
- [x] `test_production_refuses_the_default_jwt_secret`
- [x] `test_production_refuses_a_secret_under_32_bytes` (31 bytes fails, 32 bytes passes)
- [x] `test_the_length_is_counted_in_bytes` (16 two-byte characters pass, 15 fail)
- [x] `test_any_app_env_other_than_development_is_checked` (4 cases: `staging`, `prod`, `Development`, `production`)
- [x] `test_a_long_random_secret_is_accepted_in_production`
- [x] `test_the_error_never_contains_the_secret` (failed first: pydantic printed the input, so the settings now use
  `hide_input_in_errors=True`)
- [x] `test_app_env_is_read_from_the_environment`

### Task 4a: no new tests
- [x] `grep -rn "TestClient" backend` finds nothing, and `httpx2` is not in `requirements.txt`.
- [x] The backend test run shows no warning about `httpx` and `starlette.testclient`.
- [x] Both workflow files parse as valid YAML (checked with PyYAML), and `ci.yml` is gone.
- [x] The first push after the split (`9b15518`) ran both workflows. `Frontend CI` was green. `Backend CI` failed
  on the missing `greenlet` (a requirements bug, not the split). After `6bd2a80` it is green on the PostgreSQL
  service.
- [x] A later change under `backend/` (`6bd2a80`) only ran `Backend CI`.
- [x] A docs-only change runs neither workflow (the tick commit `013bb9a` started no run).
- [ ] A change under `frontend/` only runs `Frontend CI`. Open until the first real frontend change: no frontend
  file changes in this feature.

### Task 4b: fixture tests in `tests/unit/test_test_database.py` (11 of 11 passing; 111 in all)
- [x] The existing tests all pass with the new fixtures, with no `Event loop is closed` warning
  (`pytest -W error::RuntimeWarning`).
- [x] `test_routes_get_the_test_session_on_the_test_database`: the `get_session` override gives routes the test
  `AsyncSession`, and `select current_database()` returns `swifthealth_test`, never the development database.
- [x] `test_the_session_override_exists_while_the_client_is_in_use` and
  `test_the_session_override_is_removed_after_the_test` (checked by removing the cleanup: the second test failed).
- [x] `test_first_test_uses_up_the_login_limit` and `test_the_limiters_start_empty_in_the_next_test` (checked by
  removing the reset: the second test failed).
- [x] `test_the_client_reaches_the_app`
- [x] `test_demo_users_exist_one_per_role` and `test_demo_users_are_saved_in_the_database` (four active users with
  fictional `+2340...` phones and a password that verifies).

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
