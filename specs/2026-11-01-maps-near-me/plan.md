# Plan: Maps and "Find care near me"

Spec: [requirements.md](requirements.md). Validation: [validation.md](validation.md). Branch `feature/maps-near-me`. Every task was tests first.

## Backend

- `POST /search` (`api/routes/search.py`): the same filters as `GET /search`, in a JSON body, with `lat`, `lng` and `radius_km` allowed there.
  The body is checked with `SearchParams.model_validate`; a bad body gives a 422 that names the field and **never echoes a value** (so the
  position is not copied into an error). Same service call as `GET /search`, so the answer is identical.
- `specs/backend/api-spec.md`: the `POST /search` paragraph.
- Tests: `backend/tests/integration/test_search_post.py` (13): nearest first with distance, same answer as GET, filters and the `q` alias in the
  body, works without a position, bad bodies give 422, the position is in no URL, log or response, a 422 does not echo it.

## Frontend

- `lib/api/search.ts`: with a position, `searchListings` sends a POST with the body; without one, the GET as before.
- `lib/location/locationStore.ts`: the position is a module variable (3 decimals, out-of-range ignored, copies returned); the old
  `sessionStorage` key is deleted at load. The chosen area and the refusal stay in `sessionStorage`.
- `lib/map/mapIcons.ts` and `styles/map.css`: `createFacilityPinIcon()`, a red teardrop with a white dot (no plus, no cross).
- `components/map/FacilityMap.tsx` (new): the small map with the red pin and the coordinates line; invalid coordinates give a short note.
- `components/listing/ListingDetailView.tsx`: a "Map" section after the address; the map is loaded by `next/dynamic`.
- `components/search/SearchResults.tsx`: the map view shows the map and then the list.
- `components/search/FindNearMe.tsx` (new) and `app/(public)/find/page.tsx`: the section on the Find page.
- Tests: `FacilityMap.test.tsx`, `FindNearMe.test.tsx` (new); `ListingPage`, `SearchMapView`, `SearchPage`, `search`, `locationStore` updated;
  `tests/helpers/api.ts` records POST searches; `tests/setup.ts` clears the position after each test; Playwright `find-by-type.spec.ts`: the
  position goes in a POST body and not in any address or storage.

## Specs

- `specs/frontend/ui-spec.md`: the position in memory, `POST /search`, section 2.2 item 5a, the map view with a list, the red pin exception,
  section 2.4 item 5a.
- `LOG.md`: decision rows.

## Tasks

- [ ] 1. `POST /search` and its tests
- [ ] 2. Position in memory; `searchListings` posts; tests and helper
- [ ] 3. Red facility pin icon, `FacilityMap`, the listing "Map" section
- [ ] 4. Map view shows map and list
- [ ] 5. `FindNearMe` on the Find page
- [ ] 6. Specs, LOG, validation run
