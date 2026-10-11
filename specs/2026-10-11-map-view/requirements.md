# Map view on the results page (Phase 5B-2): requirements

What this frontend feature must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it is
done is in [validation.md](validation.md).

## Requirements

- **FR-07** ([prd.md](../prd.md)): results can switch between list view and map view. This is the only requirement of the
  phase.
- **US-01** and **US-03**: a resident who wants to see where the open places are, and get directions to one, can do it from the
  map too (each popup has Call and Directions).
- **NFR-10:** tap targets of 48 px, 16 px text, no sideways scrolling at 320 px, works with a keyboard and screen readers.
- **NFR-01 and NFR-04:** the list view must not get heavier, and the map works on a cheap Android phone on 3G.
- **NFR-07:** the visitor's position, and what part of the map they look at, are not put in the address or stored.

Source of truth: [ui-spec.md](../frontend/ui-spec.md) (2.3, "Map view", and the `ResultsMap`, `MapPopup` and `ViewToggle` rows),
[api-spec.md](../backend/api-spec.md) (`ListingSummary` already has `latitude` and `longitude`), [prd.md](../prd.md). Branch:
`feature/map-view`. Every commit and test references these IDs.

Fit with the project: [mission.md](../mission.md) wants a resident to find open care quickly, and a map answers "which one is
near me" at a glance. [tech-stack.md](../tech-stack.md) already names Leaflet with OpenStreetMap, so the stack does not change.
No backend change, no new table.

## In scope

- `view=map` in the address, and a `List | Map` toggle (`ViewToggle`) on `/search`.
- `ResultsMap`: plain Leaflet, OpenStreetMap tiles with the credit, a blue pin per result, a dot for the visitor's position.
- `MapPopup`: name, category and distance, `OpenNowBadge`, Call and Directions.
- Keyboard and screen reader support for the pins, popups and the toggle.
- Exact pins for `leaflet` and `@types/leaflet`, and removing `react-leaflet` (see decision 1).
- `LOG.md` reminders: "Search this area", the tile provider review, and map tiles on the Privacy page.

## Out of scope (planned elsewhere)

- **"Search this area"** (search again for the part of the map on screen): not now. It would need the map centre and a
  search by area of the map, which the API does not have. A `LOG.md` idea.
- **Reviewing the tile provider** and **the Privacy page text about map tiles**: before launch, `LOG.md` reminders. The Privacy
  page is still "Coming soon" ([NFR-07](../prd.md) is its requirement).
- **Clustering pins.** A page has 20 results at a time, so it is not needed yet.
- **A map on the listing page** (phase 6) and **on SwiftRescue** (phase 7): their own phases.
- **Offline tiles.** Only the emergency page works offline (NFR-03, phase 7d).

## Decisions (owner, 2026-10-11)

1. **Plain Leaflet, exact versions, no `react-leaflet`.** The packages `leaflet`, `@types/leaflet` and `react-leaflet` were
   already in `package.json` from the project setup, with `^` ranges and no code using them. The owner approved Leaflet 1.x
   at the latest stable version, pinned exactly (`leaflet` 1.9.4 and `@types/leaflet` 1.9.22, the versions already in the lock
   file; `npm view leaflet` shows no newer 1.x release, only 2.0 alpha), and no `react-leaflet`. Reason: fewer packages, and
   `react-leaflet` v5 is another layer between the code and the Leaflet documentation that we would have to learn and trust.
   We call Leaflet directly inside one component, with `useEffect`. Leaflet 2.0 is not used: it is still an alpha.
2. **A custom blue pin drawn in code.** An inline SVG inside a Leaflet `divIcon`: no image files (Leaflet's default marker is
   an image, which has a known problem with bundlers and is another request on 3G). Colours come from the design tokens
   (`forest`, white); the pin is **never red**, because red is for emergency actions.
3. **The visitor's position is a dark dot, not a pin.** A different shape and a different colour, so the two cannot be mixed up,
   and a line of words under the map says what the dot is (colour never carries the meaning alone). It is not clickable.
4. **`?view=map`, nothing else about the map in the address.** The list is the default. The centre, zoom and position are never
   in the address, nor stored (NFR-07): a shared link opens a map fitted to the results of its filters, and the receiver gets
   no position. The toggle **adds a history entry**, so that Back from the map
   returns to the list (owner, 2026-10-11, changed from "replace"). Filters keep replacing the address, as before. Applying a
   filter while on the map replaces the map's entry, so Back still goes to the list.
5. **The list stays default and complete.** The map is an addition: switching never hides a result from the list, the list's
   markup does not change, and a result with no real position is still in the list (and the map says how many are missing).
6. **The same loaded results, no second request.** The map draws what `useSearchResults` already holds, so "Load more" adds
   pins and the toggle never calls the API again.
7. **Leaflet loads only when the map is shown** (dynamic import, no server rendering). Leaflet needs the browser (`window`), and
   the list view keeps its first-load weight (about 115 kB, NFR-01).
8. **The OpenStreetMap credit is always visible**, in Leaflet's attribution control, linking to the OpenStreetMap copyright
   page. The public OpenStreetMap tile server has a usage policy; we use it for the pilot and review the provider before launch
   (`LOG.md`). We do not claim here what that policy allows.
9. **Popups hold Call and Directions**, made by the same `CallButton` and `DirectionsButton` as the cards, so the phone number
   and the link are checked in one place. The popup is built from React components, never from an HTML string, so a facility
   name cannot inject HTML. A sponsored result has the same pin, and its popup shows the "Sponsored" tag.
10. **Pins are keyboard reachable.** Leaflet markers are tab stops; Enter or Space opens the popup, focus moves into it, and Esc
    closes it and returns focus to the pin. The popup close button and the zoom buttons are enlarged to 48 px, and the
    attribution text to 16 px, with our own styles (Leaflet's defaults are smaller).
11. **The map refits when the results change** (new filters, "Load more"). Simple and predictable; a visitor who panned the map
    sees it fitted again after "Load more". Keeping their view was considered and left out for now.
