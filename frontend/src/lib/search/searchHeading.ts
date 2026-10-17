/** The heading of the results page. Requirements: US-01, FR-05. Spec: specs/2026-10-15-find-by-type/requirements.md D3.
 * "Search results" with no type. With one of the five types the heading says which, and says "near you" only when it is true:
 * an area in the address wins ("Pharmacies in Ogui"), then a position ("Pharmacies near you"), else just the plural ("Pharmacies").
 * The position itself is never in the heading, only the fact that there is one.
 */
import { findTypeChoice } from "@/config/types";

export const DEFAULT_HEADING = "Search results";

type HeadingPlace = { area: string | undefined; hasPosition: boolean };

export function searchHeading(category: string | undefined, place: HeadingPlace): string {
  const choice = findTypeChoice(category);
  if (!choice) return DEFAULT_HEADING;
  if (place.area) return `${choice.plural} in ${place.area}`;
  return place.hasPosition ? `${choice.plural} near you` : choice.plural;
}
