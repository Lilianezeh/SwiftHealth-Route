/** Part 7 of the home page: for facility owners. Requirements: US-13, NFR-10. UI spec 2.1.
 * The page behind the button (`/list-your-facility`) is still "Coming soon" until phase 10.
 */
import Link from "next/link";

import { HomeImage } from "@/components/home/HomeImage";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { HOME_PHOTOS, HOME_WORDS } from "@/config/home";

export function FacilityOwners() {
  const words = HOME_WORDS.owners;

  return (
    <section aria-labelledby="owners-heading" className="bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-12 md:grid-cols-2">
        <HomeImage photo={HOME_PHOTOS.owner} className="h-auto w-full rounded-2xl" />
        <div>
          <h2 id="owners-heading" className="text-2xl font-bold text-forest">
            {words.heading}
          </h2>
          <p className="mt-3 text-lg text-ink">{words.text}</p>
          <div className="mt-6 md:max-w-xs">
            <Link href="/list-your-facility" className={buttonClasses("primary")}>
              {words.button}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
