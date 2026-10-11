/** Tests for which results can be drawn on the map (lib/map/coordinates.ts). Requirements: FR-07, US-03.
 *
 * A result with no real position gets no pin, but stays in the list (decision 5 in specs/2026-10-11-map-view/requirements.md).
 */
import { describe, expect, it } from "vitest";

import { hasRealCoordinates, mapPoints } from "@/lib/map/coordinates";

import { listing } from "../helpers/api";

describe("hasRealCoordinates", () => {
  it("accepts a real position, the edges of the world and zero", () => {
    expect(hasRealCoordinates({ latitude: 6.452, longitude: 7.51 })).toBe(true);
    expect(hasRealCoordinates({ latitude: -90, longitude: 180 })).toBe(true);
    expect(hasRealCoordinates({ latitude: 90, longitude: -180 })).toBe(true);
    expect(hasRealCoordinates({ latitude: 0, longitude: 0 })).toBe(true);
  });

  it("rejects NaN and Infinity", () => {
    expect(hasRealCoordinates({ latitude: Number.NaN, longitude: 7.51 })).toBe(false);
    expect(hasRealCoordinates({ latitude: 6.452, longitude: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it("rejects a latitude over 90 and a longitude over 180, in both directions", () => {
    expect(hasRealCoordinates({ latitude: 90.1, longitude: 7.51 })).toBe(false);
    expect(hasRealCoordinates({ latitude: -90.1, longitude: 7.51 })).toBe(false);
    expect(hasRealCoordinates({ latitude: 6.452, longitude: 180.1 })).toBe(false);
    expect(hasRealCoordinates({ latitude: 6.452, longitude: -180.1 })).toBe(false);
  });

  it("rejects a value that is not a number, such as null from a bad answer", () => {
    expect(hasRealCoordinates({ latitude: null, longitude: 7.51 } as unknown as { latitude: number; longitude: number })).toBe(false);
  });
});

describe("mapPoints", () => {
  it("keeps the results with a real position, in the same order", () => {
    const first = listing({ id: 1, slug: "first" });
    const second = listing({ id: 2, slug: "second" });

    const { pins, missingCount } = mapPoints([first, second]);

    expect(pins).toEqual([first, second]);
    expect(missingCount).toBe(0);
  });

  it("leaves out the results with no real position and tells how many", () => {
    const placed = listing({ id: 1 });
    const noLatitude = listing({ id: 2, latitude: Number.NaN });
    const outside = listing({ id: 3, longitude: 400 });

    const { pins, missingCount } = mapPoints([noLatitude, placed, outside]);

    expect(pins).toEqual([placed]);
    expect(missingCount).toBe(2);
  });

  it("keeps two results at the same position (both get a pin)", () => {
    const { pins } = mapPoints([listing({ id: 1 }), listing({ id: 2 })]);

    expect(pins).toHaveLength(2);
  });

  it("gives nothing and no missing results for an empty list", () => {
    expect(mapPoints([])).toEqual({ pins: [], missingCount: 0 });
  });
});
