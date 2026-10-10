/** Which categories the Filters sheet offers, and in which order. Requirements: FR-05, FR-15, FR-01.
 * Decisions 1 to 3 in specs/2026-10-10-hide-emergency-filters/requirements.md.
 *
 * - Only everyday categories (`is_emergency: false`): SwiftRescue groups the emergency ones and Blood has its own page.
 *   The test is the flag, not a list of slugs, so a new everyday category shows up by itself.
 * - In the order of the Find shortcuts (Hospital, Clinic, Pharmacy, Maternity, Laboratory), then any other everyday category
 *   in the order `GET /meta` gives.
 * - A category that is applied now (from a shared link, for example `?category=ambulance`) stays in the list even if it is an
 *   emergency one, with its real name, so the sheet never says "Any category" while the results are filtered.
 */
import { CATEGORY_SHORTCUTS } from "@/config/search";
import type { MetaCategory } from "@/types/api";

export type CategoryChoice = { value: string; label: string };

const FIND_ORDER: readonly string[] = CATEGORY_SHORTCUTS.map((shortcut) => shortcut.slug);

function positionInFindOrder(slug: string): number {
  const position = FIND_ORDER.indexOf(slug);
  return position === -1 ? FIND_ORDER.length : position; // unknown categories come after the five
}

export function chooseFilterCategories(categories: MetaCategory[], appliedSlug: string | undefined): CategoryChoice[] {
  const everyday = categories
    .filter((item) => !item.is_emergency)
    .map((item, metaOrder) => ({ item, metaOrder }))
    .sort((first, second) => positionInFindOrder(first.item.slug) - positionInFindOrder(second.item.slug) || first.metaOrder - second.metaOrder)
    .map(({ item }) => ({ value: item.slug, label: item.name }));

  const appliedEmergency = categories.find((item) => item.is_emergency && item.slug === appliedSlug);
  return appliedEmergency ? [...everyday, { value: appliedEmergency.slug, label: appliedEmergency.name }] : everyday;
}
