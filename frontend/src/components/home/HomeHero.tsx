/** Part 2 of the home page: the hero. Requirements: US-13, NFR-01, NFR-10. UI spec 2.1; decision 19 and revision R4 and R5
 * (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md.
 *
 * A lighter blue background (pine-100) with dark blue text (white would be 1.2:1 there), one button, and one large photo that
 * overlaps the bottom edge of the hero into the next section. On a phone the photo is below the text and the hero's edge is
 * pulled up over it (a negative bottom margin on the last item). From 768 px the text is on the left and the photo on the right,
 * at the bottom of its column and moved down by a third of its own height (a negative margin would do nothing when the text
 * column is the taller one). The section has no overflow-hidden and is not isolated, so the photo can sit above the next section.
 *
 * The hero is one <picture>: its <source> for screens up to 767 px has one file, so every phone takes the small one
 * (hero-phone.webp) whatever its pixel density, and never downloads hero.webp. The hero is loaded at once but is not asked to
 * be preloaded (that would make a phone preload the big file too).
 */
import { getImageProps } from "next/image";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { HOME_PHOTOS, HOME_WORDS } from "@/config/home";

const PHONE_SCREENS = "(max-width: 767px)";

export function HomeHero() {
  const { hero, heroPhone } = HOME_PHOTOS;
  const words = HOME_WORDS.hero;
  // getImageProps gives the attributes that next/image would put on its <img>: the fixed size, the alt text, no blur.
  const { props: heroImage } = getImageProps({
    src: hero.src,
    width: hero.width,
    height: hero.height,
    alt: hero.alt,
    unoptimized: true,
    loading: "eager",
    fetchPriority: "high",
  });

  return (
    <section aria-labelledby="hero-heading" className="relative bg-pine-100 text-pine-dark">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-12 md:grid-cols-2 md:pt-16">
        <div className="md:pb-16">
          <h1 id="hero-heading" className="text-3xl font-bold leading-tight text-pine-dark md:text-5xl">
            {words.heading}
          </h1>
          <p className="mt-4 text-lg text-pine-dark">{words.line}</p>
          <div className="mt-6">
            <Link href="/find" className={`${buttonClasses("primary")} sm:w-auto sm:px-8`}>
              {words.findCare}
            </Link>
          </div>
          <p className="mt-4 text-base text-ink-soft">{words.note}</p>
        </div>

        <div className="relative z-10 -mb-12 md:mb-0 md:translate-y-1/3 md:self-end">
          <picture>
            <source media={PHONE_SCREENS} srcSet={`${heroPhone.src} ${heroPhone.width}w`} sizes="100vw" />
            {/* A plain <img> on purpose: it is the fallback of the <picture> above, with the attributes of next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              {...heroImage}
              alt={hero.alt}
              className="h-auto w-full rounded-2xl border-4 border-white shadow-card"
            />
          </picture>
        </div>
      </div>
    </section>
  );
}
