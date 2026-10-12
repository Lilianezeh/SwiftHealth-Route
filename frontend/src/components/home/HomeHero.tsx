/** Part 2 of the home page: the hero. Requirements: US-13, NFR-01, NFR-10. UI spec 2.1; decision 19 and revisions R4, R5 and
 * R11 to R13 (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md.
 *
 * A light sky blue background (the sky token) with dark blue text (white would be 1.5:1 there, dark blue is 6.1:1), one button,
 * and one photo (a stethoscope and a blood pressure gauge). On a phone the photo is below the text, the full width of the
 * screen, and the hero's edge is pulled up over it (a negative bottom margin) so it overlaps the next part. From 768 px the photo
 * box covers the right half of the hero: from the top to the right edge of the screen, and 6 rem below the hero's bottom edge.
 * The box is a child of the section itself, not of the page-width container, so it can reach the edge of the screen while the
 * text stays inside the page width, on the left half. The section has no overflow-hidden and is not isolated, so the photo can
 * sit above the next part (z-10).
 *
 * The hero is one <picture>: its <source> for screens up to 767 px has one file, so every phone takes the small one
 * (hero3-phone.webp) whatever its pixel density, and never downloads hero3.webp. The hero is loaded at once but is not asked to
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
    <section aria-labelledby="hero-heading" className="relative bg-sky text-pine-dark">
      <div className="mx-auto max-w-6xl px-4 pt-12 md:flex md:min-h-[30rem] md:items-center md:py-12">
        <div className="md:w-1/2 md:pr-8">
          <h1 id="hero-heading" className="text-3xl font-bold leading-tight text-pine-dark md:text-5xl">
            {words.heading}
          </h1>
          <p className="mt-4 text-lg text-pine-dark">{words.line}</p>
          <div className="mt-6">
            <Link href="/find" className={`${buttonClasses("primary")} sm:w-auto sm:px-8`}>
              {words.findCare}
            </Link>
          </div>
          <p className="mt-4 text-base text-pine-dark">{words.note}</p>
        </div>
      </div>

      <div className="relative z-10 -mb-12 mt-8 md:absolute md:-bottom-24 md:right-0 md:top-0 md:mb-0 md:mt-0 md:w-1/2">
        <picture>
          <source media={PHONE_SCREENS} srcSet={`${heroPhone.src} ${heroPhone.width}w`} sizes="100vw" />
          {/* A plain <img> on purpose: it is the fallback of the <picture> above, with the attributes of next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...heroImage} alt={hero.alt} className="h-auto w-full shadow-card md:h-full md:rounded-l-3xl md:object-cover" />
        </picture>
      </div>
    </section>
  );
}
