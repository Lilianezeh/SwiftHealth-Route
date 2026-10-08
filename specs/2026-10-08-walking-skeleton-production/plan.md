# Walking skeleton in production: plan

How we build it, in small tasks. Requirements and decisions are in [requirements.md](requirements.md); the tests and
checks that prove each task are in [validation.md](validation.md).

Rules: tests first, one commit per task, NFR-05 or NFR-06 in every commit and test. Tick a box with its commit hash
only when the step is really done. Dashboard steps are done by the owner (decision 8).

## Files

| File | Change |
| --- | --- |
| `specs/2026-10-08-walking-skeleton-production/` | This folder (requirements, plan, validation) |
| `backend/app/core/config.py` | Rewrite a `postgresql://` database address to `postgresql+psycopg://` (decision 4) |
| `backend/tests/unit/test_config.py` | Tests for the database address rewrite |
| `backend/tests/integration/test_cors.py` | New: allowed and unknown origins (NFR-06) |
| `render.yaml` | New: Docker web service `/health` check, Render PostgreSQL, env vars without secrets |
| `netlify.toml` | New: base directory `frontend/`, build command, no secrets |
| `.env.example` | Comments for the production values of `APP_ENV`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL` |
| `specs/backend/api-spec.md` | Fill in the production base URL when it exists |
| `README.md` | Fill in the live demo and API docs links |
| `LOG.md` | Remove the finished Render reminders; add the free-plan reminders; add today's entry |
| `specs/roadmap.md` | Phase 4 status and tasks |
| `specs/tech-stack.md` | Only if Task 3 changes the proxy-header approach |

## Tasks

### Task 0: Spec and documentation check
- [ ] Read the official pages listed in "What the official documentation says" in [requirements.md](requirements.md)
  again, and correct that section if anything changed. Also read Render's health check page and its page on
  environment variables and secrets, which I did not read yet.
- [ ] Look for a Render page that says which `X-Forwarded-For` entry is the real client. If there is none, say so in
  requirements.md; Task 3 settles it with a real request.
- [ ] Commit: `docs(specs): walking skeleton spec and hosting docs checked (NFR-05, NFR-06)`.

### Task 1: Backend ready for Render (tests first)
- [ ] Write the tests first (listed in [validation.md](validation.md)): the database address rewrite in
  `tests/unit/test_config.py`, and the CORS tests in `tests/integration/test_cors.py`. The rewrite tests fail first.
- [ ] Add the rewrite to `core/config.py` as a small validator. Addresses that already name a driver are left alone.
  Error messages never show the address, because it holds the password.
- [ ] Write `render.yaml`: one Docker web service (`dockerfilePath: ./backend/Dockerfile`,
  `dockerContext: ./backend`, `healthCheckPath: /health`) on the free plan, one free PostgreSQL database,
  `DATABASE_URL` from the database, `APP_ENV=production`, `JWT_SECRET` with `generateValue: true`, `CORS_ORIGINS` typed
  in the dashboard (`sync: false`), and `TRUSTED_PROXY_COUNT` as the placeholder `"1"` until Task 3 counts the real
  value. Both the service and the database are in `frankfurt`, the Render region closest to Nigeria in the Blueprint
  spec. No secret value in the file.
- [ ] Add `cors_origin_list` to `Settings` so the comma list is split in one tested place; `main.py` uses it.
- [ ] Run `pytest -q` and `ruff check .`, then commit:
  `feat(deploy): Render blueprint and database address check (NFR-05, NFR-06)`.

### Task 2: Frontend ready for Netlify
- [ ] Write `netlify.toml` with `base = "frontend"` and the build command `npm run build`. Leave `publish` unset unless
  the Netlify docs say otherwise, because the OpenNext adapter configures it (Task 0 confirms). Add no secrets.
- [ ] Check locally that `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass in `frontend/`.
- [ ] Update the comments in `.env.example` for the production values.
- [ ] Commit: `feat(deploy): Netlify config for the frontend (NFR-05, NFR-06)`.
- [ ] In the pull request notes: check that this change ran only `Frontend CI` and not `Backend CI` (reminder in
  [LOG.md](../../LOG.md): the `frontend/**` path filter has not been tested yet).

### Task 3: Deploy, smoke test and settle the proxy count
- [ ] **Owner, Render:** create a Blueprint from the repository (New, Blueprint), choose the branch, type the values
  asked for (`CORS_ORIGINS` as the Netlify address, which you only know after the Netlify step, so use a placeholder and
  correct it afterwards). Confirm the service shows "Live" and `https://<service>.onrender.com/health` returns
  `{"status":"ok"}`.
- [ ] **Owner, Netlify:** import the repository, check that the base directory is `frontend`, and set
  `NEXT_PUBLIC_API_URL` to the Render address with the "Builds" scope. Deploy.
- [ ] **Owner, Render:** set `CORS_ORIGINS` to the Netlify address (no trailing slash) and redeploy the API.
- [ ] **Together:** log one `X-Forwarded-For` header from a request through Render, count the entries, and set
  `TRUSTED_PROXY_COUNT` to match (decision 5). Compare with the uvicorn `--proxy-headers` approach. Remove the temporary
  logging afterwards, because a log of client addresses is personal data (NFR-07).
- [ ] Run the smoke test in [validation.md](validation.md).
- [ ] Fill in the production base URL in [api-spec.md](../backend/api-spec.md) and the links in `README.md`.
- [ ] Commit: `docs(specs): production URLs and proxy count settled (NFR-05, NFR-06)`.

### Task 4: Wrap-up
- [ ] Update `LOG.md`: remove the finished Render reminders, add the free-plan reminders (the API sleeps; the free
  database expires 30 days after creation, so write the real date; no backups), and add today's entry.
- [ ] Update the [roadmap](../roadmap.md), tick the boxes in this folder with their commit hashes, and go through the
  merge checklist in [validation.md](validation.md).
- [ ] Commit: `docs(specs): walking skeleton wrap-up (NFR-05, NFR-06)`.
