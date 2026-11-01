# Requirements: The position in the body for blood and emergency

Branch `feature/blood-emergency-position-in-body`. Status: **built (2026-11-01); draft pull request.** The owner's answer of 2026-11-01, after
pull request #85 (maps and "Find care near me") had done it for search: *"Move lat/lng out of the query string for GET /blood and GET /emergency
too (POST body, memory only), like search."*

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| US-04 | Reach emergency contacts fast, nearest first when I share where I am | Must |
| US-15 | Find blood banks near me | Must |
| US-16 | Find where to donate blood | Must |
| FR-14 | The emergency list, 112 first, with distances when there is a position | Must |
| FR-27, FR-28 | Blood banks and donation centres, nearest first | Must |
| NFR-07 | The visitor's location is never stored, logged, or sent in a URL | Must |
| NFR-03 | SwiftRescue and Find blood work offline from a saved copy | Must |

## What changes

- Three new routes, each the twin of its GET with the same fields, rules and answer, the position in a JSON body:
  `POST /blood/banks`, `POST /blood/donation-centres`, `POST /emergency`.
- A bad body is a 422 that names the field and the rule and **never repeats a value** (so the position is not echoed). The check is one
  shared function, `api/body_params.py`, which `POST /search` now uses too.
- The website sends a position **only** through these POSTs. The position is already kept in memory only (#85).
- **Without a position the website still calls the plain GET.** The first SwiftRescue request has none and is the one saved for offline use
  (decision A5 of `specs/2026-10-17-swiftrescue/`), and the service worker only keeps GETs without a query.
- The GETs still accept `lat` and `lng`, for other clients, as `GET /search` does.

## Not changed

- The service worker (`public/sw.js`): a POST is never kept, a GET without a query is kept as before.
- No new table, column, package or setting.
