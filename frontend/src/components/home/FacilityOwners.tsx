/** Part 6 of the home page: for facility owners. Requirements: US-13, NFR-10. UI spec 2.1; revisions R13 and R25 (2026-10-12).
 * The photo is a portrait (800 x 1200) shown whole: never cropped or stretched. It is the full width of the content on a phone;
 * from 768 px it is 26 rem high (about 17.3 rem wide, because its width follows its shape) and the text sits right beside it with
 * a 2.5 rem gap, both vertically centred, the text at most 36 rem wide, so there is no big empty space between them.
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
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-12 md:flex md:items-center md:gap-10 md:space-y-0">
        <HomeImage photo={HOME_PHOTOS.owner} className="h-auto w-full rounded-2xl md:h-[26rem] md:w-auto md:shrink-0" />
        <div className="md:max-w-xl">
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
