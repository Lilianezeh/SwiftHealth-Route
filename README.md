# SwiftHealth

Verified hospitals, pharmacies and emergency contacts for Enugu, with one-tap calling and directions.

**Live demo:** [Netlify URL] | **API docs:** [Render URL]/docs

## The problem (with evidence)
[Summarise RESEARCH.md: what the two interviews showed, with links to the artefacts in `docs/research/`.]

## The hard part
"Open now, nearest first" search that only returns trustworthy listings: distance from the user, opening hours in Lagos time (WAT) including hours past midnight, and hiding listings that are overdue for re-check or reported broken twice in 7 days. Proven by three tests in `backend/tests/unit/test_search_service.py`.

## Why this design (with sources)
[Three design decisions, each pointing to a finding or source in RESEARCH.md.]

## Who pays
Residents never pay. Hospitals, clinics, pharmacies and labs pay a monthly fee for featured listings (Paystack). Sponsors fund the free Emergency section.

## Project structure
```
backend/            FastAPI + PostgreSQL
  app/
    api/routes/     HTTP endpoints (thin)
    schemas/        request and response shapes
    services/       business rules
    repositories/   database queries
    integrations/   Paystack, Cloudinary, Resend, Termii
    models/         the 9 database tables
    core/           settings, database connection, security
    jobs/           scheduled tasks
  alembic/          migrations
  seed/             demo data
  tests/            unit/ and integration/
frontend/           Next.js (App Router)
  src/
    app/            routes and pages
    components/     ui/, layout/, and feature components
    lib/            api/ (backend calls), formatters/, utils
    hooks/ types/ config/ styles/
specs/              PRD, backend and frontend specs
docs/               research evidence and sketches
spikes/             technical spike
```

## Run it locally
```bash
cp .env.example .env
docker compose up --build
docker compose exec backend alembic revision --autogenerate -m "initial tables"   # first time only
docker compose exec backend alembic upgrade head
docker compose exec backend python -m seed.seed
```
- Web: http://localhost:3000
- API docs: http://localhost:8000/docs

## Tests
```bash
docker compose exec backend pytest
cd frontend && npm test
```

## Demo logins
[Filled in by the seed script: admin, editor, verifier, provider.]
