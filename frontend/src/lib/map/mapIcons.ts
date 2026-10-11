/** The pin and the position dot of the results map. Requirements: FR-07, NFR-10. UI spec 2.3, "Map view".
 * Both are drawn in code (a Leaflet `divIcon`), with no image file. The colours are in src/styles/map.css and come from the
 * design tokens: the pin is forest blue with a white plus, the visitor's position is a dark dot. Never red.
 * The HTML here is fixed text: nothing from the API is ever put in it.
 */
import L from "leaflet";

const PIN_BOX = 48; // the marker is 48 px wide and high, the size of a tap target (NFR-10)

// A teardrop 36 × 46 with a plus inside. The classes are styled in map.css.
const PIN_HTML =
  '<svg class="map-pin__shape" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 46" width="36" height="46" aria-hidden="true" focusable="false">' +
  '<path class="map-pin__body" d="M18 45C10 35 2 26 2 17a16 16 0 0 1 32 0c0 9-8 18-16 28z"/>' +
  '<path class="map-pin__plus" d="M16 9h4v6h6v4h-6v6h-4v-6h-6v-4h6z"/>' +
  "</svg>";

/** The pin of one result. Its tip is at the bottom centre of the 48 px box, on the place. */
export function createPinIcon(): L.DivIcon {
  return L.divIcon({
    html: PIN_HTML,
    className: "map-pin",
    iconSize: [PIN_BOX, PIN_BOX],
    iconAnchor: [PIN_BOX / 2, PIN_BOX],
    popupAnchor: [0, -(PIN_BOX - 4)],
  });
}

/** The visitor's own position: a round dot, a different shape from the pins. It says nothing to screen readers; the line
 * "Your position" under the map does.
 */
export function createPositionIcon(): L.DivIcon {
  return L.divIcon({
    html: '<span class="map-position-dot" aria-hidden="true"></span>',
    className: "map-position",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
