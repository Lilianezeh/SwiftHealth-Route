/** The groups of SwiftRescue that the page uses. Requirements: FR-15, FR-27. Decision M1 in specs/2026-10-22-blood-only-on-blood-page/.
 *
 * Blood banks are listed only on /blood. An older API (and an older saved copy) still holds a "blood-bank" group; it is dropped here, in
 * one place, for the page, the saved copy and the shared list alike, so a blood bank never shows on SwiftRescue.
 */
import type { EmergencyGroup } from "@/types/api";

const GROUPS_NOT_USED = ["blood-bank"];

export function usedGroups(groups: EmergencyGroup[]): EmergencyGroup[] {
  return groups.filter((group) => !GROUPS_NOT_USED.includes(group.category.slug));
}
