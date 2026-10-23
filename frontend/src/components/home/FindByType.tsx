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
    <section
      aria-labelledby="find-by-type-heading"
      className="section-lazy relative isolate flex min-h-[480px] flex-col justify-center overflow-hidden bg-white md:min-h-[520px] lg:min-h-[560px]"
    >
      <BackdropSlideshow>
        {/* A soft white backing, like the Pause button and the credit: the heading is on a white surface whatever photo is behind it. */}
        <h2
          id="find-by-type-heading"
          className="inline-block rounded-xl bg-white/90 px-4 py-2 text-2xl font-bold text-forest"
        >
          {HOME_WORDS.findByType.heading}
        </h2>
        {/* Two tiles of two columns each on a phone (grid-cols-4: the last tile in the middle), three on a tablet (grid-cols-6: the last two in
            the middle), one row of five on a laptop. */}
        <ul className="mt-4 grid grid-cols-4 gap-2 md:mt-5 md:grid-cols-6 md:gap-3 lg:grid-cols-5">
          {HOME_CATEGORIES.map((category, position) => (
            <li key={category.slug} className={`col-span-2 lg:col-span-1 ${TILE_PLACE[position]}`}>
              {/* prefetch={false}: the search page's code (with the map) is not downloaded before a tile is chosen (R43). */}
              <Link
                href={`/search?${filtersToQuery({ category: category.slug })}`}
                prefetch={false}
                className="flex h-full min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-white p-2 text-center shadow-card hover:border-pine md:min-h-24 md:gap-2 md:p-4"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pine-100 text-forest md:h-12 md:w-12">
                  <DecorativeIcon icon={TILE_ICONS[category.slug]} className="h-6 w-6" />
                </span>
                <span className="text-base font-bold text-forest md:text-lg">{category.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </BackdropSlideshow>
    </section>
  );
}
