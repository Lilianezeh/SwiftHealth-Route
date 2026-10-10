/** Tests for formatDistance in lib/formatters/distance.ts. Requirement: FR-06 (each result shows its distance).
 *
 * The API sends kilometres rounded to 1 decimal, and null when the visitor sent no position.
 */
import { describe, expect, it } from "vitest";

import { formatDistance } from "@/lib/formatters/distance";

describe("formatDistance", () => {
  it.each([
    [1.4, "1.4 km"],
    [0.3, "0.3 km"],
    [12.5, "12.5 km"],
    [1, "1 km"],
    [10, "10 km"],
    [50, "50 km"],
    [0.1, "0.1 km"],
  ])("writes %s as %s", (kilometres, expected) => {
    expect(formatDistance(kilometres)).toBe(expected);
  });

  it("says 'Under 0.1 km' for 0 (the API rounds a few metres to 0.0)", () => {
    expect(formatDistance(0)).toBe("Under 0.1 km");
  });

  it("gives nothing when there is no distance, so the card shows none", () => {
    expect(formatDistance(null)).toBeNull();
  });

  it("never writes metres", () => {
    expect(formatDistance(0.3)).not.toMatch(/\bm\b/);
  });
});
