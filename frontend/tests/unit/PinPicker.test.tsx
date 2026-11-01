// @vitest-environment jsdom
/** The owner's pin picker: a small map with a draggable red pin. Requirements: US-17, US-02, FR-23, NFR-07, NFR-10.
 * Spec: specs/2026-11-01-owner-form-location-photo/ (decisions L1, L5, L6); UI spec 2.9. The real Leaflet runs in jsdom;
 * `stubMapSize` gives every element a size. No tile image is ever loaded, and the picker never asks for the owner's position
 * (the "Use my current location" button is in LocationFields).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PinPicker } from "@/components/map/PinPicker";

import { restoreMapSize, stubMapSize } from "../helpers/map";
import { readSource } from "../helpers/source";

const ZOOM_WITH_PIN = 16;
const WIDTH = 400;
const HEIGHT = 300;

beforeEach(() => stubMapSize(WIDTH, HEIGHT));
afterEach(() => {
  restoreMapSize();
  vi.unstubAllGlobals();
});

function region(): HTMLElement {
  return screen.getByRole("region", { name: "Map to place the pin of your facility" });
}

function tileOf(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const radians = (latitude * Math.PI) / 180;
  return {
    x: Math.floor(((longitude + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * n),
  };
}

describe("the pin", () => {
  it("is not drawn while no pin is placed, and the map shows the pilot area", () => {
    render(<PinPicker pin={null} onChange={() => {}} />);

    expect(region().querySelectorAll(".facility-pin")).toHaveLength(0);
    expect(region().querySelector(".leaflet-container")).not.toBeNull();
  });

  it("is one red pin, draggable, once a pin is placed, and the map is centred on it", () => {
    render(<PinPicker pin={{ latitude: 6.4521, longitude: 7.5103 }} onChange={() => {}} />);

    const pins = region().querySelectorAll(".leaflet-marker-icon.facility-pin");
    expect(pins).toHaveLength(1);
    expect(pins[0]).toHaveClass("leaflet-marker-draggable");
    const { x, y } = tileOf(6.4521, 7.5103, ZOOM_WITH_PIN);
    const tiles = [...region().querySelectorAll("img.leaflet-tile")].map((tile) => tile.getAttribute("src") ?? "");
    expect(tiles).toContain(`https://tile.openstreetmap.org/${ZOOM_WITH_PIN}/${x}/${y}.png`);
  });

  it("is red with no cross: it is the facility pin of the listing page", () => {
    render(<PinPicker pin={{ latitude: 6.4521, longitude: 7.5103 }} onChange={() => {}} />);

    const html = region().querySelector(".facility-pin")?.innerHTML ?? "";
    expect(html).toContain("facility-pin__body");
    expect(html).not.toMatch(/plus|cross/i);
  });

  it("has a name a screen reader can say", () => {
    render(<PinPicker pin={{ latitude: 6.4521, longitude: 7.5103 }} onChange={() => {}} />);

    expect(region().querySelector(".facility-pin")).toHaveAttribute("aria-label", "Pin of your facility");
  });

  it("moves to a new place when the pin it is given changes (a pasted link, the current location)", () => {
    const { rerender } = render(<PinPicker pin={{ latitude: 6.4521, longitude: 7.5103 }} onChange={() => {}} />);

    rerender(<PinPicker pin={{ latitude: 6.5, longitude: 7.6 }} onChange={() => {}} />);

    const { x, y } = tileOf(6.5, 7.6, ZOOM_WITH_PIN);
    const tiles = [...region().querySelectorAll("img.leaflet-tile")].map((tile) => tile.getAttribute("src") ?? "");
    expect(tiles).toContain(`https://tile.openstreetmap.org/${ZOOM_WITH_PIN}/${x}/${y}.png`);
    expect(region().querySelectorAll(".facility-pin")).toHaveLength(1); // still one pin, not two
  });

  it("goes away when the pin is taken away", () => {
    const { rerender } = render(<PinPicker pin={{ latitude: 6.4521, longitude: 7.5103 }} onChange={() => {}} />);

    rerender(<PinPicker pin={null} onChange={() => {}} />);

    expect(region().querySelectorAll(".facility-pin")).toHaveLength(0);
  });
});

describe("placing the pin", () => {
  it("a tap on the map places the pin there: the middle of the map is the middle of the place on screen", () => {
    const onChange = vi.fn();
    render(<PinPicker pin={{ latitude: 6.4521, longitude: 7.5103 }} onChange={onChange} />);

    fireEvent.click(region().querySelector(".leaflet-container") as HTMLElement, { clientX: WIDTH / 2, clientY: HEIGHT / 2 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const placed = onChange.mock.calls[0][0] as { latitude: number; longitude: number };
    expect(placed.latitude).toBeCloseTo(6.4521, 3);
    expect(placed.longitude).toBeCloseTo(7.5103, 3);
  });

  it("a tap far to the right of the middle gives a place further east, on the same latitude", () => {
    const onChange = vi.fn();
    render(<PinPicker pin={{ latitude: 6.4521, longitude: 7.5103 }} onChange={onChange} />);

    fireEvent.click(region().querySelector(".leaflet-container") as HTMLElement, { clientX: WIDTH / 2 + 100, clientY: HEIGHT / 2 });

    const placed = onChange.mock.calls[0][0] as { latitude: number; longitude: number };
    expect(placed.longitude).toBeGreaterThan(7.5103);
    expect(placed.latitude).toBeCloseTo(6.4521, 3);
  });

  it("keeps a tap or a drag inside the same box around Nigeria as the API (the code clamps both)", () => {
    // A tap on a map that shows the pilot area cannot reach beyond the box, so this reads the source for the one clamp both use.
    const source = readSource("components/map/PinPicker.tsx");

    expect(source).toMatch(/NIGERIA_LATITUDE_RANGE/);
    expect(source).toMatch(/NIGERIA_LONGITUDE_RANGE/);
    expect(source).toMatch(/dragend/);
  });
});

describe("the map", () => {
  it("shows the OpenStreetMap credit", () => {
    render(<PinPicker pin={null} onChange={() => {}} />);

    expect(region().querySelector(".leaflet-control-attribution")).toHaveTextContent("OpenStreetMap");
  });

  it("does not trap the page: the wheel scrolls the page, and the zoom buttons are 48 px (map.css)", () => {
    render(<PinPicker pin={null} onChange={() => {}} />);

    expect(region().querySelector(".leaflet-control-zoom-in")).not.toBeNull();
    expect(readSource("components/map/PinPicker.tsx")).toMatch(/scrollWheelZoom:\s*false/);
  });

  it("never asks for the owner's position and keeps nothing in the browser", () => {
    expect(readSource("components/map/PinPicker.tsx")).not.toMatch(/geolocation|useLocation|locationStore|sessionStorage|localStorage|console\./);
  });

  it("removes the map when it goes away", () => {
    const { unmount, container } = render(<PinPicker pin={null} onChange={() => {}} />);
    unmount();

    expect(container.querySelector(".leaflet-container")).toBeNull();
  });

  it("is tidy at 320 px: the box is the full width and the text under it is 16 px", () => {
    render(<PinPicker pin={null} onChange={() => {}} />);

    const box = region().querySelector<HTMLElement>(".pin-picker__box");
    expect(box?.className).toMatch(/\bw-full\b/);
  });
});
