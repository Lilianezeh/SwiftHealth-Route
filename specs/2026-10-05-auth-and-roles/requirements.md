# Auth and roles: requirements

What this feature must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it is
done is in [validation.md](validation.md).

## Requirements

- **FR-30:** staff and providers log in with email and password plus a one-time code (two-factor).
- **NFR-06:** HTTPS everywhere, staff two-factor login, hashed passwords, role-based access, rate limiting.

Source of truth: [prd.md](../prd.md). API contract: section 4 (Auth) of [api-spec.md](../backend/api-spec.md).
Branch: `feature/auth-and-roles`. Every commit and test references FR-30 and NFR-06.

## In scope

- Login in two steps: password, then a 6-digit code sent by SMS (Termii sandbox).
- A short-lived access token that only identifies the user.
- Role and ownership checks for staff and provider endpoints.
- Rate limits on `/auth/login` and `/auth/verify-code`.

## Out of scope (planned elsewhere)

- The login screen: [roadmap](../roadmap.md) phase 10a.
- Moving password hashing from passlib to pwdlib: roadmap phase 3. It needs a re-seed, because the seed users are
  bcrypt-hashed.
- Managing staff accounts and roles: roadmap phase 10e.

## Library choice: PyJWT instead of python-jose

- The current FastAPI OAuth2 and JWT tutorial uses PyJWT and never mentions python-jose.
- The same tutorial recommends `pwdlib[argon2]` over passlib. That move is a separate later change, so passlib
  and bcrypt stay for now.
- `requirements.txt` has `pyjwt>=2.8` (HS256 needs no extra).
- Not checked: python-jose's repository health. Only the documentation change was confirmed.

## Decisions

1. **Challenge token.** A JWT with claims `sub` (user id), `purpose: "login_challenge"`, `code_hash` and `exp`
   (5 minutes). `code_hash` is HMAC-SHA256 keyed with `jwt_secret`, not a plain hash: the client holds the token,
   and a plain hash of a 6-digit code can be brute-forced offline in milliseconds. The code comes from
   `secrets.randbelow(10**6)`, zero-padded to 6 digits, and is compared with `hmac.compare_digest`.
2. **Token purpose.** Access tokens carry `purpose: "access"`. Each decoder checks `purpose`, so a challenge token
   is rejected as an access token and the other way round.
3. **The JWT only identifies the user.** The access token holds `sub`, `purpose` and `exp`, and no role.
   `get_current_user` loads the user from the database on every request and uses `role` and `is_active` from that
   row. A role change or deactivation takes effect on the next request. CLAUDE.md says the same.
4. **Login order.** Unknown email or wrong password gives 401 with the same message. Only after the password is
   right: inactive gives 403, no phone gives 400. An unknown email still runs a dummy password check, so response
   time does not reveal which emails exist.
5. **Layers.** `auth_service` raises domain errors (`InvalidCredentialsError`, `InactiveAccountError`,
   `MissingPhoneError`, `InvalidCodeError`, `InvalidTokenError`). Routes and dependencies translate them to
   `HTTPException`. `get_current_user` calls `auth_service.get_user_for_token`, never the repository.
6. **Rate limit.** In memory, per IP, 10 calls per 15 minutes, in `core/rate_limit.py`. It applies to
   `/auth/login` and to `/auth/verify-code`, with a separate counter for each endpoint. Every call counts, not only
   failures. The client IP comes from `X-Forwarded-For` (Render sets it), else the socket address. Limits: it resets
   on restart and is per process, which is fine for one Render instance.
7. **Ownership.** `services/access_service.py` has `ensure_can_edit_listing(user, listing)`, which raises
   `NotAllowedError`. Editor and admin: any listing. Verifier: only if `created_by == user.id` and
   `status == draft`. Provider: only if `owner_id == user.id`.
8. **`require_role(*roles)`.** 403 on role mismatch, 401 on missing or invalid token. Admin always passes staff checks.
9. **Inactive user.** Login 403. `/auth/me` and every protected endpoint 403. `/auth/verify-code` 403.
10. **Test database.** A separate PostgreSQL database `swifthealth_test`, never SQLite, so enums, NUMERIC and time
    zones match production. The URL comes from `TEST_DATABASE_URL`, default
    `postgresql+psycopg://swifthealth:swifthealth@db:5432/swifthealth_test`. The host is `db` because the tests run
    inside the backend container; `.env.example` has the same default. In CI the database is a service on the
    runner, so `backend.yml` sets `TEST_DATABASE_URL` to `localhost` explicitly. `tests/conftest.py` creates the
    database if missing, runs `SQLModel.metadata.create_all`, and truncates tables between tests. The `get_session`
    dependency is overridden to use it. CI gets a `postgres:16` service.
