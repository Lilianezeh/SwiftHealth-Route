# Requirements: Maps and "Find care near me"

Branch `feature/maps-near-me`. Status: **built (2026-11-01); draft pull request.** Owner's request of 2026-11-01 (Part 2 of two parts; Part 1, the
facility owner form, follows as two separate pull requests). The owner's answers of the same day are listed under "Decisions".

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| US-01 | Find the nearest pharmacy, clinic or hospital to me, as pins on a map and a list sorted by distance | Must |
| US-02 | On a listing page, see exactly where the facility is | Must |
| FR-03 | The Find page: "Find care near me" by type | Must |
| FR-06 | Results sort by distance; each shows name, category, distance, status, Call and Directions | Must |
| FR-07 | A map of the results; each pin opens the listing | Must |
| FR-09 | The listing page shows the facility's location and Directions | Must |
| NFR-01 | Small and fast: the map code is loaded only when a map is shown | Must |
| NFR-04 | Works from 320 px; text 16 px or more; targets 48 px or more | Must |
| NFR-07 | Privacy: the visitor's location is never stored, logged, in a URL or in analytics | Must |
| NFR-10 | Readable in Light and Dark | Must |

## What the owner asked

1. Each listing page shows a **red pin exactly at the facility's coordinates**.
2. **Directions** open Google Maps with `destination=lat,lng`, not the address text (already true; now tested).
3. **Find care near me**: after the visitor allows the location (the browser's permission, asked only when they tap), show the nearest facilities of
   the chosen type as pins on a map and as a list sorted by distance; each pin opens the listing.
4. The visitor's location is **never stored, logged, sent to the API in the URL, or put in analytics**.
5. If the visitor refuses, ask them to choose an area.
6. **No red cross symbol.** Pins and text are readable in Light and Dark; text is 16 px or more; tidy at 320 px.

## Decisions (owner, 2026-11-01)

| ID | Decision |
| --- | --- |
| M1 | The **red pin** is used only on the listing page and (later) in the owner's pin picker. It is never a cross. The pins of the results map stay blue (with a white plus). The UI spec is updated. |
| M2 | The position goes to the API in the **body of a new `POST /search`**, and is kept **in memory only**; a reload forgets it. `GET /search` still accepts `lat` and `lng` for other clients (its address is not used by the site any more when there is a position). |
| M3 | In the map view of the results, the map is followed by the **list of cards** (nearest first when there is a position). |
| M4 | "Find care near me" is a section on the Find page: five type buttons; the location is asked after a tap and only if the tab has not been refused already. |

## Out of scope (flagged)

- The blood-bank and emergency endpoints still take `lat` and `lng` in the query string (`GET /blood`, `GET /emergency`). They are not part of
  "Find care near me"; changing them is a follow-up the owner may ask for.
- No new table, no new package, no new environment variable.
