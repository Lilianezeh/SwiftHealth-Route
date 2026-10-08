# Walking skeleton in production: validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves NFR-05 or NFR-06. Tick a box only after the test exists and passes.

Checked on 2026-10-08. A box that needs a look in the Render or Netlify dashboard stays unticked until the owner has
done it, because the API cannot show those settings.

## How to run

- Backend tests: `docker compose exec backend pytest -q`
- Warnings as errors: `docker compose exec backend pytest -q -W error`
- Backend lint: `docker compose exec backend ruff check .`
- Frontend: `cd frontend && npm run lint && npm run typecheck && npm test && npm run build`
- Production checks: `curl -i https://swifthealth-api.onrender.com/health` and a browser on
  `https://swifthealth-ng.netlify.app`.

## Tests per task

### Task 1: `tests/unit/test_config.py` and `tests/integration/test_cors.py` (221 of 221 passing with `-W error`)
- [x] `test_database_url_with_plain_postgresql_prefix_gets_the_psycopg_driver` (NFR-06; decision 4)
- [x] `test_database_url_that_names_psycopg_is_left_alone`
- [x] `test_database_url_rewrite_keeps_user_password_host_and_database` (only the start of the address changes)
- [x] `test_database_url_that_names_another_driver_is_left_alone`
- [x] `test_database_url_is_rewritten_when_it_comes_from_the_environment`
- [x] `test_cors_origin_list_splits_a_comma_list_and_trims_spaces`
- [x] `test_cors_allows_the_configured_origin` (a preflight with that `Origin` gets `access-control-allow-origin` back)
- [x] `test_cors_does_not_allow_an_unknown_origin` (no `access-control-allow-origin` header for another origin)
- [x] `test_a_normal_request_from_an_unknown_origin_gets_no_cors_header`
- [x] Existing tests still pass, including the five production `JWT_SECRET` tests in `test_config.py`.

### Task 2: frontend
- [x] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass with no new warnings, before and after the
  security upgrade (Task 2b). No new unit test is needed: no frontend code changed, only `netlify.toml` and the
  package versions.

### Task 3b: `frontend/tests/unit/client.test.ts` (8 of 8 frontend tests passing; 5 new)
- [x] `getHealth returns the answer when the API is fast`
- [x] `getHealth returns null when the API answers with an error`
- [x] `getHealth returns null when the API is slow, instead of waiting for it` (fails first; a fetch that never answers
  gives `null` after the limit, here 50 ms)
- [x] `getHealth gives up after 8 seconds by default` (fails first; `AbortSignal.timeout` is called with `8000`)
- [x] `getHealth returns null when the network fails`

## Review-focus edge cases

- [x] The API refuses to start with `APP_ENV=production` and a missing, default or short `JWT_SECRET`. This is tested in
  `test_config.py`. The owner checked the Render service's Environment: `APP_ENV` is `production`, and `JWT_SECRET` and
  `CORS_ORIGINS` exist.
- [x] `CORS_ORIGINS` has the exact Netlify address with `https://` and no trailing slash (`render.yaml`, and the
  production preflight check in the smoke test).
- [x] The owner checked that `NEXT_PUBLIC_API_URL` in the Netlify environment variables starts with `https://`, never
  `http://`.
- [x] The first request after the API slept (about a minute) shows "not reachable" without crashing the home page, and
  the next request shows "connected". The first test on 2026-10-08 **failed**: after 16 idle minutes the first site visit
  took 31 s and returned Netlify's "Inactivity Timeout" error page, because `getHealth()` waited with no limit. After the
  fix (decision 11, `0eef0ea`) the repeat test passed: after 21+ idle minutes the first visit took 11.7 s and showed a
  normal page saying "not reachable" (the API itself needed 24.8 s to answer), and the next visit showed "connected".
  The slow wake-up is a known cost of the free plan (decision 3).
- [x] The Blueprint takes the database address from the database, so no password is typed or committed.
- [x] The owner checked that the service's `DATABASE_URL` is the internal address (same region, private network): the
  host has no `.render.com` ending. Render says to use the internal address wherever possible.
- [x] The owner checked that `ipAllowList: []` really blocks outside connections to the database. The Blueprint spec only
  says that leaving it out allows every address, so this was confirmed in the dashboard.
- [x] `alembic upgrade head` runs at start (see `backend/Dockerfile`) and works on an empty Render database. Proof: a
  login with an unknown email returns `401`, not `500`, so the `users` table exists.
- [x] The production database holds no seed users, so there are no demo passwords online (the owner confirmed).

## Security checklist

- [x] `git grep -n -i "secret\|password\|api_key\|token" -- render.yaml netlify.toml` finds only variable names and
  comments, never values.
- [x] `JWT_SECRET` on Render exists (the owner checked) and the API starts with `APP_ENV=production`, which refuses the
  default and any secret under 32 bytes. It comes from `generateValue: true`, not from `.env.example`.
- [x] Both sites answer on HTTPS only: `http://` answers `301` to `https://` on the API and on the site (NFR-06).
- [x] `frontend/package-lock.json` locks `next` 15.5.27 and `react` and `react-dom` 19.1.9, and `package.json` pins them
  without `^` (see "Security update" in [requirements.md](requirements.md)).
- [x] No secrets in the commits; no `.env` change (`.env` is not in the branch diff).
- [x] `TRUSTED_PROXY_COUNT` is the counted number (3) from a real request. The production API reported
  `trusted_proxy_count: 3` and, for a request with forged `X-Forwarded-For: 1.2.3.4, 5.6.7.8`, used the real client
  address. The unit tests in `test_rate_limit.py` cover the rule itself.
- [x] The temporary logging is gone: the probe endpoint was added in `7eb2446` and `e323fa2`, removed in `61e0be0`, and
  `GET /proxy-probe` on production gives `404` (NFR-07).
- [x] Render's free database is empty.

## Smoke test

The production database has no users (decision 3 and the edge cases above), so nobody can log in there. The smoke test
therefore checks what works without a user: the sites, HTTPS, CORS, that the API reaches the database, the 401 paths, and
the login rate limit. A full login (password, code, token) stays covered by the local smoke test in the auth feature.
The API address is `https://swifthealth-api.onrender.com` and the site is `https://swifthealth-ng.netlify.app`.

- [x] `curl -i <api>/health` gives `200` and `{"status":"ok"}`.
- [x] `<api>/docs` opens (`200`).
- [x] `http://` on both the API and the site answers `301` to `https://` (NFR-06).
- [x] `<site>/` opens over HTTPS and shows "API status: connected".
- [x] A preflight from the site's origin gets `access-control-allow-origin` with exactly that origin; a preflight from
  another origin gets `400` and no such header.
- [x] `GET <api>/auth/me` without a token gives `401`.
- [x] `POST <api>/auth/login` with an unknown email gives `401` with `"Invalid email or password"`, not `500`. This
  proves the API reached the database and its tables exist (the migration ran). `/meta` cannot be used for this yet: it
  returns `404` because that endpoint is not built.
- [x] Rate limit through the proxies (`TRUSTED_PROXY_COUNT=3`): 10 login attempts returned `401`, and the 11th, 12th and
  13th returned `429`, with a different forged `X-Forwarded-For` on every attempt. The limit counts the real client and a
  forged header does not dodge it.
- [x] The temporary `/proxy-probe` endpoint is gone: `GET <api>/proxy-probe` gives `404`.
- [x] After 15+ minutes idle, the first site visit may say "not reachable"; reload shows "connected". Passed on the
  second test, see the edge case above.
- [x] `Frontend CI` did not run on commits that changed no `frontend/` file (`277b521`, `b8f940b`).
- Not a gate for this feature: `Backend CI` skipped on a pull request that changes only `frontend/`. It cannot be tested
  in this pull request, which changes both folders, so it moved to the reminder "CI path filters" in
  [LOG.md](../../LOG.md) and is checked on the next frontend-only pull request.
- [x] Netlify with only `netlify.toml`: the owner cleared the dashboard "Runtime" and publish directory overrides,
  redeployed, and the home page still says "connected" (decision 10).

## Merge checklist

- [x] `pytest -q` and `ruff check .` are clean, with no warnings (221 passed with `-W error`).
- [x] `backend.yml` and `frontend.yml` are green on the last code commit `61e0be0`. The two temporary probe commits
  failed `ruff` on purpose-built throwaway code, and the removal fixed it.
- [x] The spec, the [roadmap](../roadmap.md), `LOG.md`, [tech-stack.md](../tech-stack.md) and the production URLs in
  [api-spec.md](../backend/api-spec.md) and `README.md` are up to date.
- [x] The free-plan limits (sleep, 30-day database, no backups) are in `LOG.md` with the expected expiry date.
- [x] The pull request stays a draft until every box above is ticked. All boxes are ticked, so it is marked ready for
  review.

## After the merge (owner)

Render and Netlify now deploy from the feature branch. Switch them to `main` before the branch is deleted, or the
sites stop updating.

- [ ] Render service `swifthealth-api`: deploy branch is `main`.
- [ ] Render Blueprint: tracked branch is `main`, and a sync does not change anything unexpected.
- [ ] Netlify site `swifthealth-ng`: production branch is `main`.
- [ ] A new commit on `main` redeploys both; `<api>/health` and the site home page still work.
- [ ] Only then delete the branch `feature/walking-skeleton-production`.
