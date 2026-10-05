# Specs

What SwiftHealth must do. Change the spec first, then the code, so they never disagree.

| File | What it covers |
| --- | --- |
| `prd.md` | Product requirements for the whole app: user stories (US), functional (FR) and non-functional (NFR) requirements |
| `backend/api-spec.md` | The API contract: every endpoint, its inputs, outputs, rules, errors and tests |
| `backend/endpoints.md` | Quick index of all endpoints |
| `frontend/ui-spec.md` | The UI contract: every screen, its layout, states and the API it calls |

`prd.md` stays at the top because it describes the product as a whole; the backend and frontend specs
both trace back to its requirement IDs.
