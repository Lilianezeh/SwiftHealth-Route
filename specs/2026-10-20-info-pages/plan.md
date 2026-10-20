# Information pages and polish (Phase 13): plan

Requirements: [requirements.md](requirements.md). Tests: [validation.md](validation.md). Rules: tests first, one commit per task, IDs (FR-23, FR-13, FR-26,
NFR-07, NFR-13, NFR-01, NFR-10, NFR-12, US-13) in every commit and test; `git branch --show-current` before every commit and push; the PR stays a draft.

## Files

| File | Change |
| --- | --- |
| `frontend/src/components/info/InfoPage.tsx`, `DraftNotice.tsx` | Task 1: the shared layout and the draft notice |
| `frontend/src/app/(public)/{about,how-we-verify,privacy,terms,contact}/page.tsx` | Task 2: the five pages, each with `metadata` |
| `frontend/src/config/site.ts` | Tasks 2 and 3: `contactEmail`, `siteUrl` |
| `frontend/src/components/layout/PageFrame.tsx`, `SkipLink.tsx` | Task 3: the skip link and `<main id="main">` |
| `frontend/src/app/layout.tsx`, other public pages | Task 3: the title template and a title and description everywhere |
| `frontend/src/app/robots.ts`, `app/sitemap.ts` | Task 3 |
| `frontend/tests/unit/InfoPages.test.tsx`, `SkipLink.test.tsx`, `PageMetadata.test.ts`, `RobotsSitemap.test.ts`; `tests/end-to-end/info-pages.spec.ts` | each task; Task 4 |
| `specs/frontend/ui-spec.md` 2.10, `specs/roadmap.md`, `LOG.md` | Task 0 and Task 5 |

## Tasks

### Task 0: Spec
- [ ] This folder and ui-spec 2.10.

### Task 1: the shared layout (tests first)
- [ ] `InfoPage` and `DraftNotice`.

### Task 2: the five pages (tests first)
- [ ] About, How we verify, Privacy, Terms, Contact.

### Task 3: the pass (tests first)
- [ ] Skip link, titles and descriptions, robots and sitemap, noindex for staff pages.

### Task 4: real-browser checks at 320, 360, 768 and 1024 px
- [ ] Layout, keyboard, skip link.

### Task 5: Wrap-up
- [ ] Suites, docs, draft PR (base `feature/staff-screens`).
