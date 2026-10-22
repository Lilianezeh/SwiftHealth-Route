# SwiftRescue groups: validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results (2026-10-22, branch `feature/swiftrescue-groups`, from `main` after #37, #39, #40 and #41/#42)

- **Backend:** `pytest -q -W error` **1409 passed**; `ruff check .` clean. New tests, red first: the nine groups and headings of `GET /emergency`, a
  published contact in each of the nine categories, draft and hidden contacts in the new groups left out; the revision (rows, renames, guards, idempotent,
  downgrade, the old-names database, no other table touched, still the 9 tables, no phone and no listing in the revision file); the seed (three new
  categories, no listing in them); `/meta` lists the new categories as emergency ones; "List your facility" refuses them. Two older tests were adapted
  (the seed/migration list test now compares the old list plus the new revision; the WhatsApp revision test checks "one head" instead of "is the head").
- **Real PostgreSQL (local development database):** `alembic upgrade head` ran `a54b67ca04df -> c3d71e9b5a20`; `GET /emergency` returned the nine groups with
  the new headings and the existing demo contacts (Ambulance 2, Fire service 1, Police 2, Hospital emergency 2, Road accidents 1, Security 1, the three new
  ones 0); `GET /meta` listed the three renamed names and the three new categories. `alembic downgrade -1` brought back "Fire", "24-hour emergency unit" and
  "Roadside assistance" and kept the three new rows; `upgrade head` again renamed them. Nothing was deleted.
- **Frontend:** `vitest` **1517 passed** (106 files); `tsc --noEmit` and `next lint` clean. New tests, red first: `EmergencyGroupsList.test.tsx` (15 tests: the list,
  the five always-shown groups and their empty line, the four shown only with a contact and their order, an old API answer, a copy saved before the change
  with the network off, an unknown slug, the shared list with the new headings, no phone number in the list).
- **Real browser at 320, 360, 768 and 1024 px (development server):** `swiftrescue.spec.ts` **28 passed, 1 skipped** (the skipped one is the offline check).
  New: the five groups in order with the old API headings replaced by the new ones; a contact in the two new groups, the long heading wrapping inside the screen,
  the shared WhatsApp link carrying it.
- **Offline check on a production build** (`OFFLINE_CHECK=1`, `next build` of a copy, `next start -p 3100`): **1 passed**. The server was stopped afterwards.

## Checklist
- [x] 112 first and the FR-26 sentence unchanged; nothing sponsored; all text 16 px or more; targets 48 px or more; no red cross
- [x] Ambulance, Fire service, Police, Hospital emergency (24 hours), Road accidents always shown, in that order, with "No contacts added yet. In danger, call 112."
- [x] Security and the three new groups only with a contact
- [x] Additive migration: three rows inserted, three display names changed (guarded), ids and slugs kept, downgrade restores the names, nothing deleted
- [x] No phone number and no contact added by this feature (tests scan the revision and the seed)
- [ ] The photos of the home-photos work go under the Ambulance and Fire service groups when that feature is built (the slots are by slug)
- [ ] **The API changes only after Render redeploys** (its start command runs `alembic upgrade head`). Until then the page shows the new headings from the old answer and the saved copy, and the three new groups simply do not appear.
- [ ] The owner looks at `/emergency` on the preview
