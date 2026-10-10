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
- [ ] `lists only the everyday categories, after "Any category", and none of the seven emergency ones`
- [ ] `orders the categories like the Find shortcuts, whatever order /meta gives`
- [ ] `puts a new everyday category after the five, and keeps the /meta order among unknown ones`
- [ ] `does not offer a new emergency category` (the filter is `is_emergency`, not a list of slugs)
- [ ] `keeps an emergency category that is selected from a shared link, with its real name, selected` (`?category=ambulance`
  shows "Ambulance" selected)
- [ ] `Apply keeps the emergency category from the link in the address` (`/search?category=ambulance`)
- [ ] `the emergency category from a link leaves the list once another category is applied and the sheet is opened again`
  (and `stays while the visitor is only choosing inside the open sheet`)
- [ ] `shows the slug when a selected category is not in /meta at all` (the old behaviour)
- [ ] The existing tests of the sheet still pass (services, areas, Apply, Clear filters, the backdrop and the error with Retry).

## Review-focus edge cases

- [ ] **Only one place changed.** `git grep "meta.categories\|meta?.categories" frontend/src` finds only `FiltersDialog.tsx`.
- [ ] **`GET /meta` untouched.** `git diff --stat origin/main` shows nothing under `backend/`.
- [ ] **A shared link.** `/search?category=ambulance` still filters the results and the sheet does not say "Any category".

## Security checklist

- [ ] Category names are rendered as text only (they come from `GET /meta`; React escapes them); no `dangerouslySetInnerHTML`.
- [ ] No new package, no secrets, no `.env` change.

## Smoke test (owner, on the Netlify deploy preview)

- [ ] Open `/search`, tap **Filters**: the category list shows Any category, Hospital, Clinic, Pharmacy, Maternity, Laboratory,
  and no emergency category.
- [ ] Open `/search?category=ambulance`: the results are filtered, and the sheet shows **Ambulance** selected.
- [ ] Choose **Pharmacy**, Apply, open the sheet again: Ambulance is gone from the list.
- [ ] The Find page shortcuts still go to `/search?category=...` and the sheet shows that category selected.

## Merge checklist

- [ ] `npm run lint`, `npm run typecheck` and `npm test` are clean.
- [ ] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run. Write what `gh pr checks` showed
  here: _not checked yet_.
- [ ] The UI spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The pull request stays a draft until every box above is ticked.
