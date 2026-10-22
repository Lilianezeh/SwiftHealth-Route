# SwiftRescue groups: plan

**Status: proposal, not started.** Requirements: [requirements.md](requirements.md). Rules: tests first, one commit per task, IDs (FR-14 to FR-19, FR-26, NFR-03, NFR-10, US-04, US-09, US-14) in commits and tests; `git branch --show-current` before every commit and push; draft PR. One requirement per change; no new table (still 9); no phone number added anywhere.

## Files

| File | Change |
| --- | --- |
| `backend/alembic/versions/<new>_swiftrescue_more_groups.py` | New revision after `a54b67ca04df`: inserts the three categories (`ON CONFLICT (slug) DO NOTHING`); `downgrade` does nothing |
| `backend/seed/seed_data.py` | The three category rows added (no listing, no phone) |
| `backend/app/services/emergency_service.py` | `GROUPS`: new headings, the nine groups in the order of the table (`blood-bank` last until #39 removes it) |
| `backend/app/schemas/emergency.py` | Docstring only, if it names the groups |
| `backend/tests/integration/test_emergency.py`, `tests/unit/test_categories_migration_list.py`, `tests/unit/test_seed_data.py`, a new migration test | Tests below |
| `frontend/src/config/emergencyGroups.ts` (new; or `lib/emergency/groups.ts` after #39) | The one list by slug: heading, always shown |
| `frontend/src/components/emergency/EmergencyGroups.tsx` | Five always-shown groups from the list, the others only with a contact, headings by slug |
| `frontend/src/lib/emergency/shareText.ts` | Headings from the same list |
| `frontend/src/lib/emergency/offlineCopy.ts` | Keeps unknown groups; nothing else changes |
| `frontend/tests/unit/EmergencyPage.test.tsx`, `emergencyShare.test.ts`, `emergencyOffline.test.ts`, `tests/helpers/api.ts`, `tests/end-to-end/swiftrescue.spec.ts` | Tests below |
| `specs/prd.md` (FR-15), `specs/backend/api-spec.md` (`GET /emergency` rules and tests), `specs/frontend/ui-spec.md` (2.5 point 5), `specs/2026-10-17-swiftrescue/requirements.md` (a note), `specs/roadmap.md`, `LOG.md` | Task 0b and the end |

## Tasks

### Task 0: this folder (done when the owner says "yes")
- [x] requirements.md and plan.md written; waiting for "yes" and the answers.
### Task 0b: the shared specs (after #39 is merged and the branch is updated from `main`)
- [ ] FR-15 in the PRD: the nine groups and which are always shown. api-spec `GET /emergency`: "all nine groups in this order", the new slugs, the tests line. ui-spec 2.5 point 5 and the K2 sentence. A note in `specs/2026-10-17-swiftrescue/requirements.md`. Updated before the code.
### Task 1: the API and the migration (tests first)
- [ ] Red tests: `GET /emergency` returns the nine groups in the order of the table with the new headings, each empty one as `[]`; a published contact in each of the nine slugs appears in its group (test data, in the test only); `blood-bank` is not required; nothing sponsored; the 112 line and the disclaimer unchanged; a listing in a new category that is draft, hidden or flagged is left out.
- [ ] Red migration tests (a fresh database and a database with data): after `upgrade head` the three rows exist with `is_emergency` true and 14 days; **every row and listing that existed before is unchanged** (counts and values); running the revision twice changes nothing; the table list is still the nine; `downgrade` removes nothing; the revision file holds no `phone` and no `INSERT INTO listings`.
- [ ] Seed tests: the seed lists the three categories and **no listing in them**; the seed/migration list test covers both revisions; `/meta` lists the new categories with `is_emergency: true`; a "List your facility" submission with one of them is refused; the staff editor's category list includes them.
- [ ] Build: the migration, the seed rows, `GROUPS`.
### Task 2: the page, the shared list, the offline copy (tests first)
- [ ] Red tests: the five always-shown headings in order with "No contacts added yet. In danger, call 112." when empty; Security and the three new groups hidden when empty and drawn when they have a contact (in table order); the new headings from an **old API answer** (Fire, Roadside assistance) and from an **old saved copy**; an unknown slug still drawn with its own name; all-empty shows the K2 line above five empty groups; 112 and the FR-26 sentence still first; no "Sponsored"; the longest heading is not clipped at 320 px.
- [ ] Share list tests: headings by the new list, only groups with a contact with a number, 112 first, closing line; WhatsApp and SMS links carry the same text.
- [ ] Offline tests: a copy saved with old headings shows the new ones; the copy holds no position, distance or picture data; a group of an unknown slug survives the save.
- [ ] Build `emergencyGroups.ts`, `EmergencyGroups.tsx`, `shareText.ts`.
### Task 3: real browser, 320 / 360 / 768 / 1024 px
- [ ] `swiftrescue.spec.ts` extended: five always-shown groups with the empty line, fits the screen, 16 px text, 48 px targets; a fake API answer with contacts in a new group; the offline check on a production build (`OFFLINE_CHECK=1`) still passes with the saved copy.
### Task 4: wrap-up
- [ ] `validation.md` with the results (backend `pytest -q -W error`, `ruff check .`, frontend tests, `tsc`, lint, the browser runs); LOG; draft PR (base `main`), noting: the API changes only after Render redeploys and runs `alembic upgrade head` (the Dockerfile start command already does), that the page works with both the old and the new answer, and that staff add the contacts.
