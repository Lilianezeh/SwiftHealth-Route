/** Part 6 of the home page: the SwiftRescue band. Requirements: US-13, FR-02, FR-14, NFR-10. UI spec 2.1.
 * A dark blue band with the ambulance and fire photos, one heading and one red button to /emergency. It gives no advice and no
 * instructions: the page behind the button is SwiftRescue.
 */
import Link from "next/link";

import { HomeImage } from "@/components/home/HomeImage";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { HOME_PHOTOS, HOME_WORDS } from "@/config/home";

export function RescueBand() {
  const words = HOME_WORDS.rescue;

  return (
    <section aria-labelledby="rescue-heading" className="on-dark bg-forest text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-12 md:grid-cols-2">
        <div>
          <h2 id="rescue-heading" className="text-2xl font-bold md:text-4xl">
            {words.heading}
          </h2>
          <div className="mt-6 md:max-w-xs">
            <Link href="/emergency" className={buttonClasses("emergency")}>
              {words.button}
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <HomeImage photo={HOME_PHOTOS.ambulance} className="h-auto w-full rounded-2xl" />
          <HomeImage photo={HOME_PHOTOS.fire} className="h-auto w-full rounded-2xl" />
        </div>
      </div>
    </section>
  );
}
