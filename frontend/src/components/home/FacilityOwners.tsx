/** Part 6 of the home page: for facility owners. Requirements: US-13, NFR-01, NFR-10, NFR-13. UI spec 2.1; revisions R13 and R25 (2026-10-12),
 * and the photo of 2026-10-22 (specs/2026-10-22-home-photos/: the `owner` photo, a smiling pharmacist at the counter, replaces the portrait
 * `hero4`, which was deleted). The photo is 3:2, lazy, with its credit under it: on the left from 768 px with the text right beside it, vertically
 * centred; above the text on a phone.
 * The page behind the button (`/list-your-facility`) is the list-your-facility form.
 */
import Link from "next/link";

import { PhotoCredit } from "@/components/home/PhotoCredit";
import { SectionPhoto } from "@/components/home/SectionPhoto";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { HOME_WORDS } from "@/config/home";
import { SECTION_PHOTOS } from "@/config/sectionPhotos";

export function FacilityOwners() {
  const words = HOME_WORDS.owners;

  return (
    <section aria-labelledby="owners-heading" className="section-lazy bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 md:grid md:grid-cols-2 md:items-center md:gap-10 md:py-16">
        <div className="flex flex-col">
          <SectionPhoto photo={SECTION_PHOTOS.owners} />
          <PhotoCredit />
        </div>
        <div className="mt-6 md:mt-0 md:max-w-xl">
          <h2 id="owners-heading" className="text-2xl font-bold text-forest">
            {words.heading}
          </h2>
          <p className="mt-3 text-lg text-ink">{words.text}</p>
          <div className="mt-6 md:max-w-xs">
            <Link href="/list-your-facility" prefetch={false} className={buttonClasses("primary")}>
              {words.button}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
