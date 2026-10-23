/** The five types of place the visitor can choose, in one file: the category slug, the chip label and the plural for the heading.
 * Requirements: US-01, FR-05, NFR-10. Spec: specs/2026-10-15-find-by-type/requirements.md D2 and D3.
 * The slugs are the category slugs of the seed, the same as the home tiles (config/home.ts) and the Find shortcuts (config/search.ts);
 * tests/unit/typeConfig.test.ts fails if they drift apart.
 * The photo banners of D6 were removed on 2026-10-22 (owner): the search page has no pictures (specs/2026-10-22-home-photos/, part 1).
 */
export type TypeSlug = "hospital" | "clinic" | "maternity" | "pharmacy" | "laboratory";

export type TypeChoice = {
  slug: TypeSlug;
  chipLabel: string; // singular: "Pharmacy" in the chip "Pharmacy ✕"
  plural: string; // the heading "Pharmacies near you"
};

export const TYPE_CHOICES: readonly TypeChoice[] = [
  { slug: "hospital", chipLabel: "Hospital", plural: "Hospitals" },
  { slug: "clinic", chipLabel: "Clinic", plural: "Clinics" },
  { slug: "maternity", chipLabel: "Maternity", plural: "Maternity homes" },
  { slug: "pharmacy", chipLabel: "Pharmacy", plural: "Pharmacies" },
  { slug: "laboratory", chipLabel: "Laboratory", plural: "Laboratories" },
];

/** The type of a category slug, or nothing for another category (an emergency one from a shared link) or no category. */
export function findTypeChoice(slug: string | undefined): TypeChoice | undefined {
  return TYPE_CHOICES.find((choice) => choice.slug === slug);
}
