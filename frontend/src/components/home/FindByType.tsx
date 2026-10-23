/** Part 5 of the home page: "Find by type" (it was "Browse by type" until 2026-10-15), five icon tiles. Requirements: US-13, NFR-10.
 * UI spec 2.1; revision R2 (2026-10-12): simple tiles, no photos; D1 of specs/2026-10-15-find-by-type/requirements.md. The whole tile is
 * one link to the search for its category, named by its label. A tile shows only that type: the search filters on the exact slug.
 * Since 2026-10-23 (specs/2026-10-22-home-photos/, revision 4) a faint background slideshow runs behind the heading and the tiles
 * (BackdropSlideshow); the tiles are white cards and stay as they were, and the heading is `pine-dark` so it passes 4.5:1 over the worst photo.
 */
import { Baby, FlaskConical, Hospital, Pill, Stethoscope, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { BackdropSlideshow } from "@/components/home/BackdropSlideshow";
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

export function FindByType() {
  return (
    <section aria-labelledby="find-by-type-heading" className="section-lazy relative isolate overflow-hidden bg-pine-50">
      <BackdropSlideshow>
        <h2 id="find-by-type-heading" className="text-2xl font-bold text-pine-dark">
          {HOME_WORDS.findByType.heading}
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {HOME_CATEGORIES.map((category) => (
            <li key={category.slug}>
              {/* prefetch={false}: the search page's code (with the map) is not downloaded before a tile is chosen (R43). */}
              <Link
                href={`/search?${filtersToQuery({ category: category.slug })}`}
                prefetch={false}
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
      </BackdropSlideshow>
    </section>
  );
}
