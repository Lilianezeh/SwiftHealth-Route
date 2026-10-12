/** Part 3 of the home page: the overview, one short paragraph. Requirements: US-13, NFR-10. UI spec 2.1; revisions R15 and R22
 * (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md. The words are the owner's.
 * It comes right after the hero. The hero photo no longer overlaps into it, so it has the normal space.
 */
import { HOME_WORDS } from "@/config/home";

export function Overview() {
  const { heading, text } = HOME_WORDS.overview;

  return (
    <section aria-labelledby="overview-heading" className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="overview-heading" className="text-2xl font-bold text-forest">
          {heading}
        </h2>
        <p className="mt-3 max-w-3xl text-lg text-ink">{text}</p>
      </div>
    </section>
  );
}
