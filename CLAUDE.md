# CLAUDE.md — SwiftHealth

I'm building SwiftHealth, an emergency, hospital and pharmacy finder that helps people quickly find verified
healthcare facilities and emergency contacts near them. Keep the code simple, readable and maintainable rather
than clever, and tell me what you changed and why.

## What we are building
SwiftHealth is the app; SwiftRescue is the name of its emergency section and the emergency button.
We launch in Enugu first (pilot area), but nothing in names or code should be tied to Enugu only.
A verified directory of health facilities and emergency contacts for Enugu (pilot area first).
Residents search, see listings, and call or get directions in one tap. Staff verify every listing.
Providers pay (Paystack test mode) for featured listings. Full spec: see specs/prd.md (requirement IDs
US-xx, FR-xx, NFR-xx). Reference those IDs in plans, commits and tests.

## Stack (do not change without asking)
- frontend/: Next.js App Router, TypeScript (strict), Tailwind CSS, shadcn/ui, Leaflet + OpenStreetMap, Recharts
- backend/: FastAPI, SQLModel, Alembic, PostgreSQL, pytest, ruff
- Docker Compose locally; Vercel (frontend) + Render (backend) in production
- Integrations: Paystack (test mode), Cloudinary, Resend, Termii: no sandbox; locally with no key the code is
  logged to the console; real sending needs a live account with the DND route activated and an approved sender ID

## Project structure and layers
Each layer has one job and only calls the layer below it. Never skip a layer.

Backend (backend/app/):
- `api/routes/` HTTP only: read the request, call a service, return a schema. No business rules, no queries.
- `api/dependencies.py` shared dependencies: database session, current user, role checks.
- `schemas/` request and response shapes (Pydantic/SQLModel, not tables).
- `services/` business rules (search, verification, auto-flag, payments). No HTTP, no raw queries.
- `repositories/` the only code that queries the database. One file per table group.
- `integrations/` the only code that calls outside services (Paystack, Cloudinary, Resend, Termii).
- `models/` the 9 database tables. `core/` settings, database connection, security. `jobs/` scheduled tasks.
- Flow: route → service → repository / integration → database or outside service.

Frontend (frontend/src/):
- `app/` routes and pages only: thin, compose components, fetch data through `lib/api/`.
- `components/ui/` shadcn primitives · `components/layout/` header, footer · `components/<feature>/` feature UI
  (e.g. `components/listings/ListingCard.tsx`, `components/emergency/`).
- `lib/api/` the only code that calls the backend · `lib/formatters/` phone, money, dates · `lib/utils.ts`.
- `hooks/` reusable client logic · `types/` API types matching the spec · `config/` site constants · `styles/`.
- Flow: page → components → hooks → lib/api → backend.

## Data model: exactly 9 tables
users, categories, listings, phone_numbers, opening_hours, services, verification_checks,
user_reports, audit_entries. Models live in backend/app/models/ (one file per table).
- NEVER add, merge or remove a table without asking me first.
- Areas are a fixed list in backend/app/core/config.py, not a table.
- Paystack payments set listings.featured_until and write an audit_entries row (reference field).
- Blood groups for blood banks are stored as rows in services.

## Roles and rules
- Visitor (no login), verifier, editor, admin, provider.
- Every staff/provider endpoint loads the user from the database and checks the role and is_active
  from that row; the JWT only identifies the user (no role in the token). Verifiers may only edit drafts they
  created (listings.created_by); providers only their own listing (listings.owner_id).
- The public sees only listings with status "published".
- Every listing change writes an audit entry.
- Emergency section (SwiftRescue): 112 always first; never show sponsored/featured placement there.
- No medical diagnosis or treatment advice anywhere.
- reporter_phone in user_reports is optional and deleted when the report is resolved (NDPA 2023).

## The hard part
"Open now, nearest first" search (backend/app/services/search_service.py, hours.py): distance from the user,
opening hours in Africa/Lagos time including hours that cross midnight (check yesterday's row),
and excluding listings reported "not working" by 2 users in 7 days. Overdue listings are not excluded: they stay
visible with `verification_due: true` until the nightly job moves them to `recheck_due`, which hides them.
The reference logic is spikes/open_now_nearest.py. Its three tests live in backend/tests/unit/test_search_service.py.

## Commands
- Start everything: `docker compose up --build`
- Migrations: `docker compose exec backend alembic revision --autogenerate -m "msg"` then `alembic upgrade head`
- Seed: `docker compose exec backend python -m seed.seed`
- Backend tests/lint: `docker compose exec backend pytest -q` and `docker compose exec backend ruff check .`
- Frontend: `cd frontend && npm run lint && npm run typecheck && npm test`

## Specs (source of truth)
- Requirements: specs/prd.md (US/FR/NFR IDs) · API: specs/backend/api-spec.md · UI: specs/frontend/ui-spec.md.
- Before building an endpoint or page, read its section in the spec and follow it exactly.
- If something isn't specified or the spec seems wrong, ask me instead of guessing. Update the spec first,
  then the code, so they never disagree.
- Every feature has its own folder in specs/YYYY-MM-DD-feature-name/ with requirements.md, plan.md and validation.md. Read them before working on that feature, tick tasks with their commit hash at the end of the feature, and check validation.md before saying a feature is done. Pull requests stay drafts until the merge checklist is complete.

## How to work
1. For any feature, propose a short plan first (files to touch, endpoints, tests) and wait for my go-ahead.
2. Write or update tests before or alongside the code. Tests must check the actual requirement.
3. Keep changes small: one requirement per change. Do not refactor unrelated code.
4. After changes, run the relevant tests and lint, and report the results honestly.
5. Finish by summarising what changed and anything I should be able to explain.

## Working efficiently
- Keep replies short: summaries of 10 lines or fewer, no full file dumps unless I ask.
- Work in bigger chunks: one plan for several related tasks.
- Update plan.md, validation.md, roadmap.md and LOG.md once at the end of a feature, not after each task.
- One commit per task is fine; don't make separate commits just to tick boxes.
- Skip mutation checks except for security code.

## Code style
- Readable names everywhere: no single-letter or cryptic names (use `response`, not `r`; `place`, not `p`).
  Someone new to the code should understand each name without asking.
- Python: type hints everywhere; follow the layers above; raise HTTPException only in routes (services raise
  clear domain errors that routes translate). Use Depends() for session and current user.
- Async wherever code waits on I/O (database, httpx, routes and services using them); CPU-only code (security.py,
  the RateLimiter class) stays sync; call password hashing through `run_in_threadpool`; never call sync DB code from
  an async route. Rule of thumb: a function is async only if it awaits the database or an outside service, or calls
  something that does. Pure logic stays plain def, even inside services. Exception: in-memory shared state used from
  a dependency (like the rate limiter) uses async def without await, so it runs on the event loop and can't race.
  Comment why wherever this is used.
- Use the patterns from the FastAPI docs at fastapi.tiangolo.com/learn (Tutorial - User Guide, plus Concurrency and
  async/await and Async Tests for async code). If something needs a pattern from elsewhere, ask me first and explain it.
- File names say their layer: `listing_service.py`, `listing_repository.py`, `paystack.py`, `listing.py` (schema/model).
- TypeScript: no `any`; server components by default, "use client" only when needed; API calls only via
  frontend/src/lib/api/. Component files in PascalCase (ListingCard.tsx).
- UI: mobile-first, large tap targets (min 48px), text 16px+, works on slow 3G.
- Phone numbers stored and shown as +234...
- Money is always `Decimal` (Python) with 2 decimal places, never `float`. In JSON, send and return money as
  strings like "1500.00". Convert to kobo (integer) only when calling Paystack: `int(amount * 100)`.

## Never
- Never commit or print secrets; never edit .env. Use test keys only.
- Never invent library APIs, Paystack/Termii/Cloudinary fields or legal claims. If unsure, say so and
  point to the official docs.
- Don't start a new feature without my go-ahead on the plan.
- Never use real facilities' phone numbers in seed data; demo data must be clearly fictional.
