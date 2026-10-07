# Specs

What SwiftHealth must do. Change the spec first, then the code, so they never disagree.

| File | What it covers |
| --- | --- |
| `mission.md` | Why we build SwiftHealth, where we start, and the principles we never break |
| `tech-stack.md` | The fixed stack and the main technical decisions, with the reason for each |
| `roadmap.md` | The build order in very small phases, with the status of each |
| `YYYY-MM-DD-feature-name/` | One folder per feature, e.g. `2026-10-05-auth-and-roles/`. It holds `requirements.md` (what and why), `plan.md` (numbered tasks) and `validation.md` (how we know it is done) |
| `prd.md` | Product requirements for the whole app: user stories (US), functional (FR) and non-functional (NFR) requirements |
| `backend/api-spec.md` | The API contract: every endpoint, its inputs, outputs, rules, errors and tests |
| `backend/endpoints.md` | Quick index of all endpoints |
| `frontend/ui-spec.md` | The UI contract: every screen, its layout, states and the API it calls |

`prd.md` stays at the top because it describes the product as a whole; the backend and frontend specs
both trace back to its requirement IDs.
