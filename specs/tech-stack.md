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
| Outside services | Paystack (test mode), Cloudinary, Resend, Termii (sandbox) |

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
- **`httpx2` for the test client, and CI split into `backend.yml` and `frontend.yml`.** Both are planned for
  auth Task 4 (see "To do later" in [LOG.md](../LOG.md)).

## Where the details are

- Rules for code, layers, roles and commands: [CLAUDE.md](../CLAUDE.md)
- Requirements: [prd.md](prd.md)
- API contract: [backend/api-spec.md](backend/api-spec.md)
- UI contract: [frontend/ui-spec.md](frontend/ui-spec.md)
- Auth decisions in full: [requirements.md](2026-10-05-auth-and-roles/requirements.md), with the task list in
  [plan.md](2026-10-05-auth-and-roles/plan.md)
