# Validation: Maps and "Find care near me"

Spec: [requirements.md](requirements.md). Plan: [plan.md](plan.md). Boxes are ticked with the evidence at the end of the feature, after the owner
has looked at the preview. Check this file before saying the feature is done.

## Build results

(filled in with the real numbers from the final runs, see the pull request)

## Checks

- [ ] A listing page shows a red pin at exactly the listing's latitude and longitude (unit test with the map mocked; the line "Pin at …" shows the same numbers).
- [ ] The pin is red (`#b3261e`) in Light and Dark, has a white dot, and is **not a cross or a plus**.
- [ ] Directions open `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` with no address text.
- [ ] "Find care near me" asks the browser for the position only after a tap, and not when the page opens.
- [ ] After the visitor allows it, `/search?category=<type>&view=map` shows pins and, under them, the list; the list is nearest first.
- [ ] Each pin opens its listing.
- [ ] If the visitor refuses, the message and the area list appear; choosing an area opens that area's list for the same type.
- [ ] The position is not in any address, cookie, `localStorage`, `sessionStorage`, log, or tracking; the search carries it in the body of a POST.
- [ ] A reload forgets the position.
- [ ] `POST /search` gives the same answer as `GET /search`, and a bad body gives a 422 that does not echo the position.
- [ ] Text is 16 px or more, targets 48 px or more, nothing runs past the screen at 320 px (real browser).
- [ ] Pins and text are readable in Light and Dark (the owner looks at the preview).
- [ ] The listing page's own JavaScript did not grow by the map (the map is loaded by `next/dynamic`).
- [ ] Backend tests and `ruff check .` pass; frontend `lint`, `typecheck` and `npm test` pass.

## Open for the owner

- The blood-bank and emergency endpoints still take `lat` and `lng` in the query string.
