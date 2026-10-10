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

### Task 1: `HoursNote.test.tsx`, `ListingCard.test.tsx`, `icons-in-components.test.tsx`, `NearbySuggestions.test.tsx`, `SearchPage.test.tsx`
- [ ] `HoursNote shows the text with a Clock icon beside it`
- [ ] `HoursNote hides the icon from screen readers` (the text is the only thing read)
- [ ] `HoursNote shows nothing for null, an empty text and spaces only` (no icon either)
- [ ] `HoursNote renders the text as text, never as HTML`
- [ ] `HoursNote uses 16 px text and token colours` (`text-base`, `text-ink-soft`; no hex)
- [ ] `ListingCard shows the hours line under the address, before the Call and Directions buttons`
- [ ] `ListingCard shows no hours line, and no extra icon, when hours_note is null` (a 24-hour listing)
- [ ] `ListingCard still shows Verification due, the date and the Call button next to the hours line` (an overdue listing)
- [ ] `every icon in a card is hidden from screen readers and sits next to text` (the existing test, now with the hours line)
- [ ] `the near-you cards show hours_note`
- [ ] `the results list shows hours_note on each card`
- [ ] The existing tests of the card and the pages still pass (fixtures gained `hours_note`).

## Review-focus edge cases

- [ ] **A long note at 320 px.** "Closes 12:30 AM tomorrow" and "Opens Wednesday at midnight" wrap inside the card; no sideways
  scrolling (the text is in a normal block that wraps).
- [ ] **No gap.** A card without a note looks exactly as before (no empty row, no margin left behind).
- [ ] **Only the card changed.** `git diff --stat origin/main` shows nothing under `backend/`, no package or lock file change.

## Security checklist

- [ ] The note is rendered as text only (React escapes it); `git grep dangerouslySetInnerHTML frontend/src` finds nothing.
- [ ] The card does not build links, addresses or code from the note.
- [ ] No new package, no secrets, no `.env` change.

## After the deploy (owner, live site)

- [ ] `/find`: the near-you cards show a line such as "Closes 2:00 AM tomorrow" or "Opens 8:00 AM tomorrow" under the address.
- [ ] `/search`: each card of an open or closed listing shows its line; the 24-hour listing ("Always Open Pharmacy") shows no line.
- [ ] At 320 px (DevTools) the line wraps and nothing scrolls sideways.

## Merge checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` are clean.
- [ ] On the draft pull request `Frontend CI` runs and is green, and `Backend CI` does not run. Write what `gh pr checks` showed
  here: _not checked yet_.
- [ ] The UI spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The pull request stays a draft until every box above is ticked.
