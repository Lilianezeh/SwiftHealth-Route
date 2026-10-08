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
| `backend/tests/conftest.py` | Async PostgreSQL test database (Task 2b), then `get_session` override, `AsyncClient`, demo users, limiter reset (Task 4b); default `TEST_DATABASE_URL` uses host `db` |
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
- [x] Implement `core/rate_limit.py` (sync `RateLimiter`; `async def` dependencies without `await`, the documented exception in decision 11), run, commit.
- [x] Follow-up fixes: client IP counted from the end of `X-Forwarded-For` (`TRUSTED_PROXY_COUNT`), and the 429
  dependencies moved to `api/dependencies.py`.

### Task 2b: convert database, repositories, seed and tests to async (done, `76ac692`)
Decision 11 in [requirements.md](requirements.md). Done before Task 3 so the Termii client and everything after it
starts async. No behaviour change: the existing tests must give the same results.
- [x] Check the official documentation: `postgresql+psycopg` with `create_async_engine`, and the `anyio_backend`
  fixture. If psycopg does not work async, stop and ask before adding a driver (stack change). Result: psycopg works
  async (`engine.dialect.is_async` is `True`, `select 1` ran through `AsyncSession.exec`); AnyIO's documented
  `anyio_backend` fixture returns `"asyncio"`. `alembic/env.py` uses its own sync engine on the same URL, so it
  needs no change.
- [x] `test_seed_data.py` ran the seed on in-memory SQLite, against decision 10. An async seed needs an async
  database, so the core of Task 4b's `conftest.py` moves here: `TEST_DATABASE_URL`, create the database if missing,
  `run_sync(create_all)`, async truncate between tests, an `AsyncSession` fixture, the `anyio_backend` fixture and
  `await engine.dispose()`. No new dependency (no `aiosqlite`). `test_models.py` also used SQLite; it now checks
  the nine tables in PostgreSQL.
- [x] Convert `core/database.py` to an async engine and an `AsyncSession` dependency (`get_session`).
- [x] Convert the four repositories (`audit`, `category`, `listing`, `user`) to `async def`. Check each query for
  lazy loading (none of the queries loads a relationship).
- [x] Convert `seed/seed.py` to run with `asyncio.run`, and call `hash_password` through `run_in_threadpool`.
- [x] Convert the seed tests in `test_seed_data.py` to the PostgreSQL fixture and `test_health.py` (it uses
  `TestClient`; it moves to `httpx.AsyncClient` with `ASGITransport`), and add the anyio marker.
- [x] Update the "Files" table above for `core/database.py` and the repositories. Run `pytest -q`,
  `ruff check .` and the seed, commit. (The Files table has no row for `core/database.py` or the repositories, and
  they already existed, so nothing to change there.)

### Task 3: Termii integration (done, `4fca59f`)
- [x] Read the official Termii docs for the send endpoint, sandbox and fields. Result: `POST {base_url}/api/sms/send`
  with `api_key`, `to` (digits, no `+`), `from`, `sms`, `type`, `channel`; success is `200` with `code: "ok"`;
  there is no sandbox or test mode; the `dnd` channel needs the DND route activated on the account; the base URL
  is per account (dashboard). Error bodies are not documented.
- [x] Spec first: wording "Termii: no sandbox ..." in CLAUDE.md, tech-stack, requirements and api-spec; settings
  `termii_base_url` (no default) and `termii_channel` (default `dnd`) in `config.py`; `.env.example` (empty
  `TERMII_API_KEY`, `TERMII_BASE_URL`, `TERMII_CHANNEL`); LOG.md reminder.
- [x] Write the tests in `tests/unit/test_termii.py` (listed in [validation.md](validation.md)).
- [x] Implement `integrations/termii.py` (`send_sms`, `to_termii_number`, `mask_phone`, `SmsSendError`), run, commit.
  With a key set it logs only the masked phone and the `message_id`; never the code, the key or the full phone.

### Task 4a: the CI split (done, `9b15518`; dependency fix `6bd2a80`)
- [x] Check that no code uses Starlette's `TestClient` any more (Task 2b moves the tests to `AsyncClient`):
  `grep -rn "TestClient" backend`. If none is left, do not add `httpx2`: keep `httpx` (`AsyncClient` and the Termii
  client use it). If some test still needs `TestClient`, stop and ask. Result: none left, so no `httpx2`.
- [x] Split `.github/workflows/ci.yml` into `backend.yml` and `frontend.yml`. Each runs on pull requests and on pushes
  to `main` only (so a pushed branch with an open pull request is not tested twice; a branch without a pull request
  is not tested at all), with a `paths:` filter for its own folder (`backend/**` or `frontend/**`) and its own
  workflow file. Keep the steps of the matching job from `ci.yml`.
- [x] In `backend.yml`, add a `postgres:16` service and set `TEST_DATABASE_URL` explicitly to the `localhost` URL
  (the runner reaches the service on `localhost`; `db` only exists inside Docker Compose). The old `ci.yml` had no
  database, so its backend job had failed since Task 2b.
- [x] Delete `ci.yml`. Branch protection: the owner confirmed there are no required checks. (If one is added later:
  a required check from a path-filtered workflow that is skipped stays pending and blocks the merge, and the check
  names are `Backend CI / backend` and `Frontend CI / frontend`.)
- [x] Run the backend tests (no warning about `httpx` and `starlette.testclient`) and `ruff check .`, commit.
- [x] Push and read the runs on GitHub (see [validation.md](validation.md)). Task 4a is done when `Backend CI` is
  green on PostgreSQL. The first push (`9b15518`) failed: a fresh install got SQLAlchemy 2.1, which no longer
  installs `greenlet`, so the async import failed. It would also have failed on Render. Fixed with
  `sqlalchemy[asyncio]` in `requirements.txt` (`6bd2a80`), confirmed in a clean `python:3.12-slim` container, and
  `Backend CI` is green on that push.

### Task 4b: the rest of the async test setup
Task 2b already created `tests/conftest.py` with the async PostgreSQL database (`TEST_DATABASE_URL`, create if
missing, `run_sync(create_all)`, async truncate, `AsyncSession` fixture, `anyio_backend`, `engine.dispose()`).
- [ ] Add to `tests/conftest.py` (decision 11 in [requirements.md](requirements.md)):
  - override `get_session` with an async generator that yields an `AsyncSession` on the test engine;
  - an `AsyncClient` fixture built with `ASGITransport(app=app)` and `base_url="http://test"`; it does not run
    lifespan events, so the fixture does not rely on them;
  - reset the rate limiters between tests, and create the demo users.
- [ ] Run the existing tests with the new fixtures. All must still pass.
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
