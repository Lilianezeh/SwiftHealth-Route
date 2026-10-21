# SwiftRescue (Phase 7): plan

Requirements and decisions: [requirements.md](requirements.md). Tests and checks: [validation.md](validation.md).

Rules: tests first, one commit per task, requirement IDs (US-04, US-09, US-14, FR-14 to FR-19, FR-24 to FR-26, NFR-01, NFR-03, NFR-07, NFR-10) in
every commit and test. Tick a box with its commit hash at the end of the feature. `git branch --show-current` before every commit and push; never
push to `main`. The pull request stays a draft until the merge checklist in [validation.md](validation.md) is ticked.

## Files

| File | Change |
| --- | --- |
| `backend/app/schemas/location.py` | Task 1: `LocationParams` (`lat` and `lng`, both or neither), shared by emergency and (later) blood |
| `backend/app/schemas/emergency.py` | Task 1: `NationalLine`, `EmergencyGroup`, `EmergencyResponse` |
| `backend/app/repositories/search_repository.py` | Task 1: `find_candidates` takes `category_slugs` (many categories in one query) |
| `backend/app/services/emergency_service.py` | Task 1: groups in order, distance sort, 24-hour pharmacies, no sponsored |
| `backend/app/api/routes/emergency.py` | Task 1: `GET /emergency` |
| `backend/tests/unit/test_emergency_service.py`, `backend/tests/integration/test_emergency.py` | Task 1 |
| `frontend/src/types/api.ts`, `src/lib/api/emergency.ts` | Task 2: types and `getEmergency` |
| `frontend/src/lib/emergency/` | Task 2: `shareText.ts` (list text, location text, WhatsApp and SMS links), `offlineCopy.ts` |
| `frontend/src/hooks/useEmergency.ts` | Task 2: loads, falls back to the saved copy |
| `frontend/src/components/emergency/` | Tasks 3 to 5: `NationalLineCard`, `EmergencyGroups`, `EmergencyContactCard`, `NearbyPharmacies`, `ShareEmergencyList`, `ShareMyLocation`, `OfflineNotice`, `RegisterServiceWorker` |
| `frontend/src/app/(public)/emergency/page.tsx` | Task 3: the page (server component, static) |
| `frontend/public/sw.js`, `frontend/netlify.toml` | Task 5: the service worker and its headers |
| `frontend/scripts/make-app-icons.mjs`, `frontend/public/icons/`, `src/app/manifest.ts` | Task 6 |
| `frontend/tests/unit/*`, `frontend/tests/end-to-end/swiftrescue.spec.ts` | each task; Task 6 |
| `specs/backend/api-spec.md`, `specs/frontend/ui-spec.md`, `specs/roadmap.md`, `LOG.md` | Task 0 and Task 7 |

## Tasks

### Task 0: Spec
- [x] This folder, the api-spec text of `GET /emergency` (all groups every time, `hours_note` filled) and the ui-spec 2.5 (`6c6859b`, `35987a4`). The first commit of the branch (`4fb91be`) records the production results of PR #23.

### Task 1: `GET /emergency` (7a, 7e data) (tests first)
- [x] Tests (names in validation.md) fail first; then the schema, the repository parameter, the service and the route (`d5042c5`).

### Task 2: Frontend data layer
- [x] (`9a4ea18`) Tests first for the share texts, the links, the offline copy (no position or distance inside) and the hook (success, network failure with and without a saved copy, API error).

### Task 3: The page (7b, 7e)
- [x] (`fde142a`) Tests first: the 112 card first and static, groups in order, empty groups hidden, the pharmacies section, the disclaimer always visible, no sponsored text, 48 px targets.

### Task 4: Sharing (7c)
- [x] (`015ec5b`) Tests first: the list text, the two links, the location flow (permission, error, denied), nothing stored.

### Task 5: Offline (7d)
- [x] (`d884f5b`) Tests first for the service worker functions (what it keeps, what it never keeps), the registration, and the offline notice. Real browser: visit, go offline, reload.

### Task 6: Installable icons, real-browser checks at 320, 360, 768 and 1024 px
- [x] Icons and manifest (`0e076c2`); the Playwright spec, 20 checks at four widths plus the offline check (`27c80d6`).

### Task 7: Wrap-up
- [x] Full suites, lint, typecheck, build; roadmap, `LOG.md` and `validation.md`; draft pull request (base `main`). The commit and the PR number are in `LOG.md`, "Unattended run".
