# Hide the emergency categories in the Filters sheet: validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-05, FR-15, FR-01 or NFR-10. Tick a box only after the test exists and passes.

## How to run

The host has no Node packages, so the commands run in the frontend container:
- Lint: `docker compose exec frontend npm run lint`
- Types: `docker compose exec frontend npm run typecheck`
- Tests: `docker compose exec frontend npm test`

## Tests per task

### Task 1: `tests/unit/FiltersDialog.test.tsx`
The `META` fixture has the 12 categories in production's order (Clinic, Pharmacy, Laboratory, Hospital, Maternity, then the seven
emergency ones).
Done in `846c879`. The tests were written first and failed without the change (6 of the dialog tests, and the new unit file
could not load its module). Test names are those in `FiltersDialog.test.tsx` ("FiltersDialog category list") and
`categoryChoices.test.ts` (the pure function: order, label, unknown categories, no duplicates, the input is not changed).
- [x] `lists only the everyday categories, after "Any category", and none of the seven emergency ones`
- [x] `orders the categories like the Find shortcuts, whatever order /meta gives`
- [x] `puts a new everyday category after the five, and keeps the /meta order among unknown ones`
- [x] `does not offer a new emergency category` (the filter is `is_emergency`, not a list of slugs)
- [x] `keeps an emergency category that is selected from a shared link, with its real name, selected` (`?category=ambulance`
  shows "Ambulance" selected)
- [x] `Apply keeps the emergency category from the link in the address` (`/search?category=ambulance`)
- [x] `drops the emergency category from the list once another category is applied and the sheet is opened again`
  (and `keeps the emergency category in the list while the visitor is only choosing inside the open sheet`)
- [x] `shows the slug when a selected category is not in /meta at all` (the old behaviour)
- [x] The existing tests of the sheet still pass (services, areas, Apply, Clear filters, the backdrop and the error with Retry).
  Whole frontend suite: 391 passed.

## Review-focus edge cases

- [x] **Only one place changed.** `git grep "meta.categories\|meta?.categories" frontend/src` finds only `FiltersDialog.tsx`
  (checked 2026-10-10).
- [x] **`GET /meta` untouched.** `git diff --stat origin/main -- backend` is empty (checked 2026-10-10).
- [x] **A shared link.** `/search?category=ambulance` still filters the results (nothing in `/search` changed) and the sheet
  does not say "Any category" (`keeps an emergency category that is selected from a shared link...`). Still to look at by hand, below.

## Security checklist

- [x] Category names are rendered as text only (they come from `GET /meta`; React escapes them); `git grep dangerouslySetInnerHTML
  frontend/src` finds nothing.
- [x] No new package, no secrets, no `.env` change (`git diff` shows no `package.json`, lock file or `.env`).

## Smoke test (owner, on the Netlify deploy preview)

- [ ] Open `/search`, tap **Filters**: the category list shows Any category, Hospital, Clinic, Pharmacy, Maternity, Laboratory,
  and no emergency category.
- [ ] Open `/search?category=ambulance`: the results are filtered, and the sheet shows **Ambulance** selected.
- [ ] Choose **Pharmacy**, Apply, open the sheet again: Ambulance is gone from the list.
- [ ] The Find page shortcuts still go to `/search?category=...` and the sheet shows that category selected.

## Merge checklist

- [x] `npm run lint`, `npm run typecheck` and `npm test` are clean (2026-10-10, on `846c879`: 391 tests pass; `tsc --noEmit` and
  ESLint report nothing). Docker Desktop was not running, so they were run on the host after `npm ci --ignore-scripts`; the
  Frontend CI run on the pull request repeats them on Node 24 in GitHub.
- [x] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run. What `gh pr checks 16` showed
  (2026-10-10, after `18eadbb`): `frontend` **pass** (1m23s, run 38072766930); the only workflow run on the branch is Frontend
  CI (no Backend CI run); Netlify `deploy-preview` pass (<https://deploy-preview-16--swifthealth-ng.netlify.app>). The PR is
  clean and mergeable.
- [ ] The UI spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The pull request stays a draft until every box above is ticked.
