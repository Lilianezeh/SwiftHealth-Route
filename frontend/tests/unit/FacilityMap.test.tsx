// @vitest-environment jsdom
/** The small map of the listing page, with the real Leaflet running in jsdom. Requirements: FR-07, FR-10, NFR-07, NFR-10.
 * Spec: specs/2026-11-01-maps-near-me/. One red pin exactly at the facility's coordinates; no cross; the page can still be used
 * without it (a text line gives the same place). jsdom has no layout, so `stubMapSize` gives every element a size.
 * Real tile images are never loaded, so no test touches the network.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FacilityMap } from "@/components/map/FacilityMap";
import { createFacilityPinIcon } from "@/lib/map/mapIcons";

import { readSource } from "../helpers/source";
import { restoreMapSize, stubMapSize } from "../helpers/map";

const LATITUDE = 6.452;
const LONGITUDE = 7.51;
const ZOOM = 16;

beforeEach(() => stubMapSize());
afterEach(() => {
  restoreMapSize();
  vi.unstubAllGlobals();
});

function region(): HTMLElement {
  return screen.getByRole("region", { name: "Map showing where Night Pharmacy A is" });
}

/** The OpenStreetMap tile that holds a point at a zoom (the "slippy map" formula). */
function tileOf(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const radians = (latitude * Math.PI) / 180;
  return {
    x: Math.floor(((longitude + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * n),
  };
}

describe("the pin", () => {
  it("is one pin, in the map of the place, with the place's name", () => {
    render(<FacilityMap name="Night Pharmacy A" latitude={LATITUDE} longitude={LONGITUDE} />);

    const pins = region().querySelectorAll(".leaflet-marker-icon.facility-pin");
    expect(pins).toHaveLength(1);
    expect(pins[0]).toHaveAttribute("aria-label", "Night Pharmacy A");
  });

  it("is exactly at the coordinates: the map is centred there and the tile that holds the point is the one it loads", () => {
    render(<FacilityMap name="Night Pharmacy A" latitude={LATITUDE} longitude={LONGITUDE} />);

    const { x, y } = tileOf(LATITUDE, LONGITUDE, ZOOM);
    const tiles = [...region().querySelectorAll("img.leaflet-tile")].map((tile) => tile.getAttribute("src") ?? "");
    expect(tiles).toContain(`https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`);
  });

  it("says the same place in words, with the coordinates, under the map", () => {
    render(<FacilityMap name="Night Pharmacy A" latitude={LATITUDE} longitude={LONGITUDE} />);

    expect(region()).toHaveTextContent("Pin at 6.45200, 7.51000");
  });

  it("is red, drawn in code, and has no cross, no plus and no image file", () => {
    const html = String(createFacilityPinIcon().options.html);

    expect(html).toContain("facility-pin__body");
    expect(html).not.toMatch(/plus|cross|<img|\.png|\.svg/i);
    expect(html).not.toMatch(/M16 9h4v6/); // the plus of the blue result pins
    const css = readSource("styles/map.css");
    expect(css).toMatch(/\.facility-pin__body\s*{[^}]*fill:\s*#b3261e/); // the same red as the SwiftRescue button, fixed in both modes
  });

  it("is a target of 48 px", () => {
    const icon = createFacilityPinIcon();

    expect(icon.options.iconSize).toEqual([48, 48]);
    expect(icon.options.iconAnchor).toEqual([24, 48]); // the tip of the pin is at the bottom centre, on the place
  });
});

describe("the map", () => {
  it("shows the OpenStreetMap credit, and keeps the visitor's position nowhere (it never asks for it)", () => {
    render(<FacilityMap name="Night Pharmacy A" latitude={LATITUDE} longitude={LONGITUDE} />);

    expect(region().querySelector(".leaflet-control-attribution")).toHaveTextContent("OpenStreetMap");
    expect(readSource("components/map/FacilityMap.tsx")).not.toMatch(/geolocation|useLocation|locationStore|sessionStorage|localStorage/);
  });

  it("does not trap a phone's scrolling: one finger moves the page; the zoom buttons zoom", () => {
    render(<FacilityMap name="Night Pharmacy A" latitude={LATITUDE} longitude={LONGITUDE} />);

    expect(region().querySelector(".leaflet-control-zoom-in")).not.toBeNull();
    expect(readSource("components/map/FacilityMap.tsx")).toMatch(/scrollWheelZoom:\s*false/);
  });

  it("is tidy at 320 px: the box never sets a width and is at least 16 px text", () => {
    render(<FacilityMap name="Night Pharmacy A" latitude={LATITUDE} longitude={LONGITUDE} />);

    const box = region().querySelector<HTMLElement>(".facility-map__box");
    expect(box?.className).toMatch(/\bw-full\b/);
    expect(region().querySelector("p")?.className).toMatch(/text-base/);
  });

  it.each([
    ["not a number", Number.NaN, LONGITUDE],
    ["out of range", 91, LONGITUDE],
    ["out of range", LATITUDE, 181],
    ["infinite", LATITUDE, Number.POSITIVE_INFINITY],
  ])("draws no map and no pin for a position that is %s", (_name, latitude, longitude) => {
    const { container } = render(<FacilityMap name="Night Pharmacy A" latitude={latitude} longitude={longitude} />);

    expect(container.querySelector(".leaflet-container")).toBeNull();
    expect(container.querySelector(".facility-pin")).toBeNull();
    expect(screen.getByText("The map is not available for this place.")).toBeInTheDocument();
  });

  it("gives a name with HTML in it as plain text", () => {
    render(<FacilityMap name="<b>Bold</b> & Sons" latitude={LATITUDE} longitude={LONGITUDE} />);

    const map = screen.getByRole("region", { name: "Map showing where <b>Bold</b> & Sons is" });
    expect(map.querySelector("b")).toBeNull();
  });

  it("removes the map when it goes away (no second map is left behind)", () => {
    const { unmount, container } = render(<FacilityMap name="Night Pharmacy A" latitude={LATITUDE} longitude={LONGITUDE} />);
    unmount();

    expect(container.querySelector(".leaflet-container")).toBeNull();
  });
});
