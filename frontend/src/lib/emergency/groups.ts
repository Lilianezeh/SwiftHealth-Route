/** The groups of SwiftRescue that the page uses: their headings, their order and which ones are always shown. Requirements: FR-15, FR-27.
 * Decision M1 in specs/2026-10-22-blood-only-on-blood-page/ and the groups change of 2026-10-22 in specs/2026-10-22-swiftrescue-groups/.
 *
 * The headings are kept here by slug, as well as in the API, because an older API answer (the minutes before the API is redeployed) and an
 * older saved copy still say "Fire", "24-hour emergency units" and "Roadside assistance": the page, the saved copy and the shared list all show
 * the headings of this list. A group of a slug that is not in the list (one the API adds later) keeps the name it came with and is drawn after
 * the known ones when it has a contact. Blood banks are listed only on /blood: an older answer still holds a "blood-bank" group, which is
 * dropped here, in one place.
 * No contact and no phone number is written here: the contacts come from the API (staff add them).
 */
import type { EmergencyGroup } from "@/types/api";

export type SwiftRescueGroup = {
  slug: string;
  heading: string;
  alwaysShown: boolean; // drawn even with no contact (it then says "No contacts added yet. In danger, call 112."); the others only with a contact
};

export const SWIFTRESCUE_GROUPS: readonly SwiftRescueGroup[] = [
  { slug: "ambulance", heading: "Ambulance", alwaysShown: true },
  { slug: "fire", heading: "Fire service", alwaysShown: true },
  { slug: "police", heading: "Police", alwaysShown: true },
  { slug: "emergency-unit", heading: "Hospital emergency (24 hours)", alwaysShown: true },
  { slug: "roadside-assistance", heading: "Road accidents", alwaysShown: true },
  { slug: "security", heading: "Security", alwaysShown: false },
  { slug: "disaster-flooding", heading: "Disaster and flooding", alwaysShown: false },
  { slug: "gbv-support", heading: "Sexual and gender-based violence support", alwaysShown: false },
  { slug: "mental-health-crisis", heading: "Mental health crisis support", alwaysShown: false },
];

const GROUPS_NOT_USED = ["blood-bank"];

function knownGroup(slug: string): SwiftRescueGroup | undefined {
  return SWIFTRESCUE_GROUPS.find((group) => group.slug === slug);
}

/** The groups of an answer without the ones the page does not use (blood banks). */
export function usedGroups(groups: EmergencyGroup[]): EmergencyGroup[] {
  return groups.filter((group) => !GROUPS_NOT_USED.includes(group.category.slug));
}

/** The used groups of an answer in the order of the list above, with its headings; a group the list does not know comes after, as it came. */
export function groupsInOrder(groups: EmergencyGroup[]): EmergencyGroup[] {
  const answered = usedGroups(groups);
  const known = SWIFTRESCUE_GROUPS.flatMap((entry) => {
    const found = answered.find((group) => group.category.slug === entry.slug);
    return found ? [{ ...found, category: { ...found.category, name: entry.heading } }] : [];
  });
  return [...known, ...answered.filter((group) => !knownGroup(group.category.slug))];
}

/** What the page draws: the five always-shown groups (an empty one if the answer lacks it), then the others that have a contact. */
export function groupsToDraw(groups: EmergencyGroup[]): EmergencyGroup[] {
  const ordered = groupsInOrder(groups);
  const always = SWIFTRESCUE_GROUPS.filter((entry) => entry.alwaysShown).map(
    (entry) =>
      ordered.find((group) => group.category.slug === entry.slug) ?? {
        category: { slug: entry.slug, name: entry.heading },
        contacts: [],
      },
  );
  const alwaysSlugs = always.map((group) => group.category.slug);
  return [...always, ...ordered.filter((group) => !alwaysSlugs.includes(group.category.slug) && group.contacts.length > 0)];
}
