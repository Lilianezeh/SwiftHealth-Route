/** Part 2 of the home page: the hero. Requirements: US-13, NFR-01, NFR-10, NFR-13. UI spec 2.1 (revision of 2026-10-22); specs/2026-10-22-home-photos/.
 * The words are the server's: the heading, the line, the search form, the "Find care near me" link and the small line. HeroSlider (client) draws
 * the photos, the overlay, the credit and the Pause button and dots around them, and never draws these words again.
 * The section is a blue gradient (white text passes on every point: 8.92:1 to 4.64:1), tall (85% of the screen) only from 1024 px. Under 1024 px
 * the photos are a band at the top and this text is below it; the text row is a plain block and the column `w-full min-w-0`, and the heading may
 * break anywhere (`break-words`), so no engine can size the column by the width of the heading on one line (R31). The heading uses balanced line
 * breaks (R29). SwiftRescue is the header's red button only: none here (owner, 2026-10-22).
 */
import Link from "next/link";

import { HeroSearch } from "@/components/home/HeroSearch";
import { HeroSlider } from "@/components/home/HeroSlider";
import { HOME_WORDS } from "@/config/home";

export function HomeHero() {
  const words = HOME_WORDS.hero;
  return (
    <HeroSlider>
      <h1
        id="hero-heading"
        className="text-balance break-words text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl"
      >
        {words.heading}
      </h1>
      <p className="mt-4 text-xl text-white lg:text-2xl">{words.line}</p>
      <HeroSearch />
      <div className="mt-2">
        {/* prefetch={false}: the home page does not download the Find page's code before it is asked for (R43). */}
        <Link
          href="/find"
          prefetch={false}
          className="inline-flex min-h-12 items-center text-base font-semibold text-white underline underline-offset-4"
        >
          {words.findCare}
        </Link>
      </div>
      <p className="mt-2 text-lg text-white">{words.note}</p>
    </HeroSlider>
  );
}
