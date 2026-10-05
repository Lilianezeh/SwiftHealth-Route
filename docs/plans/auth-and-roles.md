# Auth and roles: implementation plan

Requirements: FR-30 (email + password + one-time code), NFR-06 (two-factor staff login, hashed passwords,
role-based access, rate limiting). Spec: `specs/backend/api-spec.md` section 4.
Branch: `feature/auth-and-roles`. Reference FR-30 and NFR-06 in every commit and test.

## JWT library: switch python-jose to PyJWT

- The current FastAPI OAuth2 + JWT tutorial uses PyJWT (`uv add pyjwt`) and never mentions python-jose.
- The same tutorial recommends `pwdlib[argon2]` over passlib. Moving to pwdlib is a **separate later change**:
  the seed users are bcrypt-hashed, so it needs a re-seed. Keep passlib + bcrypt for now.
- `requirements.txt`: replace `python-jose[cryptography]>=3.3` with `pyjwt>=2.8` (HS256 needs no extra).
- Not checked: python-jose's repository health. Only the docs change was confirmed.

## Decisions

1. **Challenge token**: JWT with claims `sub` (user id), `purpose: "login_challenge"`, `code_hash`, `exp` (5 min).
   `code_hash` is HMAC-SHA256 keyed with `jwt_secret`, not a plain hash: the client holds the token, and a plain
   hash of a 6-digit code can be brute-forced offline in milliseconds. Code from `secrets.randbelow(10**6)`,
   zero-padded to 6 digits, compared with `hmac.compare_digest`.
2. **Token purpose**: access tokens carry `purpose: "access"`. Each decoder checks `purpose`, so a challenge
   token is rejected as an access token and the other way round.
3. **The JWT only identifies the user.** The access token holds `sub`, `purpose`, `exp`. It has no role.
   `get_current_user` loads the user from the database on every request and uses `role` and `is_active` from
   that row. A role change or deactivation takes effect on the next request. CLAUDE.md is updated to match.
4. **Login order**: unknown email or wrong password -> 401, same message. Only after the password is right:
   inactive -> 403, no phone -> 400. An unknown email still runs a dummy password check so response time does
   not reveal which emails exist.
5. **Layers**: `auth_service` raises domain errors (`InvalidCredentialsError`, `InactiveAccountError`,
   `MissingPhoneError`, `InvalidCodeError`, `InvalidTokenError`). Routes and dependencies translate them to
   `HTTPException`. `get_current_user` calls `auth_service.get_user_for_token`, never the repository.
6. **Rate limit**: in-memory, per IP, 10 calls per 15 minutes, in `core/rate_limit.py`. Applies to
   `/auth/login` **and** `/auth/verify-code` (separate counters per endpoint). Every call counts, not only
   failures. Client IP from `X-Forwarded-For` (Render sets it), else the socket address. Limits: resets on
   restart, per process, fine for one Render instance.
7. **Ownership**: `services/access_service.py` `ensure_can_edit_listing(user, listing)` raises
   `NotAllowedError`. editor/admin: any listing. verifier: only if `created_by == user.id` and
   `status == draft`. provider: only if `owner_id == user.id`.
8. **`require_role(*roles)`**: 403 on role mismatch, 401 on missing or invalid token. Admin always passes staff checks.
9. **Inactive user**: login 403, `/auth/me` and every protected endpoint 403, verify-code 403.
10. **Test database**: a separate PostgreSQL database `swifthealth_test`, never SQLite, so enums, NUMERIC and
    timezones match production. URL from `TEST_DATABASE_URL`, default
    `postgresql+psycopg://swifthealth:swifthealth@localhost:5432/swifthealth_test`. `tests/conftest.py` creates
    the database if missing, runs `SQLModel.metadata.create_all`, and truncates tables between tests. The
    `get_session` dependency is overridden to use it. CI gets a `postgres:16` service.

## Files

| File | Change |
| --- | --- |
| `specs/backend/api-spec.md` section 4 | Spec first: verify-code rate limit, no-phone 400, inactive 403 on `/me`, role read from DB |
| `CLAUDE.md` | Replace "checks the role from the JWT" with "loads the user from the database" |
| `backend/requirements.txt` | `python-jose` -> `pyjwt` |
| `backend/app/core/security.py` | `verify_password`, `create_access_token(user_id)`, `decode_access_token`, `create_challenge_token(user_id, code, expires_delta)`, `decode_challenge_token`, `generate_login_code`, `hash_login_code(user_id, code)` |
| `backend/app/core/rate_limit.py` | `RateLimiter(max_calls, window)`; `login_rate_limit`, `verify_code_rate_limit` dependencies (429) |
| `backend/app/integrations/termii.py` | `send_sms(phone, message)`; no key -> log the code. Exact endpoint and fields from the official Termii docs, not guessed |
| `backend/app/schemas/auth.py` | `LoginRequest`, `LoginResponse`, `VerifyCodeRequest`, `TokenResponse`, `UserRead` |
| `backend/app/repositories/user_repository.py` | add `get_by_id`, `set_last_login` |
| `backend/app/services/auth_service.py` | `start_login`, `verify_login_code`, `get_user_for_token` + domain errors |
| `backend/app/services/access_service.py` | `ensure_can_edit_listing`, `NotAllowedError` |
| `backend/app/api/routes/auth.py` | thin: login, verify-code, me |
| `backend/app/api/dependencies.py` | `get_current_user`, `require_role`, `require_listing_access` |
| `backend/tests/conftest.py` | PostgreSQL test DB, TestClient, demo users, limiter reset |
| `.github/workflows/ci.yml` | `postgres:16` service on the backend job, `TEST_DATABASE_URL` env |

## Tasks (tests first; one commit each)

### Task 0: Spec, CLAUDE.md, dependency
- [ ] Edit spec section 4 and CLAUDE.md line 52.
- [ ] Swap `pyjwt` into `requirements.txt`.
- [ ] Commit: `docs(specs): auth rate limit, no-phone 400, role read from DB (FR-30, NFR-06)`.

### Task 1: `core/security.py`
- [ ] Tests in `tests/unit/test_security.py`: `test_verify_password_accepts_right_and_rejects_wrong`,
  `test_access_token_round_trip`, `test_expired_access_token_rejected`,
  `test_access_token_has_no_role_claim`, `test_challenge_token_does_not_contain_plain_code`,
  `test_challenge_token_rejected_as_access_token`, `test_access_token_rejected_as_challenge`,
  `test_login_code_is_six_digits_with_leading_zeros_kept`.
- [ ] Implement, run, commit.

### Task 2: rate limiter
- [ ] Tests in `tests/unit/test_rate_limit.py`: `test_allows_10_then_blocks_11th`,
  `test_window_expires_after_15_minutes` (injectable clock), `test_ips_counted_separately`,
  `test_endpoints_counted_separately`.
- [ ] Implement, run, commit.

### Task 3: Termii integration
- [ ] Read the official Termii docs for the send endpoint, sandbox and fields.
- [ ] Tests in `tests/unit/test_termii.py`: `test_without_key_logs_code_and_makes_no_http_call`,
  `test_with_key_posts_to_termii` (mocked httpx).
- [ ] Implement, run, commit.

### Task 4: PostgreSQL test DB, `auth_service`, schemas, repository, routes
- [ ] `tests/conftest.py` + CI postgres service. Verify the existing tests still pass on it.
- [ ] Tests in `tests/integration/test_auth.py`: `test_login_wrong_password_401`,
  `test_login_unknown_email_401_same_message`, `test_login_inactive_user_403`,
  `test_login_no_phone_400`, `test_login_returns_masked_phone_and_sends_code`,
  `test_verify_wrong_code_401`, `test_verify_expired_challenge_401`, `test_verify_inactive_user_403`,
  `test_verify_sets_last_login_at`, `test_access_token_works_on_me`, `test_me_without_token_401`,
  `test_me_deactivated_user_403`, `test_me_uses_role_from_database`,
  `test_login_11th_attempt_429`, `test_verify_code_11th_attempt_429`.
- [ ] Implement, run, commit.

### Task 5: dependencies and access rules
- [ ] `tests/unit/test_access_service.py`: full role x ownership matrix, incl. verifier on another verifier's
  draft, verifier on own non-draft, provider on someone else's listing.
- [ ] `tests/integration/test_access_control.py`: `require_role` 403 for wrong role, 401 for no token,
  using a throwaway test-only route.
- [ ] Implement, run, commit.

### Task 6: wrap-up
- [ ] `pytest -q` and `ruff check .`, report real output.
- [ ] Smoke test with a demo user: login, read code from console, verify, `/auth/me`.

## Review focus (extra tests)
- Code "004821" keeps leading zeros; a non-6-digit code gives 401 or 422, never 500.
- A tampered challenge token (changed `sub`) gives 401.
- A token for a deleted user gives 401.
- Logging the code when no Termii key is set: add a startup warning so it is not left on in production.
