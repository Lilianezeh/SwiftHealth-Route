/** Tests for the filters in the page address (lib/search/searchQuery.ts). Requirements: US-01, US-05, FR-05, NFR-07.
 *
 * The page address holds every filter so results can be shared, but NEVER the visitor's position (decision 3).
 */
import { describe, expect, it } from "vitest";

import { filtersToQuery, queryToFilters, type SearchFilters } from "@/lib/search/searchQuery";

const ALL_FILTERS: SearchFilters = {
  q: "Nigt Pharmcy",
  category: "pharmacy",
  service: "X-ray",
  area: "New Haven",
  open_now: true,
  is_24_hours: true,
  radius_km: 20,
};

describe("filtersToQuery and queryToFilters", () => {
  it("round-trip every filter", () => {
    expect(queryToFilters(filtersToQuery(ALL_FILTERS))).toEqual(ALL_FILTERS);
  });

  it("write only the filters that are set, in a fixed order", () => {
    expect(filtersToQuery({ open_now: true, category: "pharmacy" })).toBe("category=pharmacy&open_now=true");
    expect(filtersToQuery({})).toBe("");
  });

  it("leave out empty text, switches that are off and a missing distance", () => {
    expect(filtersToQuery({ q: "", category: "  ", open_now: false, is_24_hours: false })).toBe("");
  });

  it("trim the search text", () => {
    expect(filtersToQuery({ q: "  pharmacy  " })).toBe("q=pharmacy");
    expect(queryToFilters("q=%20%20pharmacy%20")).toEqual({ q: "pharmacy" });
  });

  it("encode text that could break the address", () => {
    const query = filtersToQuery({ q: "a&b=c#d é" });
    expect(query).not.toContain("#");
    expect(query.split("&")).toHaveLength(1);
    expect(queryToFilters(query)).toEqual({ q: "a&b=c#d é" });
  });

  it("read a query string with or without a leading question mark, and URLSearchParams", () => {
    expect(queryToFilters("?category=clinic")).toEqual({ category: "clinic" });
    expect(queryToFilters(new URLSearchParams("category=clinic&open_now=true"))).toEqual({
      category: "clinic",
      open_now: true,
    });
  });
});

describe("queryToFilters ignores values that are not valid", () => {
  it.each([
    ["radius_km=abc", {}],
    ["radius_km=0", {}],
    ["radius_km=-5", {}],
    ["radius_km=51", {}],
    ["radius_km=Infinity", {}],
    ["radius_km=10", { radius_km: 10 }],
    ["radius_km=50", { radius_km: 50 }],
    ["open_now=maybe", {}],
    ["open_now=false", {}],
    ["open_now=1", {}],
    ["open_now=true", { open_now: true }],
    ["is_24_hours=yes", {}],
    ["q=", {}],
    ["category=", {}],
    ["unknown=1&category=clinic", { category: "clinic" }],
  ])("%s", (query, expected) => {
    expect(queryToFilters(query)).toEqual(expected);
  });

  it("takes the first value when a name is repeated", () => {
    expect(queryToFilters("category=clinic&category=hospital")).toEqual({ category: "clinic" });
  });
});

describe("the position never goes through the address (NFR-07)", () => {
  it("filtersToQuery never writes lat or lng, even if they were smuggled into the object", () => {
    const smuggled = { ...ALL_FILTERS, lat: 6.451, lng: 7.51, latitude: 6.451, longitude: 7.51 } as SearchFilters;
    expect(filtersToQuery(smuggled)).not.toMatch(/lat|lng|longitude|6\.451|7\.51/);
  });

  it("queryToFilters ignores lat and lng in a pasted address", () => {
    const filters = queryToFilters("lat=6.451&lng=7.51&category=pharmacy");
    expect(filters).toEqual({ category: "pharmacy" });
    expect(JSON.stringify(filters)).not.toMatch(/6\.451|7\.51/);
  });
});
