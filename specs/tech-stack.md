# SwiftHealth: tech stack

What we build with, and why. The stack is fixed: changing it needs the owner's approval. The layer rules and the
code style are in [CLAUDE.md](../CLAUDE.md) and are not repeated here.

## Stack

| Part | Choice |
| --- | --- |
| Frontend | Next.js App Router, TypeScript (strict), Tailwind CSS, shadcn/ui |
| Maps and charts | Leaflet with OpenStreetMap, Recharts |
| Backend | FastAPI, SQLModel, Alembic |
| Database | PostgreSQL |
| Tests and lint | pytest and ruff (backend); lint, typecheck and tests with npm (frontend) |
| Local development | Docker Compose |
| Production | Netlify (frontend), Render (backend) |
| Outside services | Paystack (test mode), Cloudinary, Resend, Termii (no sandbox: with no key the code is logged locally; real sending needs a live account with the DND route activated and an approved sender ID) |

## Decisions

One line each, with the reason.

- **One repository with `backend/` and `frontend/`.** One change can cover both sides of a feature.
- **Next.js App Router, server components by default.** Less JavaScript is sent to the phone, which matters on
  slow 3G ([NFR-01](prd.md#non-functional-requirements)).
- **Netlify for the frontend, not Vercel.** The owner already hosts other projects on Netlify, so one account
  and one dashboard cover everything. Netlify supports the Next.js App Router (Next.js 13.5 and later) through
  its OpenNext adapter, applied automatically, with no `netlify.toml` needed
  ([Netlify Next.js docs](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)).
- **Layered architecture: route, service, repository or integration.** Each layer has one job and only calls
  the layer below it. The rules are in [CLAUDE.md](../CLAUDE.md).
- **Exactly 10 database tables, and areas are a fixed list in `core/config.py`.** It keeps the model small.
  Adding, merging or removing a table needs approval (the 10th, `facility_owners`, was approved on 2026-10-24).
- **Money is `Decimal` in Python and a string like "1500.00" in JSON, never `float`.** Floats round badly.
  Convert to kobo only when calling Paystack.
- **Leaflet with OpenStreetMap.** No map API key and no per-load cost.
- **PyJWT, not python-jose.** The current FastAPI documentation uses PyJWT
  ([auth requirements](2026-10-05-auth-and-roles/requirements.md)).
- **The JWT only identifies the user.** Role and `is_active` are read from the database on every request, so a
  role change or deactivation takes effect on the next request.
- **pwdlib with Argon2 for passwords.** The current FastAPI tutorial recommends it, and passlib logs the `crypt`
  deprecation warning and breaks with newer bcrypt. The move was a re-seed of the demo users, done while we only
  had demo data ([feature](2026-10-08-pwdlib-password-hashing/requirements.md)).
- **The database port is internal to Docker Compose.** `docker-compose.yml` does not publish port 5432 to the host
  (commit `f5402f5`). The backend reaches PostgreSQL as `db:5432` on the Compose network, and nothing on the host
  connects to it directly. Use `docker compose exec db psql ...` for manual access. The backend and frontend ports
  are published on `127.0.0.1` only.
- **Tests run on PostgreSQL (`swifthealth_test`), never SQLite.** Enums, NUMERIC and time zones then behave as
  in production.
- **`httpx` stays, and CI is split into `backend.yml` and `frontend.yml`.** Tests use `httpx.AsyncClient` instead
  of Starlette's `TestClient`, so `httpx2` is not needed. Each workflow runs only when its own folder or workflow
  file changes, and the backend workflow has a `postgres:18` service for the tests.
- **PostgreSQL 18 everywhere: Docker Compose, backend CI and Render.** The Render database runs 18 (read from the
  dashboard on 2026-10-09), so the tests run on the production version. The image changed its data path in 18, so the
  compose volume is mounted at `/var/lib/postgresql`. Moved from 16 in the search feature
  ([plan](2026-10-09-search-backend/plan.md), Task 1c).
- **Node.js 24 (Active LTS) for the frontend: Dockerfile, Netlify and the frontend CI.** Node 20 reached end of life on
  2026-04-30 (official [release schedule](https://github.com/nodejs/Release/blob/main/schedule.json), checked 2026-10-09).
  Node 24 is the Active LTS on that date (Maintenance LTS from 2026-10-20, supported until 2028-04-30). Next.js 15.5
  accepts Node 20 or newer, and Netlify takes a major version in `NODE_VERSION`. Node 26 becomes LTS on 2026-10-28; we
  move to it in 2027, before 2028-04-30. The four places that name the version (`frontend/Dockerfile`, `netlify.toml`,
  `.github/workflows/frontend.yml`, `@types/node` in `package.json`) are kept equal by
  `bash scripts/check-node-version.sh`, which the frontend CI runs. The backend runs Python and is not affected.
- **Frontend component tests: vitest with `jsdom` and Testing Library, dev-only, exact versions.** The owner approved
  five packages on 2026-10-09 so tests can render a component, click it and check what a visitor sees (NFR-10):
  `jsdom` 30.1.2, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1 and
  `@testing-library/user-event` 14.6.7. Chosen for Node 24 and React 19.1 with the installed vitest 3.2.7: `jsdom`
  needs Node 24.15 or newer (the Docker image is 24.21), `jest-dom` needs Node 22 or newer, `@testing-library/react`
  accepts React 19 and needs `@testing-library/dom` 10 as its peer. They are pinned without `^` so a test run never changes
  by itself, and nothing is shipped to a phone. Fake timers (`vi.useFakeTimers`) test time limits without waiting.
  Plain logic stays in `*.test.ts` (Node); a component test is a `*.test.tsx` that starts with
  `// @vitest-environment jsdom`. `npm audit` shows the same 11 findings before and after adding them.
- **Icons: `lucide-react` 1.47.0, exact version, one icon per import (owner's decision, 2026-10-09).** `components.json` already
  named lucide as the icon library for shadcn/ui; the package is now installed so cards and buttons can carry the
  icons of the Figma reference (phone, route, pin, shield, clock, search). Rules: named imports only (`import { Phone } from
  "lucide-react"`, never the whole set or a dynamic icon, so the build keeps only the icons we use); drawn through
  `components/ui/DecorativeIcon.tsx`, which hides them from screen readers; always beside a text label, never alone.
  Version 1.47.0 was released on 2026-09-17, more than three weeks before we pinned it (the package ships a new version
  every few days; we do not take one that is only days old). `tests/unit/icons.test.ts` checks the pin and the import style.
  `npm audit` shows the same 11 findings as before.
- **The backend is async wherever code waits on I/O.** Database access (async engine and `AsyncSession`, all
  repositories), integrations (`httpx.AsyncClient`) and the routes and services that use them are `async def`.
  Pure CPU code stays sync: `security.py` (JWT, HMAC, codes) and the rate limiter. Password hashing is called
  through `run_in_threadpool` from async code so it never blocks the event loop. Sync database code is never
  called from an async route. A blocked event loop stalls every request, and we run on one small Render instance
  for users on slow connections. Details and the setup are in the
  [auth requirements](2026-10-05-auth-and-roles/requirements.md), decision 11.

## Where the details are

- Rules for code, layers, roles and commands: [CLAUDE.md](../CLAUDE.md)
- Requirements: [prd.md](prd.md)
- API contract: [backend/api-spec.md](backend/api-spec.md)
- UI contract: [frontend/ui-spec.md](frontend/ui-spec.md)
- Auth decisions in full: [requirements.md](2026-10-05-auth-and-roles/requirements.md), with the task list in
  [plan.md](2026-10-05-auth-and-roles/plan.md)
