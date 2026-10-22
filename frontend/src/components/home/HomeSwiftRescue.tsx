/** A part of the home page: SwiftRescue, with the ambulance and fire photos. Requirements: US-13, US-04, FR-14, FR-19, NFR-01, NFR-10, NFR-13.
 * Spec: specs/2026-10-22-home-photos/requirements.md part 2 (the owner's answer 1: a blue button, never red). It says what SwiftRescue is and
 * links to it; it promises no response (FR-26) and shows no sponsored content. The red of SwiftRescue is the header's button only. The two
 * photos are the same files as on /emergency (one download, kept offline there), lazy, with one credit under them.
 */
import Link from "next/link";

import { PhotoCredit } from "@/components/home/PhotoCredit";
import { SectionPhoto } from "@/components/home/SectionPhoto";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { brand } from "@/config/brand";
import { HOME_WORDS } from "@/config/home";
import { EMERGENCY_PHOTOS } from "@/config/sectionPhotos";

export function HomeSwiftRescue() {
  const words = HOME_WORDS.rescue;

  return (
    <section aria-labelledby="rescue-heading" className="bg-pine-50">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 id="rescue-heading" className="text-2xl font-bold text-forest">
          {brand.emergencyName}
        </h2>
        <p className="mt-3 max-w-3xl text-lg text-ink">{words.text}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <SectionPhoto photo={EMERGENCY_PHOTOS.ambulance} shape="8:3" />
          <SectionPhoto photo={EMERGENCY_PHOTOS.fire} shape="8:3" />
        </div>
        <div className="flex flex-col">
          <PhotoCredit />
        </div>
        <div className="mt-4 md:max-w-xs">
          <Link href="/emergency" prefetch={false} className={buttonClasses("primary")}>
            {words.button}
          </Link>
        </div>
      </div>
    </section>
  );
}
