/** Part 4 of the home page: browse by type, five photo cards. Requirements: US-13, NFR-01, NFR-10. UI spec 2.1.
 * The whole card is one link to the search for its category. The link is named by its label, so a screen reader says
 * "Hospital", not the long description of the photo.
 */
import Link from "next/link";

import { HomeImage } from "@/components/home/HomeImage";
import { HOME_CATEGORIES, HOME_WORDS } from "@/config/home";
import { filtersToQuery } from "@/lib/search/searchQuery";

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
                aria-label={category.label}
                className="block overflow-hidden rounded-2xl border border-line bg-white shadow-card hover:border-pine"
              >
                <HomeImage photo={category.photo} className="h-auto w-full" />
                <span className="block p-3 text-lg font-bold text-forest">{category.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
