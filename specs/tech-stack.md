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
| Production | Vercel (frontend), Render (backend) |
| Outside services | Paystack (test mode), Cloudinary, Resend, Termii (no sandbox: with no key the code is logged locally; real sending needs a live account with the DND route activated and an approved sender ID) |

## Decisions

One line each, with the reason.

- **One repository with `backend/` and `frontend/`.** One change can cover both sides of a feature.
- **Next.js App Router, server components by default.** Less JavaScript is sent to the phone, which matters on
  slow 3G ([NFR-01](prd.md#non-functional-requirements)).
- **Layered architecture: route, service, repository or integration.** Each layer has one job and only calls
  the layer below it. The rules are in [CLAUDE.md](../CLAUDE.md).
- **Exactly 9 database tables, and areas are a fixed list in `core/config.py`.** It keeps the model small.
  Adding, merging or removing a table needs approval.
- **Money is `Decimal` in Python and a string like "1500.00" in JSON, never `float`.** Floats round badly.
  Convert to kobo only when calling Paystack.
- **Leaflet with OpenStreetMap.** No map API key and no per-load cost.
- **PyJWT, not python-jose.** The current FastAPI documentation uses PyJWT
  ([auth requirements](2026-10-05-auth-and-roles/requirements.md)).
- **The JWT only identifies the user.** Role and `is_active` are read from the database on every request, so a
  role change or deactivation takes effect on the next request.
- **passlib with bcrypt now, pwdlib right after auth and roles.** Moving later is a re-seed, so it is cheapest
  while we only have demo data. It also removes the passlib `crypt` deprecation warning
  (see [roadmap.md](roadmap.md)).
- **Tests run on PostgreSQL (`swifthealth_test`), never SQLite.** Enums, NUMERIC and time zones then behave as
  in production.
- **`httpx` stays, and CI is split into `backend.yml` and `frontend.yml`.** Tests use `httpx.AsyncClient` instead
  of Starlette's `TestClient`, so `httpx2` is not needed. The split is planned for auth Task 4a (see "To do later"
  in [LOG.md](../LOG.md)).
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
