/** Tests for the map constants (config/map.ts). Requirements: FR-07, NFR-07, NFR-10. Decision 8 in
 * specs/2026-10-11-map-view/requirements.md: the tile address and the OpenStreetMap credit are written in one place.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAP_CENTRE,
  DEFAULT_MAP_ZOOM,
  MAP_ATTRIBUTION,
  MAP_MAX_ZOOM,
  OPENSTREETMAP_COPYRIGHT_URL,
  SINGLE_PIN_ZOOM,
  TILE_URL,
} from "@/config/map";

describe("the tile address", () => {
  it("is the https OpenStreetMap tile server", () => {
    expect(TILE_URL).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  });

  it("holds only the {z}, {x} and {y} of a tile: no position, no key, no query", () => {
    const placeholders = TILE_URL.match(/\{[^}]*\}/g);

    expect(placeholders).toEqual(["{z}", "{x}", "{y}"]);
    expect(TILE_URL).not.toContain("?");
    expect(TILE_URL.toLowerCase()).not.toMatch(/lat|lng|lon/);
  });
});

describe("the credit", () => {
  it("names OpenStreetMap contributors and links to the OpenStreetMap copyright page", () => {
    expect(OPENSTREETMAP_COPYRIGHT_URL).toBe("https://www.openstreetmap.org/copyright");
    expect(MAP_ATTRIBUTION).toContain("©");
    expect(MAP_ATTRIBUTION).toContain("OpenStreetMap");
    expect(MAP_ATTRIBUTION).toContain("contributors");
    expect(MAP_ATTRIBUTION).toContain(`href="${OPENSTREETMAP_COPYRIGHT_URL}"`);
  });

  it("opens the link safely, as every outside link of the site does", () => {
    expect(MAP_ATTRIBUTION).toContain('rel="noopener noreferrer"');
  });
});

describe("the default view and the zoom limits", () => {
  it("has a real default centre", () => {
    expect(Math.abs(DEFAULT_MAP_CENTRE.latitude)).toBeLessThanOrEqual(90);
    expect(Math.abs(DEFAULT_MAP_CENTRE.longitude)).toBeLessThanOrEqual(180);
  });

  it("keeps the zooms in the range the OpenStreetMap tiles have (0 to 19), the single-pin zoom closer than the default", () => {
    expect(DEFAULT_MAP_ZOOM).toBeGreaterThanOrEqual(0);
    expect(SINGLE_PIN_ZOOM).toBeGreaterThan(DEFAULT_MAP_ZOOM);
    expect(SINGLE_PIN_ZOOM).toBeLessThanOrEqual(MAP_MAX_ZOOM);
    expect(MAP_MAX_ZOOM).toBeLessThanOrEqual(19);
  });
});
