/** Part 5 of the home page: "Find by type" (it was "Browse by type" until 2026-10-15), five icon tiles. Requirements: US-13, NFR-10.
 * UI spec 2.1; revision R2 (2026-10-12): simple tiles, no photos; D1 of specs/2026-10-15-find-by-type/requirements.md. The whole tile is
 * one link to the search for its category, named by its label. A tile shows only that type: the search filters on the exact slug.
 */
import { Baby, FlaskConical, Hospital, Pill, Stethoscope, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { PhotoCredit } from "@/components/home/PhotoCredit";
import { SectionPhoto } from "@/components/home/SectionPhoto";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { HOME_CATEGORIES, HOME_WORDS } from "@/config/home";
import { SECTION_PHOTOS } from "@/config/sectionPhotos";
import { filtersToQuery } from "@/lib/search/searchQuery";

const TILE_ICONS: Record<(typeof HOME_CATEGORIES)[number]["slug"], LucideIcon> = {
  hospital: Hospital,
  clinic: Stethoscope,
  maternity: Baby,
  pharmacy: Pill,
  laboratory: FlaskConical,
};

const PHOTO_ROW = [SECTION_PHOTOS.clinic, SECTION_PHOTOS.pharmacy, SECTION_PHOTOS.laboratory, SECTION_PHOTOS.maternity];

export function FindByType() {
  return (
    <section aria-labelledby="find-by-type-heading">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 id="find-by-type-heading" className="text-2xl font-bold text-forest">
          {HOME_WORDS.findByType.heading}
        </h2>
        {/* Four photos above the tiles (2026-10-22, specs/2026-10-22-home-photos/): not clickable and not labelled as a type (there is no
            hospital photo, and the maternity photo is a talk between two masked people), with one credit under the row. The tiles stay as they are. */}
        <div className="mt-6 flex flex-col">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {PHOTO_ROW.map((photo) => (
              <SectionPhoto key={photo.src} photo={photo} />
            ))}
          </div>
          <PhotoCredit />
        </div>
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
      </div>
    </section>
  );
}
