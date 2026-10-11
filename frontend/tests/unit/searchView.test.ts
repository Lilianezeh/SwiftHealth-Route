/** Tests for the view (list or map) in the page address (lib/search/searchView.ts). Requirements: FR-07, NFR-07.
 *
 * `view=map` shows the map. Anything else shows the list, which is the default. The address never holds the visitor's
 * position, nor the centre or the zoom of the map (ui-spec 2.3, "Map view").
 */
import { describe, expect, it } from "vitest";

import { readView, withView } from "@/lib/search/searchView";

describe("readView", () => {
  it("gives map only for view=map", () => {
    expect(readView("view=map")).toBe("map");
    expect(readView("?category=pharmacy&view=map&open_now=true")).toBe("map");
    expect(readView(new URLSearchParams("view=map"))).toBe("map");
  });

  it("gives list for no view, view=list, view=MAP, view=maps or an empty value", () => {
    for (const query of ["", "category=pharmacy", "view=list", "view=MAP", "view=maps", "view=", "view=map%20"]) {
      expect(readView(query)).toBe("list");
    }
  });

  it("gives list when view is given twice and the first is not map", () => {
    expect(readView("view=list&view=map")).toBe("list");
  });
});

describe("withView", () => {
  it("adds view=map to a query and keeps every other part in its order", () => {
    expect(withView("category=pharmacy&open_now=true", "map")).toBe("category=pharmacy&open_now=true&view=map");
  });

  it("gives just view=map for an empty query", () => {
    expect(withView("", "map")).toBe("view=map");
  });

  it("removes view for the list and keeps the other parts", () => {
    expect(withView("category=pharmacy&view=map&open_now=true", "list")).toBe("category=pharmacy&open_now=true");
    expect(withView("view=map", "list")).toBe("");
  });

  it("does not add view twice", () => {
    expect(withView("view=map&category=pharmacy", "map")).toBe("category=pharmacy&view=map");
  });

  it("accepts a query that starts with a question mark, and gives one without it", () => {
    expect(withView("?category=pharmacy", "map")).toBe("category=pharmacy&view=map");
  });

  it("never adds lat, lng, a centre or a zoom (NFR-07)", () => {
    const query = withView("category=pharmacy", "map");
    const names = [...new URLSearchParams(query).keys()];

    expect(names).toEqual(["category", "view"]);
  });
});
