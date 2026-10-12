/** Part 4 of the home page: browse by type, five icon tiles. Requirements: US-13, NFR-10. UI spec 2.1; revision R2
 * (2026-10-12): simple tiles, no photos. The whole tile is one link to the search for its category, named by its label.
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

export function BrowseByType() {
  return (
    <section aria-labelledby="browse-heading">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="browse-heading" className="text-2xl font-bold text-forest">
          {HOME_WORDS.browse.heading}
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {HOME_CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/search?${filtersToQuery({ category: category.slug })}`}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-white p-4 text-center shadow-card hover:border-pine"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pine-100 text-forest">
                  <DecorativeIcon icon={TILE_ICONS[category.slug]} className="h-6 w-6" />
                </span>
                <span className="text-lg font-bold text-forest">{category.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
