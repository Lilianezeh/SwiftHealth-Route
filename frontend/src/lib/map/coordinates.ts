/** Which results can be drawn on the map. Requirements: FR-07, US-03. UI spec 2.3, "Map view".
 * A result with no real position gets no pin but stays in the list.
 */
import type { ListingSummary } from "@/types/api";

type Coordinates = { latitude: number; longitude: number };

export function hasRealCoordinates({ latitude, longitude }: Coordinates): boolean {
  return (
    Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
  );
}

/** The results that get a pin (in the same order), and how many were left out. */
export function mapPoints(listings: ListingSummary[]): { pins: ListingSummary[]; missingCount: number } {
  const pins = listings.filter(hasRealCoordinates);
  return { pins, missingCount: listings.length - pins.length };
}
