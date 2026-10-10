# Show hours_note on the cards: validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-06, US-01 or NFR-10. Tick a box only after the test exists and passes.

## How to run

The commands run in the frontend container:
- Lint: `docker compose exec frontend npm run lint`
- Types: `docker compose exec frontend npm run typecheck`
- Tests: `docker compose exec frontend npm test`
- Build and page weight: `docker compose exec frontend npm run build` (then `rm -rf .next` in the container and restart it)

## Tests per task

### Task 1: `HoursNote.test.tsx`, `ListingCard.test.tsx`, `icons-in-components.test.tsx`, `NearbySuggestions.test.tsx`, `SearchPage.test.tsx` (done, `5ef2e6b`)
They failed first (8 tests, and `HoursNote` could not be imported) and pass; 16 new tests, 407 in total.
- [x] `HoursNote shows the text of the API with a Clock icon beside it`
- [x] `HoursNote hides the icon from screen readers, so only the text is read`
- [x] `HoursNote shows nothing at all for null, "" and "   "` (no text, no icon, no empty row)
- [x] `HoursNote renders the text as text, never as HTML`
- [x] `HoursNote uses 16 px text and token colours, with no hand-written colour`; and `lets a long text wrap instead of scrolling sideways`
- [x] `ListingCard shows the hours line under the address, before the Call and Directions buttons` (and `shows the text the API gives,
  word for word`)
- [x] `ListingCard shows no hours line and no extra icon when hours_note is null (a 24-hour listing)`
- [x] `ListingCard still shows Verification due, the date and the Call button next to the hours line`, and `has two different clocks
  that mean different things: the amber label and the grey hours line`
- [x] `icons in the listing components: the hours line has a clock beside the text of the API, and its icon is decorative`; the
  existing `every icon in a card is hidden from screen readers and sits next to text` still passes
- [x] `NearbySuggestions shows the hours_note of each near-you card, and nothing for a 24-hour place`
- [x] `the /search page shows hours_note on each result card`
- [x] The existing tests of the card and the pages still pass (the fixtures gained `hours_note`).

## Review-focus edge cases

- [ ] **A long note at 320 px.** "Closes 12:30 AM tomorrow" and "Opens Wednesday at midnight" wrap inside the card; no sideways
  scrolling. (The test checks that the line is a normal wrapping block; still to look at in DevTools, below.)
- [x] **No gap.** A card without a note renders nothing for it (`HoursNote shows nothing at all...`: the component's output is
  empty, so there is no row, no margin and no icon).
- [x] **Only the card changed.** `git diff --stat origin/main -- backend` is empty and no package or lock file changed
  (checked 2026-10-10).

## Security checklist

- [x] The note is rendered as text only (React escapes it); `git grep dangerouslySetInnerHTML frontend/src` finds nothing.
- [x] The card does not build links, addresses or code from the note (`HoursNote` only shows it).
- [x] No new package, no secrets, no `.env` change.

## After the deploy (owner, live site)

- [ ] `/find`: the near-you cards show a line such as "Closes 2:00 AM tomorrow" or "Opens 8:00 AM tomorrow" under the address.
- [ ] `/search`: each card of an open or closed listing shows its line; the 24-hour listing ("Always Open Pharmacy") shows no line.
- [ ] At 320 px (DevTools) the line wraps and nothing scrolls sideways.

## Merge checklist

- [x] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` are clean (2026-10-10, on `5ef2e6b`: 407 tests pass; the
  build gives `/find` 114 kB and `/search` 116 kB first load, 115 kB before).
- [x] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run. What `gh pr checks 18` showed
  (2026-10-10, after `cddd9fc`): `frontend` **pass** (1m22s, run 38082362177); the only workflow run on the branch is Frontend
  CI (no Backend CI run); Netlify `deploy-preview` pass (<https://deploy-preview-18--swifthealth-ng.netlify.app>). The PR is
  clean and mergeable.
- [x] The UI spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date (Task 0; the status lines are set to done after the merge).
- [ ] The pull request stays a draft until every box above is ticked.
