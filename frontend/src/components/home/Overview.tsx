/** Part 3 of the home page: the overview, one short paragraph, with a photo. Requirements: US-13, NFR-01, NFR-10, NFR-13. UI spec 2.1;
 * revisions R15 and R22 (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md. The words are the owner's. The photo (`hero`, blue
 * capsules and a stethoscope) was added on 2026-10-22 (specs/2026-10-22-home-photos/): beside the text from 768 px, under it on a phone, lazy.
 * It comes right after the hero. The hero photo no longer overlaps into it, so it has the normal space.
 */
import { PhotoCredit } from "@/components/home/PhotoCredit";
import { SectionPhoto } from "@/components/home/SectionPhoto";
import { SECTION_PHOTOS } from "@/config/sectionPhotos";
import { HOME_WORDS } from "@/config/home";

export function Overview() {
  const { heading, text } = HOME_WORDS.overview;

  return (
    <section aria-labelledby="overview-heading" className="section-lazy bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 md:grid md:grid-cols-2 md:items-center md:gap-10 md:py-16">
        <div>
          <h2 id="overview-heading" className="text-2xl font-bold text-forest">
            {heading}
          </h2>
          <p className="mt-3 max-w-3xl text-lg text-ink">{text}</p>
        </div>
        <div className="mt-6 flex flex-col md:mt-0">
          <SectionPhoto photo={SECTION_PHOTOS.overview} />
          <PhotoCredit />
        </div>
      </div>
    </section>
  );
}
