/** Tests for searchListings in lib/api/search.ts. Requirements: US-01, US-05, FR-04, FR-05, FR-06, NFR-07.
 *
 * The contract is specs/backend/api-spec.md, "GET /search". The position is sent only as `lat` and `lng` together.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchListings } from "@/lib/api/search";
import type { ListingSummary, SearchResponse } from "@/types/api";

const NIGHT_PHARMACY: ListingSummary = {
  id: 12,
  slug: "night-pharmacy-a",
  name: "Night Pharmacy A",
  category: { slug: "pharmacy", name: "Pharmacy" },
  area: "New Haven",
  address: "12 Example Road",
  latitude: 6.452,
  longitude: 7.51,
  distance_km: 1.4,
  is_open_now: true,
  is_24_hours: false,
  primary_phone: "+2340000000012",
  last_verified_at: "2026-10-01T10:00:00Z",
  verification_due: false,
  sponsored: false,
};

let requestedUrls: URL[];

beforeEach(() => {
  requestedUrls = [];
  const answer: SearchResponse = { items: [NIGHT_PHARMACY], total: 37 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requestedUrls.push(new URL(url));
      return new Response(JSON.stringify(answer), { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchListings", () => {
  it("sends only the filters that are set", async () => {
    await searchListings({}, null);

    expect(requestedUrls[0].pathname).toBe("/search");
    expect([...requestedUrls[0].searchParams.keys()].sort()).toEqual(["limit", "offset"]);
  });

  it("sends the filters that are set, with their exact values", async () => {
    await searchListings(
      { q: "Nigt Pharmcy", category: "pharmacy", service: "X-ray", area: "New Haven", open_now: true, is_24_hours: true },
      null,
    );

    const parameters = requestedUrls[0].searchParams;
    expect(parameters.get("q")).toBe("Nigt Pharmcy");
    expect(parameters.get("category")).toBe("pharmacy");
    expect(parameters.get("service")).toBe("X-ray");
    expect(parameters.get("area")).toBe("New Haven");
    expect(parameters.get("open_now")).toBe("true");
    expect(parameters.get("is_24_hours")).toBe("true");
  });

  it("leaves out empty text and switches that are off", async () => {
    await searchListings({ q: "", category: "", service: undefined, open_now: false, is_24_hours: false }, null);

    expect([...requestedUrls[0].searchParams.keys()].sort()).toEqual(["limit", "offset"]);
  });

  it("sends lat and lng together as plain numbers", async () => {
    await searchListings({ open_now: true }, { latitude: 6.451, longitude: 7.51 });

    const parameters = requestedUrls[0].searchParams;
    expect(parameters.get("lat")).toBe("6.451");
    expect(parameters.get("lng")).toBe("7.51");
  });

  it("sends no lat and no lng without a position", async () => {
    await searchListings({ radius_km: 5 }, null);

    expect(requestedUrls[0].searchParams.has("lat")).toBe(false);
    expect(requestedUrls[0].searchParams.has("lng")).toBe(false);
  });

  it("sends the distance only when there is a position", async () => {
    await searchListings({ radius_km: 20 }, null);
    await searchListings({ radius_km: 20 }, { latitude: 6.451, longitude: 7.51 });

    expect(requestedUrls[0].searchParams.has("radius_km")).toBe(false);
    expect(requestedUrls[1].searchParams.get("radius_km")).toBe("20");
  });

  it("sends the page: 20 at a time by default, and the offset for Load more", async () => {
    await searchListings({}, null);
    await searchListings({}, null, { limit: 20, offset: 40 });

    expect(requestedUrls[0].searchParams.get("limit")).toBe("20");
    expect(requestedUrls[0].searchParams.get("offset")).toBe("0");
    expect(requestedUrls[1].searchParams.get("offset")).toBe("40");
  });

  it("returns the items and the total as the api-spec describes them", async () => {
    const response = await searchListings({}, null);

    expect(response.total).toBe(37);
    expect(response.items).toEqual([NIGHT_PHARMACY]);
    expect(response.items[0].distance_km).toBe(1.4);
  });

  it("passes the notice callback and the cancel signal on to the request", async () => {
    const controller = new AbortController();
    const fetchStub = vi.fn(async () => new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchStub);

    await searchListings({}, null, undefined, { signal: controller.signal });

    const init = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(init[1].signal).toBeDefined();
  });

  it("encodes text safely in the address", async () => {
    await searchListings({ q: "a&b=c d%20é" }, null);

    expect(requestedUrls[0].searchParams.get("q")).toBe("a&b=c d%20é");
    expect(requestedUrls[0].searchParams.has("b")).toBe(false);
  });
});
