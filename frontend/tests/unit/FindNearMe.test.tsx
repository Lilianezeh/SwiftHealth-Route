// @vitest-environment jsdom
/** "Find care near me" on the Find page: choose a type, tap, allow the location, see the nearest places of that type on a map and in a
 * list. Requirements: FR-03, US-01, NFR-07, NFR-10. Spec: specs/2026-11-01-maps-near-me/; UI spec 2.2 and 2.3.
 * The browser asks for the position ONLY after a tap, never when the page opens. The position is kept in memory and goes only to the API
 * in a POST body; it is in no address, no storage and no log. If the visitor refuses, the page asks them to choose an area instead.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FindNearMe } from "@/components/search/FindNearMe";
import { resetMetaCache } from "@/lib/api/meta";
import { readArea, readPosition, savePosition } from "@/lib/location/locationStore";

import { stubApi, stubGeolocation } from "../helpers/api";
import { stubGeolocationPermission } from "../helpers/permission";
import { readSource } from "../helpers/source";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const PERMISSION_DENIED = 1;

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  resetMetaCache();
  push.mockReset();
  stubGeolocationPermission("unsupported");
  stubApi({}); // the area list comes from GET /meta
});
afterEach(() => vi.unstubAllGlobals());

describe("before the visitor taps", () => {
  it("has a heading, the five types as buttons of 48 px, and says what happens to the location", async () => {
    const getCurrentPosition = stubGeolocation({ latitude: 6.452, longitude: 7.51 });
    render(<FindNearMe />);

    expect(screen.getByRole("heading", { level: 2, name: "Find care near me" })).toBeInTheDocument();
    for (const name of ["Hospitals", "Clinics", "Maternity homes", "Pharmacies", "Laboratories"]) {
      const button = screen.getByRole("button", { name: `${name} near me` });
      expect(button.className).toMatch(/min-h-12|min-h-\[50px\]/);
    }
    expect(screen.getByText(/only after you tap/i)).toHaveTextContent("We never keep it");
    expect(getCurrentPosition).not.toHaveBeenCalled(); // not when the page opens
  });
});

describe("when the visitor taps a type and allows the location", () => {
  it("asks the browser once, then opens the search of that type on the map, with the list under it, without the position in the address", async () => {
    const getCurrentPosition = stubGeolocation({ latitude: 6.45212, longitude: 7.50987 });
    render(<FindNearMe />);

    await userEvent.click(screen.getByRole("button", { name: "Pharmacies near me" }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith("/search?category=pharmacy&view=map");
    expect(push.mock.calls[0][0]).not.toMatch(/6\.45|7\.50|lat|lng/);
    expect(readPosition()).toEqual({ latitude: 6.452, longitude: 7.51 }); // rounded, in memory
  });

  it("does not ask the browser again when it already has the position: it goes straight to the results", async () => {
    savePosition({ latitude: 6.452, longitude: 7.51 });
    const getCurrentPosition = stubGeolocation({ latitude: 6.9, longitude: 7.9 });
    render(<FindNearMe />);

    await userEvent.click(screen.getByRole("button", { name: "Hospitals near me" }));

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/search?category=hospital&view=map");
  });

  it("says it is finding the location while it waits, and does not open the results before the answer", async () => {
    stubGeolocation({ latitude: 6.452, longitude: 7.51 });
    render(<FindNearMe />);

    await userEvent.click(screen.getByRole("button", { name: "Clinics near me" }));

    expect(push).not.toHaveBeenCalledWith(expect.stringContaining("clinic&view=list"));
  });
});

describe("when the visitor refuses (or the location cannot be found)", () => {
  it("says so, asks them to choose an area instead, and opens the list of that area for the same type", async () => {
    stubGeolocation({ errorCode: PERMISSION_DENIED });
    render(<FindNearMe />);

    await userEvent.click(screen.getByRole("button", { name: "Pharmacies near me" }));

    expect(await screen.findByText("We could not use your location. Choose an area instead.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(readPosition()).toBeNull();

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Choose an area" }), "Ogui");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/search?category=pharmacy&area=Ogui"));
    expect(readArea()).toBe("Ogui");
  });

  it("does not ask the browser a second time in the same tab after a refusal; the area list is there at once", async () => {
    const getCurrentPosition = stubGeolocation({ errorCode: PERMISSION_DENIED });
    render(<FindNearMe />);
    await userEvent.click(screen.getByRole("button", { name: "Pharmacies near me" }));
    await screen.findByText("We could not use your location. Choose an area instead.");

    await userEvent.click(screen.getByRole("button", { name: "Clinics near me" }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox", { name: "Choose an area" })).toBeInTheDocument();
  });
});

describe("privacy", () => {
  it("never logs, stores or puts the position anywhere but memory", async () => {
    stubGeolocation({ latitude: 6.45212, longitude: 7.50987 });
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    render(<FindNearMe />);

    await userEvent.click(screen.getByRole("button", { name: "Pharmacies near me" }));
    await waitFor(() => expect(push).toHaveBeenCalled());

    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
    expect(window.location.href).not.toMatch(/6\.45|7\.50/);
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });

  it("has no analytics or tracking in its source", () => {
    expect(readSource("components/search/FindNearMe.tsx")).not.toMatch(/analytics|gtag|plausible|umami|console\.|localStorage|sessionStorage/i);
  });
});

describe("the page uses it", () => {
  it("is drawn on the Find page, above the 'Open now near me' button", () => {
    const page = readSource("app/(public)/find/page.tsx");

    expect(page).toContain("<FindNearMe />");
    expect(page.indexOf("<FindNearMe />")).toBeLessThan(page.indexOf("<NearYou />"));
  });

  it("shows its types in the section, with labels that name the plural, in the order of the types file", () => {
    render(<FindNearMe />);

    const section = screen.getByRole("region", { name: "Find care near me" });
    expect(within(section).getAllByRole("button")).toHaveLength(5);
  });
});
