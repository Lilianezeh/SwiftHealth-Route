/** Part 8 of the home page: about. Requirements: US-13, NFR-10. UI spec 2.1.
 * The first city comes from siteConfig (through config/home.ts); the words never say it is the only place.
 */
import { HOME_WORDS } from "@/config/home";

export function AboutSwiftHealth() {
  const words = HOME_WORDS.about;

  return (
    <section aria-labelledby="about-heading">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h2 id="about-heading" className="text-2xl font-bold text-forest">
          {words.heading}
        </h2>
        <p className="mt-3 text-lg text-ink">{words.text}</p>
      </div>
    </section>
  );
}
