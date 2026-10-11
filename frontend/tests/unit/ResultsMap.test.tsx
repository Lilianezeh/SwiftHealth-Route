// @vitest-environment jsdom
/** Tests for the results map, with the real Leaflet running in jsdom. Requirements: FR-07, US-01, US-03, NFR-07, NFR-10.
 * UI spec 2.3, "Map view". jsdom has no layout: `stubMapSize` gives every element a size so Leaflet can place the tiles.
 * Real tile images are never loaded (jsdom does not fetch images), so no test touches the network.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResultsMap } from "@/components/search/ResultsMap";

import { listing } from "../helpers/api";
import { restoreMapSize, stubMapSize } from "../helpers/map";

const FIRST = listing({ id: 1, slug: "night-pharmacy-a", name: "Night Pharmacy A", latitude: 6.452, longitude: 7.51 });
const SECOND = listing({
  id: 2,
  slug: "city-clinic",
  name: "City Clinic",
  category: { slug: "clinic", name: "Clinic" },
  latitude: 6.46,
  longitude: 7.52,
});
const NO_POSITION = listing({ id: 3, slug: "lost-place", name: "Lost Place", latitude: Number.NaN });
const VISITOR = { latitude: 6.45, longitude: 7.5 };

beforeEach(() => {
  stubMapSize();
  window.scrollTo = vi.fn(); // jsdom does not implement it, and the browser scrolls a focused popup into view
});
afterEach(() => {
  restoreMapSize();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mapRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Map of the search results" });
}

function pinCount(): number {
  return mapRegion().querySelectorAll(".leaflet-marker-icon.map-pin").length;
}

function tileAddresses(): string[] {
  return [...mapRegion().querySelectorAll("img.leaflet-tile")].map((tile) => tile.getAttribute("src") ?? "");
}

describe("the pins", () => {
  it("puts one pin on the map for each result with a real position", () => {
    render(<ResultsMap listings={[FIRST, SECOND]} position={null} />);

    expect(pinCount()).toBe(2);
  });

  it("gives each pin the name and the category as its accessible name", () => {
    render(<ResultsMap listings={[FIRST, SECOND]} position={null} />);

    expect(screen.getByRole("button", { name: "Night Pharmacy A, Pharmacy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "City Clinic, Clinic" })).toBeInTheDocument();
  });

  it("gives a name with HTML in it as plain text", () => {
    render(<ResultsMap listings={[listing({ name: "<b>Bold</b> & Sons" })]} position={null} />);

    expect(screen.getByRole("button", { name: "<b>Bold</b> & Sons, Pharmacy" })).toBeInTheDocument();
    expect(mapRegion().querySelector("b")).toBeNull();
  });

  it("adds pins when more results are given, and removes the ones that are gone", () => {
    const { rerender } = render(<ResultsMap listings={[FIRST]} position={null} />);
    expect(pinCount()).toBe(1);

    rerender(<ResultsMap listings={[FIRST, SECOND]} position={null} />);
    expect(pinCount()).toBe(2);

    rerender(<ResultsMap listings={[SECOND]} position={null} />);
    expect(pinCount()).toBe(1);
    expect(screen.getByRole("button", { name: "City Clinic, Clinic" })).toBeInTheDocument();
  });

  it("puts two results at the same position on the map, both with a pin", () => {
    render(<ResultsMap listings={[FIRST, { ...FIRST, id: 9, slug: "twin", name: "Twin" }]} position={null} />);

    expect(pinCount()).toBe(2);
  });
});

describe("a result with no real position", () => {
  it("gets no pin, and the map says how many places are missing and to switch to List", () => {
    render(<ResultsMap listings={[FIRST, NO_POSITION]} position={null} />);

    expect(pinCount()).toBe(1);
    expect(screen.getByText("1 place has no position on the map. Switch to List to see it.")).toBeInTheDocument();
  });

  it("says it in the plural for two or more", () => {
    render(<ResultsMap listings={[FIRST, NO_POSITION, { ...NO_POSITION, id: 4 }]} position={null} />);

    expect(screen.getByText("2 places have no position on the map. Switch to List to see them.")).toBeInTheDocument();
  });

  it("says nothing when every result has a position", () => {
    render(<ResultsMap listings={[FIRST]} position={null} />);

    expect(screen.queryByText(/no position on the map/)).not.toBeInTheDocument();
  });

  it("still shows a map, at the default place, when no result has a position", () => {
    render(<ResultsMap listings={[NO_POSITION]} position={null} />);

    expect(pinCount()).toBe(0);
    const addresses = tileAddresses();
    expect(addresses.length).toBeGreaterThan(0);
    for (const address of addresses) expect(address).toMatch(/^https:\/\/tile\.openstreetmap\.org\/12\//);
  });
});

describe("the map and its tiles", () => {
  it("has an accessible name and can be reached with the keyboard", () => {
    render(<ResultsMap listings={[FIRST]} position={null} />);

    expect(mapRegion()).toHaveAttribute("tabindex", "0");
  });

  it("opens close up on one pin, with tiles only from the OpenStreetMap address", () => {
    render(<ResultsMap listings={[FIRST]} position={null} />);

    const addresses = tileAddresses();
    expect(addresses.length).toBeGreaterThan(0);
    for (const address of addresses) expect(address).toMatch(/^https:\/\/tile\.openstreetmap\.org\/15\/\d+\/\d+\.png$/);
  });

  it("shows the OpenStreetMap credit as a link to the copyright page, and no Leaflet prefix", () => {
    render(<ResultsMap listings={[FIRST]} position={null} />);

    const credit = mapRegion().querySelector(".leaflet-control-attribution");
    expect(credit?.textContent).toBe("© OpenStreetMap contributors");
    expect(within(mapRegion()).getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
  });
});

describe("the visitor's position", () => {
  it("is a dot with the line Your position under the map, when there is a position", () => {
    render(<ResultsMap listings={[FIRST]} position={VISITOR} />);

    expect(mapRegion().querySelectorAll(".map-position-dot")).toHaveLength(1);
    expect(screen.getByText("Your position")).toBeInTheDocument();
  });

  it("is not shown, and not mentioned, when there is no position", () => {
    render(<ResultsMap listings={[FIRST]} position={null} />);

    expect(mapRegion().querySelector(".map-position-dot")).toBeNull();
    expect(screen.queryByText("Your position")).not.toBeInTheDocument();
  });

  it("is not a tab stop and not a button, and is not counted as a pin", () => {
    render(<ResultsMap listings={[FIRST]} position={VISITOR} />);

    const dotMarker = mapRegion().querySelector(".map-position-dot")?.closest(".leaflet-marker-icon");
    expect(dotMarker).not.toBeNull();
    expect(dotMarker).not.toHaveAttribute("tabindex");
    expect(dotMarker).not.toHaveAttribute("role");
    expect(pinCount()).toBe(1);
  });
});

describe("popups and the keyboard", () => {
  it("shows no popup content, and no Call or Directions button, until a pin is opened", () => {
    render(<ResultsMap listings={[FIRST, SECOND]} position={null} />);

    expect(screen.queryByRole("link", { name: /^Call/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Directions/ })).not.toBeInTheDocument();
  });

  it("reaches a pin with Tab from the map", async () => {
    const user = userEvent.setup();
    render(<ResultsMap listings={[FIRST]} position={null} />);
    const pin = screen.getByRole("button", { name: "Night Pharmacy A, Pharmacy" });

    expect(pin).toHaveAttribute("tabindex", "0");
    mapRegion().focus();
    for (let presses = 0; presses < 6 && document.activeElement !== pin; presses += 1) await user.tab();
    expect(pin).toHaveFocus();
  });

  it("opens the popup of a pin with Enter, with Call and Directions in it", async () => {
    const user = userEvent.setup();
    render(<ResultsMap listings={[FIRST, SECOND]} position={null} />);

    screen.getByRole("button", { name: "Night Pharmacy A, Pharmacy" }).focus();
    await user.keyboard("{Enter}");

    const popup = mapRegion().querySelector<HTMLElement>(".leaflet-popup");
    expect(popup).not.toBeNull();
    expect(within(popup as HTMLElement).getByRole("link", { name: "Call Night Pharmacy A" })).toBeInTheDocument();
    expect(within(popup as HTMLElement).getByRole("link", { name: /Directions to Night Pharmacy A/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Call City Clinic" })).not.toBeInTheDocument();
  });

  it("opens the popup of a pin with Space", async () => {
    const user = userEvent.setup();
    render(<ResultsMap listings={[FIRST]} position={null} />);

    screen.getByRole("button", { name: "Night Pharmacy A, Pharmacy" }).focus();
    await user.keyboard(" ");

    expect(mapRegion().querySelector(".leaflet-popup")).not.toBeNull();
  });

  it("opens the popup of a pin with a tap or a click", async () => {
    const user = userEvent.setup();
    render(<ResultsMap listings={[FIRST]} position={null} />);

    await user.click(screen.getByRole("button", { name: "Night Pharmacy A, Pharmacy" }));

    expect(mapRegion().querySelector(".leaflet-popup")).not.toBeNull();
  });

  it("moves focus to the name link when a popup opens, so Call and Directions are one Tab away", async () => {
    const user = userEvent.setup();
    render(<ResultsMap listings={[FIRST]} position={null} />);

    screen.getByRole("button", { name: "Night Pharmacy A, Pharmacy" }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("link", { name: "Night Pharmacy A" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Call Night Pharmacy A" })).toHaveFocus();
  });

  it("closes the popup with Escape and puts focus back on its pin", async () => {
    const user = userEvent.setup();
    render(<ResultsMap listings={[FIRST]} position={null} />);
    const pin = screen.getByRole("button", { name: "Night Pharmacy A, Pharmacy" });

    pin.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");

    expect(mapRegion().querySelector(".leaflet-popup")).toBeNull();
    expect(pin).toHaveFocus();
  });

  it("shows only one popup at a time", async () => {
    const user = userEvent.setup();
    render(<ResultsMap listings={[FIRST, SECOND]} position={null} />);

    screen.getByRole("button", { name: "Night Pharmacy A, Pharmacy" }).focus();
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: "City Clinic, Clinic" }).focus();
    await user.keyboard("{Enter}");

    expect(mapRegion().querySelectorAll(".leaflet-popup")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "City Clinic" })).toBeInTheDocument();
  });
});

describe("cleaning up and privacy", () => {
  it("removes the map when it is unmounted, without errors", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = render(<ResultsMap listings={[FIRST, SECOND]} position={VISITOR} />);

    unmount();

    expect(document.querySelector(".leaflet-container")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });

  it("does not write to the storage, the cookies or the address, and does not call fetch (NFR-07)", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    window.localStorage.clear();
    window.sessionStorage.clear();
    const addressBefore = window.location.href;
    const historyBefore = window.history.length;

    render(<ResultsMap listings={[FIRST, SECOND]} position={VISITOR} />);
    await user.click(screen.getByRole("button", { name: "Night Pharmacy A, Pharmacy" }));
    await user.keyboard("{Escape}");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
    expect(window.location.href).toBe(addressBefore);
    expect(window.history.length).toBe(historyBefore);
  });
});
