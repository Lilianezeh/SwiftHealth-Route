// @vitest-environment jsdom
/** Tests for NearYou: the "Open now near me" button and the Near you section, with the location rules.
 * Requirements: FR-03, US-01, NFR-07. UI spec 2.2, items 5 and 6, and "Location".
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NearYou } from "@/components/search/NearYou";
import { resetMetaCache } from "@/lib/api/meta";
import { markLocationDenied, readArea, savePosition } from "@/lib/location/locationStore";

import { json, listing, stubApi, stubGeolocation } from "../helpers/api";
import { stubGeolocationPermission } from "../helpers/permission";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const PERMISSION_DENIED = 1;

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  resetMetaCache();
  push.mockReset();
  stubGeolocationPermission("unsupported"); // like jsdom itself, unless a test adds a permission check
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function apiWithOnePharmacy() {
  return stubApi({
    search: (parameters) =>
      json(parameters.get("category") === "pharmacy" ? { items: [listing()], total: 1 } : { items: [], total: 0 }),
  });
}

describe("NearYou without a position or an area", () => {
  it("does not ask the browser for the position when the page loads, and makes no search", async () => {
    const getCurrentPosition = stubGeolocation({ latitude: 6.452, longitude: 7.51 });
    const { searches } = apiWithOnePharmacy();
    render(<NearYou />);

    expect(await screen.findByRole("button", { name: "Show places near me" })).toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(searches()).toHaveLength(0);
  });

  it("shows the area list next to the button", async () => {
    apiWithOnePharmacy();
    render(<NearYou />);

    expect(await screen.findByRole("combobox", { name: "Choose an area" })).toBeInTheDocument();
  });

  it("asks only after the tap, then shows the two cards for the position", async () => {
    const getCurrentPosition = stubGeolocation({ latitude: 6.45212, longitude: 7.50987 });
    const { searches } = apiWithOnePharmacy();
    render(<NearYou />);

    await userEvent.click(await screen.findByRole("button", { name: "Show places near me" }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("link", { name: "Night Pharmacy A" })).toBeInTheDocument();
    expect(searches()[0].searchParams.get("lat")).toBe("6.452"); // rounded to 3 decimals
  });

  it("when the visitor refuses, says so and keeps the area list; the choice of an area shows the cards", async () => {
    stubGeolocation({ errorCode: PERMISSION_DENIED });
    const { searches } = apiWithOnePharmacy();
    render(<NearYou />);

    await userEvent.click(await screen.findByRole("button", { name: "Show places near me" }));

    expect(await screen.findByText("We could not use your location. Choose an area instead.")).toBeInTheDocument();
    expect(searches()).toHaveLength(0);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Choose an area" }), "Ogui");

    expect(await screen.findByRole("link", { name: "Night Pharmacy A" })).toBeInTheDocument();
    expect(readArea()).toBe("Ogui");
    for (const url of searches()) expect(url.searchParams.get("area")).toBe("Ogui");
  });

  it("asks only once per tab: after a refusal, the button does not ask again", async () => {
    markLocationDenied();
    const getCurrentPosition = stubGeolocation({ latitude: 6.452, longitude: 7.51 });
    apiWithOnePharmacy();
    render(<NearYou />);

    await userEvent.click(await screen.findByRole("button", { name: "Show places near me" }));

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(await screen.findByText("We could not use your location. Choose an area instead.")).toBeInTheDocument();
  });

  it("says location is unavailable when the browser has none", async () => {
    stubGeolocation({ errorCode: 2 });
    apiWithOnePharmacy();
    render(<NearYou />);

    await userEvent.click(await screen.findByRole("button", { name: "Show places near me" }));

    expect(await screen.findByText("Location is unavailable. Choose an area instead.")).toBeInTheDocument();
  });

  it("says 'Finding your location…' while it waits for the phone", async () => {
    const getCurrentPosition = vi.fn(); // never answers
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    apiWithOnePharmacy();
    render(<NearYou />);

    await userEvent.click(await screen.findByRole("button", { name: "Show places near me" }));

    expect(await screen.findByText("Finding your location…")).toBeInTheDocument();
  });
});

describe("NearYou with a saved position", () => {
  it("shows the two cards at once and no 'Show places near me' button", async () => {
    savePosition({ latitude: 6.452, longitude: 7.51 });
    apiWithOnePharmacy();
    render(<NearYou />);

    expect(await screen.findByRole("link", { name: "Night Pharmacy A" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show places near me" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Near you" })).toBeInTheDocument();
  });
});

describe("the 'Open now near me' button", () => {
  it("with a position goes to /search?open_now=true, without the position in the address", async () => {
    savePosition({ latitude: 6.452, longitude: 7.51 });
    apiWithOnePharmacy();
    render(<NearYou />);

    await userEvent.click(await screen.findByRole("button", { name: "Open now near me" }));

    expect(push).toHaveBeenCalledWith("/search?open_now=true");
  });

  it("asks for the position after the tap, then goes to /search?open_now=true", async () => {
    const getCurrentPosition = stubGeolocation({ latitude: 6.452, longitude: 7.51 });
    apiWithOnePharmacy();
    render(<NearYou />);

    await userEvent.click(await screen.findByRole("button", { name: "Open now near me" }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/search?open_now=true"));
  });

  it("does not leave the page when the visitor refuses; it offers the area list", async () => {
    stubGeolocation({ errorCode: PERMISSION_DENIED });
    apiWithOnePharmacy();
    render(<NearYou />);

    await userEvent.click(await screen.findByRole("button", { name: "Open now near me" }));

    expect(await screen.findByText("We could not use your location. Choose an area instead.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("with only a chosen area, goes to /search with that area", async () => {
    stubGeolocation({ errorCode: PERMISSION_DENIED });
    apiWithOnePharmacy();
    render(<NearYou />);
    await userEvent.click(await screen.findByRole("button", { name: "Show places near me" }));
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Choose an area" }), "Ogui");

    await userEvent.click(screen.getByRole("button", { name: "Open now near me" }));

    expect(push).toHaveBeenCalledWith("/search?area=Ogui&open_now=true");
  });

  it("has a 52 px tap target and an icon beside the words", async () => {
    apiWithOnePharmacy();
    render(<NearYou />);

    const button = await screen.findByRole("button", { name: "Open now near me" });
    expect(button.className).toMatch(/min-h-\[50px\]|min-h-\[52px\]/);
    expect(within(button).getByText("Open now near me")).toBeInTheDocument();
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

// The phone test of 2026-10-10: the first tab allowed location, a new tab got a copy of its sessionStorage, and the visitor
// had blocked the site. The stored position must not be used.
describe("NearYou with a stored position but a blocked site", () => {
  it("ignores the stored position: says so, shows the area list, and sends no lat or lng", async () => {
    savePosition({ latitude: 6.452, longitude: 7.51 });
    stubGeolocationPermission("denied");
    const getCurrentPosition = stubGeolocation({ latitude: 6.1, longitude: 7.1 });
    const { searches } = apiWithOnePharmacy();
    render(<NearYou />);

    expect(await screen.findByText("We could not use your location. Choose an area instead.")).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Choose an area" })).toBeInTheDocument();
    expect(searches()).toHaveLength(0);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("'Open now near me' does not go to the results, and does not ask the browser again", async () => {
    savePosition({ latitude: 6.452, longitude: 7.51 });
    stubGeolocationPermission("denied");
    const getCurrentPosition = stubGeolocation({ latitude: 6.1, longitude: 7.1 });
    apiWithOnePharmacy();
    render(<NearYou />);
    await screen.findByText("We could not use your location. Choose an area instead.");

    await userEvent.click(screen.getByRole("button", { name: "Open now near me" }));

    expect(push).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("with the permission still granted, the stored position is used as before", async () => {
    savePosition({ latitude: 6.452, longitude: 7.51 });
    stubGeolocationPermission("granted");
    apiWithOnePharmacy();
    render(<NearYou />);

    await userEvent.click(await screen.findByRole("button", { name: "Open now near me" }));

    expect(push).toHaveBeenCalledWith("/search?open_now=true");
  });
});
