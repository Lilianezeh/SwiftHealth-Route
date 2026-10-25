# SwiftHealth

Verified hospitals, pharmacies and emergency contacts for Enugu, with one-tap calling and directions.

**Live demo:** [swifthealth-ng.netlify.app](https://swifthealth-ng.netlify.app) | **API docs:** [swifthealth-api.onrender.com/docs](https://swifthealth-api.onrender.com/docs)

The demo runs on free plans: the API sleeps after 15 minutes idle, so the first visit can take about a minute.

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

## Authenticator app (free second login step) and what to do if the phone is lost
Staff, admins and providers can switch on an authenticator app at `/admin/security` (a QR code and ten backup codes, shown once). The secret is
stored encrypted with the key in the variable **`TOTP_ENCRYPTION_KEY`** (set it in the Render dashboard; make it on your laptop without a file:
`openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n' | clip.exe` on WSL, `pbcopy` on a Mac; keep a copy in a password manager; if it is lost,
everyone sets the app up again). With no key the API still starts and only the set-up says "not available yet"; in development a public
development key is used. **When the API starts it writes one line about the key in the Render log** ("is set and usable", or why not: not set,
the public development key, or not a usable key with the number of characters it has: a good key has 44), never the key itself.
**Lost phone:** a backup code works instead of the app's code; else another admin resets it (Staff screen API: `POST /admin/users/{id}/reset-two-factor`);
else, for the only admin: set **`RESET_TWO_FACTOR_FOR_EMAIL`** to that account's email in Render, let the API start once (it clears the app of that
account and logs `two-factor reset for an account`), then delete the variable. Details: `specs/2026-10-23-accounts-and-facility-ownership/`.
