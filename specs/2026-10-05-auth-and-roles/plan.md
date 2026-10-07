# Auth and roles: plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests
and checks that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, FR-30 and NFR-06 in every commit and test. Tick a box only when the
step is really done.

## Files

| File | Change |
| --- | --- |
| `specs/backend/api-spec.md` section 4 | Spec first: verify-code rate limit, no-phone 400, inactive 403 on `/me`, role read from DB (done in Task 0) |
| `CLAUDE.md` | "loads the user from the database" instead of "role from the JWT" (done in Task 0) |
| `backend/requirements.txt` | `python-jose` to `pyjwt` (done in Task 0); `httpx` stays (no `httpx2`, see Task 4a) |
| `backend/app/core/security.py` | `verify_password`, `create_access_token(user_id)`, `decode_access_token`, `create_challenge_token(user_id, code, expires_delta)`, `decode_challenge_token`, `generate_login_code`, `hash_login_code(user_id, code)` |
| `backend/app/core/rate_limit.py` | `RateLimiter(max_calls, window)`, `get_client_ip(request, trusted_proxy_count)`, one limiter per endpoint |
| `backend/app/api/dependencies.py` | also `login_rate_limit`, `verify_code_rate_limit` (429, so `HTTPException` stays in the HTTP layer) |
| `backend/app/integrations/termii.py` | `send_sms(phone, message)`; no key logs the code. Exact endpoint and fields from the official Termii docs, not guessed |
| `backend/app/schemas/auth.py` | `LoginRequest`, `LoginResponse`, `VerifyCodeRequest`, `TokenResponse`, `UserRead` |
| `backend/app/repositories/user_repository.py` | add `get_by_id`, `set_last_login` |
| `backend/app/services/auth_service.py` | `start_login`, `verify_login_code`, `get_user_for_token` and the domain errors |
| `backend/app/services/access_service.py` | `ensure_can_edit_listing`, `NotAllowedError` |
| `backend/app/api/routes/auth.py` | thin: login, verify-code, me |
| `backend/app/api/dependencies.py` | `get_current_user`, `require_role`, `require_listing_access` |
| `.env.example` | add `TEST_DATABASE_URL` with host `db` (done when this folder was created) |
| `backend/tests/conftest.py` | Async PostgreSQL test database, `AsyncClient`, demo users, limiter reset; default `TEST_DATABASE_URL` uses host `db` |
| `.github/workflows/backend.yml`, `frontend.yml` | replace `ci.yml`; each runs only for its own folder and workflow file; `backend.yml` has the `postgres:16` service and `TEST_DATABASE_URL` |

## Tasks

### Task 0: Spec, CLAUDE.md, dependency (done, `832e6a2`)
- [x] Edit spec section 4 and CLAUDE.md.
- [x] Swap `pyjwt` into `requirements.txt`.
- [x] Commit: `docs(specs): auth rate limit, no-phone 400, role read from DB (FR-30, NFR-06)`.

### Task 1: `core/security.py` (done, `cc9fae3`)
- [x] Write the tests in `tests/unit/test_security.py` (15 tests, listed in [validation.md](validation.md)).
- [x] Implement, run, commit: `feat(auth): password check and JWT helpers (FR-30, NFR-06)`.

### Task 2: Rate limiter (done, `5355fea`)
- [x] Write the tests in `tests/unit/test_rate_limit.py`.
- [x] Implement `core/rate_limit.py` (sync `RateLimiter`; `async def` dependencies, see decision 11), run, commit.
- [x] Follow-up fixes: client IP counted from the end of `X-Forwarded-For` (`TRUSTED_PROXY_COUNT`), and the 429
  dependencies moved to `api/dependencies.py`.

### Task 2b: convert database, repositories, seed and tests to async
Decision 11 in [requirements.md](requirements.md). Done before Task 3 so the Termii client and everything after it
starts async. No behaviour change: the existing tests must give the same results.
- [ ] Check the official documentation: `postgresql+psycopg` with `create_async_engine`, and the `anyio_backend`
  fixture. If psycopg does not work async, stop and ask before adding a driver (stack change).
- [ ] Convert `core/database.py` to an async engine and an `AsyncSession` dependency (`get_session`).
- [ ] Convert the four repositories (`audit`, `category`, `listing`, `user`) to `async def`. Check each query for
  lazy loading.
- [ ] Convert `seed/seed.py` to run with `asyncio.run`. Check that `alembic/env.py` is unaffected (migrations may
  stay sync; if they do, say so in the commit).
- [ ] Convert the existing tests that use the database (`test_seed_data.py`) and `test_health.py` (it uses
  `TestClient`; it moves to `httpx.AsyncClient` with `ASGITransport`), and add the anyio marker.
- [ ] Update the "Files" table above for `core/database.py` and the repositories. Run `pytest -q`,
  `ruff check .` and the seed, commit.

### Task 3: Termii integration
- [ ] Read the official Termii docs for the send endpoint, sandbox and fields.
- [ ] Write the tests in `tests/unit/test_termii.py`.
- [ ] Implement `integrations/termii.py`, run, commit.

### Task 4a: the CI split
- [ ] Check that no code uses Starlette's `TestClient` any more (Task 2b moves the tests to `AsyncClient`):
  `grep -rn "TestClient" backend`. If none is left, do not add `httpx2`: keep `httpx` (`AsyncClient` and the Termii
  client use it). If some test still needs `TestClient`, stop and ask.
- [ ] Split `.github/workflows/ci.yml` into `backend.yml` and `frontend.yml`. Each runs on push and pull request, with
  a `paths:` filter for its own folder (`backend/**` or `frontend/**`) and its own workflow file. Keep the steps of the
  matching job from `ci.yml`.
- [ ] In `backend.yml`, add a `postgres:16` service and set `TEST_DATABASE_URL` explicitly to the `localhost` URL
  (the runner reaches the service on `localhost`; `db` only exists inside Docker Compose).
- [ ] Delete `ci.yml`. Check branch protection: a required check from a path-filtered workflow that is skipped stays
  pending.
- [ ] Run the backend tests (no warning about `httpx` and `starlette.testclient`), commit.

### Task 4b: PostgreSQL test database (async)
- [ ] Write `tests/conftest.py` with async fixtures (decision 11 in [requirements.md](requirements.md)):
  - read `TEST_DATABASE_URL`, default `postgresql+psycopg://swifthealth:swifthealth@db:5432/swifthealth_test` (host
    `db`, because the tests run inside the backend container); create the database if missing;
  - create the tables with `await connection.run_sync(SQLModel.metadata.create_all)`;
  - truncate all tables between tests with an async statement;
  - override `get_session` with an async generator that yields an `AsyncSession` on the test engine;
  - an `AsyncClient` fixture built with `ASGITransport(app=app)` and `base_url="http://test"`; it does not run
    lifespan events, so the fixture does not rely on them;
  - dispose the test engine at the end (`await engine.dispose()`), reset the rate limiters, create the demo users.
- [ ] Run the existing tests on it. All must still pass.
- [ ] Commit.

### Task 4c: Schemas, repository, `auth_service`, routes
- [ ] Write the tests in `tests/integration/test_auth.py`.
- [ ] Implement `schemas/auth.py`, `user_repository.py` additions, `auth_service.py`, `routes/auth.py`. Run, commit.

### Task 5: Dependencies and access rules
- [ ] Write the tests in `tests/unit/test_access_service.py` and `tests/integration/test_access_control.py`.
- [ ] Implement `access_service.py`, `get_current_user`, `require_role`, `require_listing_access`. Run, commit.

### Task 6: Wrap-up
- [ ] Run `pytest -q` and `ruff check .`, report the real output.
- [ ] Run the smoke test from [validation.md](validation.md).
- [ ] Go through the security checklist and the merge checklist in [validation.md](validation.md).
