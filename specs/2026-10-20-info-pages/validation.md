# Information pages and polish (Phase 13): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## How to run
- `cd frontend && npm run lint && npm run typecheck && npm test`; the build `npm run build`; real browser `npx playwright test info-pages`

## Results (2026-10-20)
- Frontend: lint and typecheck clean; **1292 unit tests passed** in 96 files (new: `InfoPages` 44, `SkipLink`, `PageMetadata`, `RobotsSitemap`).
- Build: the five pages are static with **180 B of their own JavaScript** (106 kB first load, the shared part only); `robots.txt` and `sitemap.xml` build. Every other page keeps its earlier weight (`/find` 115 kB).
- Real browser, 320, 360, 768 and 1024 px: **30 of 30 passed** (each page: one `h1`, its title `Page | SwiftHealth Route`, a description, nothing sideways, text 16 px or more, links 48 px; the notice on Privacy and Terms; the skip link is the first Tab stop, 48 px, inside the screen, and Enter moves focus to `main`; `robots.txt`; `sitemap.xml`; staff pages `noindex`).
- Speed pass: no page added script weight; the info pages send none of their own. Lighthouse was not run (no new package, and the owner's earlier Lighthouse runs are in `LOG.md`); the first-load numbers above are the measure.
- Found on the way: three older guard tests named the old title, the old search title and "every link prefetches"; they now describe the template, the new search title and the in-page skip link.
- Not checked by me: a screen reader, a real phone.

## Tests per task
- Tasks 1 and 2 (`f2d9739`): `InfoPages` (one `h1`, no skipped heading level, titles, no script, no phone number or address, links 48 px, and each page's statements: About's mission words and the first city from the settings; How we verify's process; Privacy's statements; Terms' sentences of FR-13, FR-11, FR-26; Contact with and without an address).
- Task 3 (`63ea256`): `SkipLink`, `PageMetadata`, `RobotsSitemap`.
- Task 4: `info-pages.spec.ts`.

## Security and privacy checklist
- [x] No page makes up a legal claim, a contact address or a phone number (tests look for the words of a legal claim, for `@`, for numbers)
- [ ] **Every statement on Privacy matches the code: all but one do today.** "Deleted when the report is closed" becomes true when the reports queue of phase 11 is merged (until then nothing closes a report). Merge phase 11 before the site is used for real.
- [x] No outside link without `rel="noopener noreferrer"`; no script on the five pages
- [x] The staff pages are `noindex` and disallowed in `robots.txt`

## Merge checklist
- [x] Lint, typecheck, tests, build clean; numbers written above
- [ ] Both CIs green (checked after the pull request is opened)
- [x] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] **The owner read Privacy and Terms and decided who reviews them; the owner gave a contact address (or accepted the placeholder)**
- [ ] The pull request stays a draft until every box above is ticked.
