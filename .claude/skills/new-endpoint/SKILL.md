---
name: new-endpoint
description: Add a FastAPI endpoint for a SwiftHealth PRD requirement, with role/ownership checks and pytest tests. Use when I ask to build an API feature (e.g. "build FR-27", "add the reports endpoint").
---

# Add an API endpoint

1. Read the requirement (FR/US ID) I name and its section in specs/backend/api-spec.md. Follow the spec exactly;
   if it is unclear or missing something, stop and ask me.
2. Propose a plan and wait for approval:
   - method and path, who can call it (role), ownership rule if any
   - request/response schemas (backend/app/schemas/)
   - route (backend/app/api/routes/), service (backend/app/services/), repository (backend/app/repositories/),
     and any integration (backend/app/integrations/)
   - tests to write (happy path, permission denied, edge case)
3. Write the tests first: business rules in backend/tests/unit/, endpoints in backend/tests/integration/.
   Each test name says what it proves.
4. Implement layer by layer: schema → repository → service → thin route using Depends() for session and
   current user. Routes never query the database; services never touch HTTP.
   - Public endpoints return only published listings.
   - Any listing change writes an audit entry via app/services/audit_service.py.
5. Run `docker compose exec backend pytest -q` and `ruff check .`; fix failures.
6. If the endpoint changed, update specs/backend/api-spec.md and specs/backend/endpoints.md first, with my approval.
7. Summarise: files changed, tests added and passing, and the 3 key points about how it works.
