/** Part 2 of the home page: the hero. Requirements: US-13, NFR-01, NFR-10. UI spec 2.1; decision 19 and revisions R4, R5 and
 * R18 to R21 (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md. Like the reference site the owner pointed to.
 *
 * A sky blue gradient (from `pine-dark` at the bottom left to `sky` at the top right; white text passes on every point: 8.92:1
 * to 4.64:1), tall (85% of the screen), with the white text in the lower left, one white button, and one photo.
 * Phone: the photo is a band at the top, the full width, with a slanted bottom edge, and the text is below it.
 * From 768 px: the photo box is absolute, so it fills the whole right half from top to bottom and to the right edge of the
 * screen, with a slanted left edge. It is a child of the section itself, not of the page-width container, so it can reach the
 * edge; the text stays inside the page width on the left half. Nothing goes below the hero, so there is no overlap.
 * The header is transparent on this page and sits over the photo (z-20), so the photo has a dark veil at its top: the white
 * header links stay readable even over the white sheets of the photo (6.02:1 in the worst case).
 *
 * The hero is one <picture>: its <source> for screens up to 767 px has one file, so every phone takes the small one
 * (hero3-phone.webp) whatever its pixel density, and never downloads hero3.webp. The hero is loaded at once but is not asked to
 * be preloaded (that would make a phone preload the big file too). The section carries `on-dark`: the focus ring inside it is
 * the light one, because the forest ring would be almost invisible on the blue.
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
    <section
      aria-labelledby="hero-heading"
      className="on-dark relative flex min-h-[85svh] flex-col bg-linear-to-tr from-pine-dark to-sky text-white"
    >
      <div className="relative h-72 shrink-0 [clip-path:polygon(0_0,100%_0,100%_85%,0_100%)] md:absolute md:inset-y-0 md:right-0 md:h-auto md:w-1/2 md:[clip-path:polygon(15%_0,100%_0,100%_100%,0_100%)]">
        <picture className="block h-full">
          <source media={PHONE_SCREENS} srcSet={`${heroPhone.src} ${heroPhone.width}w`} sizes="100vw" />
          {/* A plain <img> on purpose: it is the fallback of the <picture> above, with the attributes of next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...heroImage} alt={hero.alt} className="h-full w-full object-cover" />
        </picture>
        {/* The veil: decoration only, behind the header's white links (solid for the first 60% of its 8 rem, then fading out). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-pine-dark/85 via-pine-dark/85 via-60% to-transparent"
        />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 items-end px-4 pb-10 pt-6 md:pb-16 md:pt-28">
        <div className="md:w-1/2 md:pr-8">
          <h1 id="hero-heading" className="text-4xl font-bold leading-tight text-white md:text-6xl">
            {words.heading}
          </h1>
          <p className="mt-4 text-xl text-white md:text-2xl">{words.line}</p>
          <div className="mt-6">
            <Link href="/find" className={`${buttonClasses("onDark")} sm:w-auto sm:px-8`}>
              {words.findCare}
            </Link>
          </div>
          <p className="mt-4 text-lg text-white">{words.note}</p>
        </div>
      </div>
    </section>
  );
}
