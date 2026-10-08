# Walking skeleton in production: plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and
checks that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, NFR-05 or NFR-06 in every commit and test. Tick a box with its commit hash
only when the step is really done. Dashboard steps are done by the owner (decision 8).

## Files

| File | Change |
| --- | --- |
| `specs/2026-10-08-walking-skeleton-production/` | This folder (requirements, plan, validation) |
| `backend/app/core/config.py` | Rewrite a `postgresql://` database address to `postgresql+psycopg://` (decision 4); `cors_origin_list` |
| `backend/app/main.py` | Uses `cors_origin_list`. A temporary proxy probe was added and removed in Task 3 |
| `backend/tests/unit/test_config.py` | Tests for the database address rewrite and the CORS list |
| `backend/tests/integration/test_cors.py` | New: allowed and unknown origins (NFR-06) |
| `render.yaml` | New: Docker web service with `/health` check, Render PostgreSQL, env vars without secrets |
| `netlify.toml` | New: base directory `frontend/`, build command, publish directory, Next.js adapter, no secrets |
| `frontend/package.json`, `frontend/package-lock.json` | Task 2b: `next`, `react`, `react-dom`, `eslint-config-next` upgraded and pinned |
| `.env.example` | Comments for the production values of `APP_ENV`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL` |
| `specs/backend/api-spec.md` | The production base URL |
| `README.md` | The live demo and API docs links |
| `LOG.md` | Render reminders removed; free-plan, proxy and Netlify reminders added; today's entry |
| `specs/roadmap.md` | Phase 4 status and tasks |
| `specs/tech-stack.md` | No change: Task 3 kept our own proxy-header approach |

## Tasks

### Task 0: Spec and documentation check (done, `8694caf`)
- [x] Read the official pages listed in "What the official documentation says" in [requirements.md](requirements.md)
  again, and correct that section if anything changed. Also read Render's health check page and its page on
  environment variables and secrets, which I did not read yet.
- [x] Look for a Render page that says which `X-Forwarded-For` entry is the real client. If there is none, say so in
  requirements.md; Task 3 settles it with a real request. (There is none; Task 3 measured it.)
- [x] Commit: `docs(specs): walking skeleton spec and hosting docs checked (NFR-05, NFR-06)`.

### Task 1: Backend ready for Render (tests first) (done, `faba248`)
- [x] Write the tests first (listed in [validation.md](validation.md)): the database address rewrite in
  `tests/unit/test_config.py`, and the CORS tests in `tests/integration/test_cors.py`. The rewrite tests fail first.
- [x] Add the rewrite to `core/config.py` as a small validator. Addresses that already name a driver are left alone.
  Error messages never show the address, because it holds the password.
- [x] Write `render.yaml`: one Docker web service (`dockerfilePath: ./backend/Dockerfile`,
  `dockerContext: ./backend`, `healthCheckPath: /health`) on the free plan, one free PostgreSQL database,
  `DATABASE_URL` from the database, `APP_ENV=production`, `JWT_SECRET` with `generateValue: true`, and
  `TRUSTED_PROXY_COUNT`. Both the service and the database are in `frankfurt`, the Render region closest to Nigeria in
  the Blueprint spec. No secret value in the file. (`CORS_ORIGINS` was first `sync: false`; Task 3 made it a plain
  value, decision 9.)
- [x] Add `cors_origin_list` to `Settings` so the comma list is split in one tested place; `main.py` uses it.
- [x] Run `pytest -q` and `ruff check .`, then commit:
  `feat(deploy): Render blueprint and database address check (NFR-05, NFR-06)`.

### Task 2: Frontend ready for Netlify (done, `277b521`)
- [x] Write `netlify.toml` with `base = "frontend"` and the build command `npm run build`. (`publish` and the adapter
  were added in Task 3, decision 10.) Add no secrets.
- [x] Check locally that `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass in `frontend/`.
- [x] Update the comments in `.env.example` for the production values.
- [x] Commit: `feat(deploy): Netlify config for the frontend (NFR-05, NFR-06)`.
- [x] In the pull request notes: check that this change ran only `Frontend CI` and not `Backend CI`. Result: `277b521`
  ran `Backend CI` only, so `Frontend CI` did not run; the other direction needs a frontend-only pull request (see
  [LOG.md](../../LOG.md), "CI path filters").

### Task 2b: Security upgrade for React2Shell (done, `62f0505`)
Added when Netlify blocked the first deploy. Details and advisory links: "Security update" in
[requirements.md](requirements.md).
- [x] Check the Next.js and React advisories for the newest patched versions.
- [x] Upgrade `next` to 15.5.27, `react` and `react-dom` to 19.1.9, and `eslint-config-next` to 15.5.27, pinned exactly.
- [x] Run lint, typecheck, tests, `npm run build` and rebuild the frontend Docker image.
- [x] Commit: `fix(deploy): upgrade next, react and react-dom for React2Shell (NFR-06)`.

### Task 3: Deploy, smoke test and settle the proxy count (done, `a3793ce`)
The owner did the dashboard steps. Temporary probe commits: `7eb2446` and `e323fa2` added it, `61e0be0` removed it.
- [x] **Owner, Render:** create a Blueprint from the repository, choose the branch, and confirm the service is "Live"
  and `/health` returns `{"status":"ok"}`. (The first run hit the free database limit; the owner suspended an old free
  database. `CORS_ORIGINS` was missing and was added by hand, decision 9.)
- [x] **Owner, Netlify:** import the repository, base directory `frontend`, `NEXT_PUBLIC_API_URL` set with the "Builds"
  scope, deploy. ("Runtime" showed "Not set" and was set by hand, decision 10.)
- [x] **Owner, Render:** set `CORS_ORIGINS` to the Netlify address (no trailing slash). Now a plain value in
  `render.yaml`.
- [x] **Together:** measure `X-Forwarded-For` through Render with a temporary endpoint, set `TRUSTED_PROXY_COUNT` to 3
  (decision 5), compare with the uvicorn approach, and remove the temporary endpoint (NFR-07).
- [x] Run the smoke test in [validation.md](validation.md). One item is still open: the owner's `netlify.toml`-only
  deploy.
- [x] Fill in the production base URL in [api-spec.md](../backend/api-spec.md) and the links in `README.md`.
- [x] Commit: `docs(specs): proxy count 3, CORS and Netlify settings in config files (NFR-05, NFR-06)`.
- [ ] **Owner, Netlify:** clear the "Runtime" and publish directory overrides, redeploy this branch, and check the home
  page says "connected" (decision 10).

### Task 4: Wrap-up (done, this commit)
- [x] Update `LOG.md`: remove the finished Render reminders, add the free-plan reminders (the API sleeps; the free
  database expires about 2026-11-07; no backups), and add today's entry.
- [x] Update the [roadmap](../roadmap.md), tick the boxes in this folder with their commit hashes, and go through the
  merge checklist in [validation.md](validation.md). Boxes that need the owner's dashboard stay unticked.
- [x] Commit: `docs(specs): walking skeleton wrap-up (NFR-05, NFR-06)`.
