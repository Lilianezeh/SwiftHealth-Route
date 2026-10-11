// @vitest-environment jsdom
/** Tests for the List | Map views of the /search page. Requirements: FR-07, US-01, NFR-01, NFR-07. UI spec 2.3, "Map view".
 * The map itself is tested in ResultsMap.test.tsx with the real Leaflet. Here it is a stand-in that lists its pins, so these
 * tests are about the page: which view shows, what the address holds, and that nothing is asked twice.
 * The stand-in for the address lets a push or a replace change what `useSearchParams` returns, like the real router does.
 */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SearchPage from "@/app/(public)/search/page";
import { resetMetaCache } from "@/lib/api/meta";
import { savePosition } from "@/lib/location/locationStore";

import { json, listing, manyListings, neverAnswers, stubApi } from "../helpers/api";
import { installDialogSupport } from "../helpers/dialog";
import { stubGeolocationPermission } from "../helpers/permission";
import { readSource } from "../helpers/source";

const address = vi.hoisted(() => ({
  query: "",
  listeners: new Set<() => void>(),
  push: vi.fn(),
  replace: vi.fn(),
}));
const mapStandIn = vi.hoisted(() => ({ mounts: 0 }));

function goTo(path: string) {
  address.query = path.split("?")[1] ?? "";
  act(() => address.listeners.forEach((listener) => listener()));
}

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const subscribe = (listener: () => void) => {
    address.listeners.add(listener);
    return () => address.listeners.delete(listener);
  };
  return {
    useRouter: () => ({ push: address.push, replace: address.replace }),
    useSearchParams: () => {
      useSyncExternalStore(subscribe, () => address.query);
      return new URLSearchParams(address.query);
    },
  };
});

vi.mock("@/components/search/ResultsMap", async () => {
  const { useEffect } = await import("react");
  return {
    ResultsMap: ({
      listings,
      position,
    }: {
      listings: { id: number; name: string }[];
      position: { latitude: number; longitude: number } | null;
    }) => {
      useEffect(() => {
        mapStandIn.mounts += 1;
      }, []);
      return (
        <div data-testid="results-map" data-position={position ? `${position.latitude},${position.longitude}` : "none"}>
          <ul aria-label="Map pins">
            {listings.map((place) => (
              <li key={place.id}>{place.name}</li>
            ))}
          </ul>
        </div>
      );
    },
  };
});

beforeEach(() => {
  installDialogSupport();
  window.sessionStorage.clear();
  resetMetaCache();
  address.query = "";
  address.listeners.clear();
  address.push.mockReset().mockImplementation((path: string) => goTo(path));
  address.replace.mockReset().mockImplementation((path: string) => goTo(path));
  mapStandIn.mounts = 0;
  stubGeolocationPermission("unsupported");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function cardNames(): string[] {
  return screen.queryAllByRole("article").map((card) => within(card).getAllByRole("link")[0].textContent ?? "");
}

function pinNames(): string[] {
  return within(screen.getByRole("list", { name: "Map pins" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("the list is the default and is complete", () => {
  it("shows the cards and no map when the address has no view", async () => {
    stubApi({ search: () => json({ items: manyListings(3), total: 3 }) });
    render(<SearchPage />);

    await screen.findByText("3 places, A to Z");

    expect(cardNames()).toEqual(["Place 1", "Place 2", "Place 3"]);
    expect(screen.queryByTestId("results-map")).not.toBeInTheDocument();
    expect(mapStandIn.mounts).toBe(0);
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the list for view=list, view=MAP and any other value", async () => {
    for (const value of ["list", "MAP", "maps", ""]) {
      address.query = `view=${value}`;
      stubApi({ search: () => json({ items: manyListings(2), total: 2 }) });
      const { unmount } = render(<SearchPage />);

      await screen.findByText("2 places, A to Z");

      expect(screen.queryByTestId("results-map")).not.toBeInTheDocument();
      expect(cardNames()).toEqual(["Place 1", "Place 2"]);
      unmount();
    }
  });

  it("loads the map code only when it is needed (a dynamic import, no server rendering)", () => {
    const source = readSource("components/search/SearchResults.tsx");

    expect(source).toMatch(/dynamic\(/);
    expect(source).toMatch(/ssr:\s*false/);
    expect(source).not.toMatch(/import\s+\{[^}]*ResultsMap[^}]*\}\s+from/); // no static import of the map
    expect(source).not.toMatch(/from\s+["']leaflet["']/);
  });
});

describe("the map view", () => {
  it("shows the map with the same results, and not the cards, for view=map", async () => {
    address.query = "view=map";
    stubApi({ search: () => json({ items: manyListings(3), total: 3 }) });
    render(<SearchPage />);

    expect(await screen.findByTestId("results-map")).toBeInTheDocument();

    expect(pinNames()).toEqual(["Place 1", "Place 2", "Place 3"]);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the count line above the results in the map view too", async () => {
    address.query = "view=map";
    stubApi({ search: () => json({ items: manyListings(3), total: 3 }) });
    render(<SearchPage />);

    await screen.findByTestId("results-map");

    expect(screen.getByText("3 places, A to Z")).toBeInTheDocument();
  });

  it("gives the stored position to the map, but never puts it in the page address", async () => {
    address.query = "view=map";
    savePosition({ latitude: 6.101, longitude: 7.202 });
    stubApi({ search: () => json({ items: manyListings(2), total: 2 }) });
    render(<SearchPage />);

    expect((await screen.findByTestId("results-map")).getAttribute("data-position")).toBe("6.101,7.202");
    expect(address.push).not.toHaveBeenCalled();
    expect(address.replace).not.toHaveBeenCalled();
  });

  it("ignores a position, a centre or a zoom in a shared link", async () => {
    address.query = "view=map&category=pharmacy&lat=6.1&lng=7.2&zoom=15&center=6.1,7.2";
    const { searches } = stubApi({ search: () => json({ items: manyListings(2), total: 2 }) });
    render(<SearchPage />);

    const map = await screen.findByTestId("results-map");

    expect(map.getAttribute("data-position")).toBe("none");
    expect(searches()[0].searchParams.has("lat")).toBe(false);
    expect(searches()[0].searchParams.has("lng")).toBe(false);
  });

  it("shows no map while loading, and the same skeleton as the list", async () => {
    vi.useFakeTimers();
    address.query = "view=map";
    stubApi({ search: neverAnswers });
    const { container } = render(<SearchPage />);
    await act(async () => {});

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId("results-map")).not.toBeInTheDocument();
  });

  it("shows the error with Retry, and no map, when the search fails", async () => {
    address.query = "view=map";
    stubApi({ search: () => json({ detail: "boom" }, 500) });
    render(<SearchPage />);

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByTestId("results-map")).not.toBeInTheDocument();
  });

  it("shows the empty message, and no map, when nothing matches", async () => {
    address.query = "view=map";
    stubApi({ search: () => json({ items: [], total: 0 }) });
    render(<SearchPage />);

    expect(await screen.findByText(/No matches/)).toBeInTheDocument();
    expect(screen.queryByTestId("results-map")).not.toBeInTheDocument();
  });

  it("keeps Load more, and Load more adds pins", async () => {
    address.query = "view=map";
    stubApi({
      search: (parameters) =>
        parameters.get("offset") === "0"
          ? json({ items: manyListings(20), total: 25 })
          : json({ items: manyListings(5, 21), total: 25 }),
    });
    render(<SearchPage />);
    await screen.findByTestId("results-map");
    expect(pinNames()).toHaveLength(20);

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    await screen.findByText("Place 25");
    expect(pinNames()).toHaveLength(25);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});

describe("the toggle and the address", () => {
  it("adds view=map to the address and keeps the filters, with a new history entry (push, not replace)", async () => {
    address.query = "category=pharmacy&open_now=true";
    stubApi({ search: () => json({ items: manyListings(2), total: 2 }) });
    render(<SearchPage />);
    await screen.findByText("2 places, A to Z");

    await userEvent.click(screen.getByRole("button", { name: "Map" }));

    expect(address.push).toHaveBeenCalledTimes(1);
    expect(address.push).toHaveBeenCalledWith("/search?category=pharmacy&open_now=true&view=map");
    expect(address.replace).not.toHaveBeenCalled();
    expect(await screen.findByTestId("results-map")).toBeInTheDocument();
  });

  it("removes view from the address when List is tapped, with a new history entry", async () => {
    address.query = "category=pharmacy&view=map";
    stubApi({ search: () => json({ items: manyListings(2), total: 2 }) });
    render(<SearchPage />);
    await screen.findByTestId("results-map");

    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(address.push).toHaveBeenCalledWith("/search?category=pharmacy");
    expect(address.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("results-map")).not.toBeInTheDocument();
    expect(cardNames()).toEqual(["Place 1", "Place 2"]);
  });

  it("gives /search?view=map, and back to /search, when there are no filters", async () => {
    stubApi({ search: () => json({ items: manyListings(2), total: 2 }) });
    render(<SearchPage />);
    await screen.findByText("2 places, A to Z");

    await userEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(address.push).toHaveBeenLastCalledWith("/search?view=map");

    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(address.push).toHaveBeenLastCalledWith("/search");
  });

  it("does nothing when the view that is already shown is tapped", async () => {
    stubApi({ search: () => json({ items: manyListings(2), total: 2 }) });
    render(<SearchPage />);
    await screen.findByText("2 places, A to Z");

    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(address.push).not.toHaveBeenCalled();
    expect(address.replace).not.toHaveBeenCalled();
  });

  it("never writes the position, a centre or a zoom into the address, with a stored position", async () => {
    savePosition({ latitude: 6.101, longitude: 7.202 });
    stubApi({ search: () => json({ items: manyListings(2), total: 2 }) });
    render(<SearchPage />);
    await screen.findByText("2 places, nearest first");

    await userEvent.click(screen.getByRole("button", { name: "Map" }));
    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(address.push.mock.calls).toEqual([["/search?view=map"], ["/search"]]);
  });

  it("drops lat and lng of a shared link from the address when the view is changed", async () => {
    address.query = "view=map&category=pharmacy&lat=6.1&lng=7.2";
    stubApi({ search: () => json({ items: manyListings(2), total: 2 }) });
    render(<SearchPage />);
    await screen.findByTestId("results-map");

    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(address.push).toHaveBeenCalledWith("/search?category=pharmacy");
  });

  it("does not ask the API again when the view changes, and the list is the same afterwards", async () => {
    const { searches } = stubApi({ search: () => json({ items: manyListings(3), total: 3 }) });
    render(<SearchPage />);
    await screen.findByText("3 places, A to Z");
    const namesBefore = cardNames();

    await userEvent.click(screen.getByRole("button", { name: "Map" }));
    await screen.findByTestId("results-map");
    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(searches()).toHaveLength(1);
    expect(cardNames()).toEqual(namesBefore);
  });

  it("keeps a result without a position in the list (only the map leaves it out)", async () => {
    stubApi({ search: () => json({ items: [listing({ id: 1, name: "No Position", latitude: Number.NaN })], total: 1 }) });
    render(<SearchPage />);

    await screen.findByText("1 place, A to Z");

    expect(cardNames()).toEqual(["No Position"]);
  });
});

describe("searching again and filters keep the map", () => {
  it("has a hidden view=map field in the search box in the map view, and none in the list view", async () => {
    address.query = "view=map&category=pharmacy";
    stubApi({});
    const { unmount } = render(<SearchPage />);
    const mapForm = await screen.findByRole("search");

    expect(mapForm.querySelector("input[type=hidden][name=view]")).toHaveAttribute("value", "map");
    unmount();

    address.query = "category=pharmacy";
    render(<SearchPage />);
    const listForm = await screen.findByRole("search");

    expect(listForm.querySelector("input[name=view]")).toBeNull();
  });
});
