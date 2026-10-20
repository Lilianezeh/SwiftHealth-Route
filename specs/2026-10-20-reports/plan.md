# Reports (Phase 9): plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, one commit per task, IDs (US-08, FR-20 to FR-22,
NFR-06, NFR-07, FR-38) in every commit and test; `git branch --show-current` before every commit and push; never push to `main`; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `backend/app/core/phone.py` | Task 1: `normalise_nigerian_phone` |
| `backend/app/core/rate_limit.py`, `api/dependencies.py`, `tests/conftest.py` | Task 1: `report_limiter` (5 per hour) and `report_rate_limit` |
| `backend/app/schemas/report.py`, `repositories/report_repository.py`, `services/report_service.py`, `api/routes/reports.py` | Task 2: the endpoint, the flag |
| `backend/app/integrations/resend.py`, `core/config.py`, `.env.example`, `render.yaml` | Task 3: email to editors |
| `backend/app/services/staff_alert_service.py`, `repositories/user_repository.py` | Task 3: who is told |
| `frontend/src/app/(public)/report/[slug]/page.tsx` and `components/report/*`, `lib/api/reports.ts`, `types/api.ts` | Task 4 |
| `frontend/src/components/emergency/EmergencyContactCard.tsx`, `components/listing/ListingDetailView.tsx` | Task 5: the link |
| `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md` | Task 0 and Task 6 |

## Tasks

### Task 0: Spec
- [ ] This folder, api-spec "POST /reports", ui-spec 2.8.

### Task 1: phone normalisation and the rate limit (tests first)
- [ ] `normalise_nigerian_phone`; `report_limiter`.

### Task 2: `POST /reports` and the flag (tests first)
- [ ] Create, validate, key, count, flag, audit.

### Task 3: staff alerts (tests first)
- [ ] Resend integration, recipients, background send, no personal data.

### Task 4: the report form (tests first)
- [ ] Page, form, states, 422 and 429 messages.

### Task 5: the links and real-browser checks
- [ ] Contact card link, listing link by slug; Playwright at 320, 360, 768, 1024 px.

### Task 6: Wrap-up
- [ ] Full suites, docs, draft PR (base `feature/swiftrescue`).
