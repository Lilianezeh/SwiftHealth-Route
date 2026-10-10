/** Distance as shown on a card. Requirement: FR-06. The API sends kilometres rounded to 1 decimal, or null without a position. */

export function formatDistance(kilometres: number | null): string | null {
  if (kilometres === null) return null;
  if (kilometres === 0) return "Under 0.1 km"; // the API rounds a few metres to 0.0
  return `${kilometres} km`;
}
