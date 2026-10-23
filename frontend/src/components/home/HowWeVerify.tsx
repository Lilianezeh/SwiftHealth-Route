/** A part of the home page: How we verify, with two photos. Requirements: US-13, US-07, NFR-01, NFR-10, NFR-13. Spec:
 * specs/2026-10-22-home-photos/requirements.md part 2 (the owner's answers 1 and 3). Both sentences come from /how-we-verify, which states the
 * rule; no number is invented. `hero2` (Magnific) is on the left and `hero3` (an Unsplash photo) on the right: **the Magnific credit is directly
 * under `hero2` only and nothing is under `hero3`**. The photos are side by side from 640 px and one under the other on a phone (the credit then
 * sits between them, directly under `hero2`).
 */
import Link from "next/link";

import { PhotoCredit } from "@/components/home/PhotoCredit";
import { SectionPhoto } from "@/components/home/SectionPhoto";
import { HOME_WORDS } from "@/config/home";
import { SECTION_PHOTOS } from "@/config/sectionPhotos";

export function HowWeVerify() {
  const words = HOME_WORDS.verify;

  return (
    <section aria-labelledby="verify-heading" className="section-lazy bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h2 id="verify-heading" className="text-2xl font-bold text-forest">
          {words.heading}
        </h2>
        <p className="mt-3 max-w-3xl text-lg text-ink">{words.text}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div data-photo="" className="flex flex-col">
            <SectionPhoto photo={SECTION_PHOTOS.verifyPharmacists} />
            <PhotoCredit />
          </div>
          <div data-photo="" className="flex flex-col">
            <SectionPhoto photo={SECTION_PHOTOS.verifyStethoscope} />
          </div>
        </div>
        {/* prefetch={false}: the home page does not download another page's code before it is asked for (R43). */}
        <Link href="/how-we-verify" prefetch={false} className="mt-4 inline-flex min-h-12 items-center text-base font-semibold text-forest underline">
          {words.link}
        </Link>
      </div>
    </section>
  );
}
