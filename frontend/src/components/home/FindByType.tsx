/** Part 5 of the home page: "Find by type" (it was "Browse by type" until 2026-10-15), five icon tiles. Requirements: US-13, NFR-10.
 * UI spec 2.1; revision R2 (2026-10-12): simple tiles, no photos; D1 of specs/2026-10-15-find-by-type/requirements.md. The whole tile is
 * one link to the search for its category, named by its label. A tile shows only that type: the search filters on the exact slug.
 * From 2026-10-23 to 2026-10-28 a faint background slideshow ran behind the heading and the tiles; the photos moved to the hero
 * (specs/2026-10-28-hero-slideshow/) and this is a plain section again: the light-blue band, a plain heading, the tiles as they were.
 */
import { Baby, FlaskConical, Hospital, Pill, Stethoscope, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { HOME_CATEGORIES, HOME_WORDS } from "@/config/home";
import { filtersToQuery } from "@/lib/search/searchQuery";

const TILE_ICONS: Record<(typeof HOME_CATEGORIES)[number]["slug"], LucideIcon> = {
  hospital: Hospital,
  clinic: Stethoscope,
  maternity: Baby,
  pharmacy: Pill,
  laboratory: FlaskConical,
};

// Where each tile starts, so the last row is in the middle: the fifth tile alone on a phone, the fourth and fifth together on a tablet; none
// on a laptop (one row of five). Whole class names, so Tailwind finds them.
const TILE_PLACE = [
  "",
  "",
  "",
  "md:col-start-2 lg:col-start-auto",
  "col-start-2 md:col-start-auto",
] as const;

export function FindByType() {
  return (
    <section aria-labelledby="find-by-type-heading" className="bg-pine-50">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="find-by-type-heading" className="text-2xl font-bold text-forest">
          {HOME_WORDS.findByType.heading}
        </h2>
        {/* Two tiles of two columns each on a phone (grid-cols-4: the last tile in the middle), three on a tablet (grid-cols-6: the last two in
            the middle), one row of five on a laptop. */}
        <ul className="mt-6 grid grid-cols-4 gap-2 md:grid-cols-6 md:gap-3 lg:grid-cols-5">
          {HOME_CATEGORIES.map((category, position) => (
            <li key={category.slug} className={`col-span-2 lg:col-span-1 ${TILE_PLACE[position]}`}>
              {/* The link is named by its label (aria-labelledby) and described by its line (aria-describedby), so the name of each tile is
                  still just "Hospital", "Clinic"... prefetch={false}: the search page's code (with the map) is not downloaded before a tile is
                  chosen (R43). The lift on hover and focus moves only `transform`: the layout never shifts; reduce motion switches it off. */}
              <Link
                href={`/search?${filtersToQuery({ category: category.slug })}`}
                prefetch={false}
                aria-labelledby={`type-name-${category.slug}`}
                aria-describedby={`type-line-${category.slug}`}
                className="flex h-[190px] flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface p-3 text-center shadow-card transition duration-200 hover:-translate-y-1 hover:border-pine hover:shadow-lg focus-visible:-translate-y-1 focus-visible:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 md:gap-2 md:p-4"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pine-100 text-forest md:h-16 md:w-16">
                  <DecorativeIcon icon={TILE_ICONS[category.slug]} className="h-7 w-7 md:h-8 md:w-8" />
                </span>
                <span id={`type-name-${category.slug}`} className="text-xl font-bold text-forest">
                  {category.label}
                </span>
                <span id={`type-line-${category.slug}`} className="text-base text-ink-soft">
                  {category.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
