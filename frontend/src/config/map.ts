/** Constants for the results map. Requirements: FR-07, NFR-07, NFR-10. UI spec 2.3, "Map view".
 * The tile address and the credit are written here and nowhere else, so changing the tile provider (a `LOG.md` reminder
 * before launch) is a change in this file.
 */

// The public OpenStreetMap tile server. A tile address holds only {z}, {x} and {y}: an area of the map, never a visitor's position.
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const OPENSTREETMAP_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

// Leaflet's attribution control takes HTML. This string is fixed: no text from the API is ever put in it.
export const MAP_ATTRIBUTION = `© <a href="${OPENSTREETMAP_COPYRIGHT_URL}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors`;

// Used only when no result has a position, so the map still opens somewhere sensible: the pilot area, at the Holy Ghost
// Cathedral in Enugu city (owner's choice, 2026-10-11).
export const DEFAULT_MAP_CENTRE = { latitude: 6.4361, longitude: 7.4881 };
export const DEFAULT_MAP_ZOOM = 12;
export const SINGLE_PIN_ZOOM = 15; // one pin: close enough to see the streets around it
export const MAP_MAX_ZOOM = 19; // the closest zoom the OpenStreetMap tiles have
