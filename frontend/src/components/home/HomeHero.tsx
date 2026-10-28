/** Part 2 of the home page: the hero. Requirements: US-13, NFR-01, NFR-10. UI spec 2.1; decision 19 and revisions R4, R5 and
 * R18 to R21 (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md. Like the reference site the owner pointed to.
 *
 * A sky blue gradient (from `pine-dark` at the bottom left to `sky` at the top right; white text passes on every point: 8.92:1
 * to 4.64:1), with the white text in the lower left, one white button, and one photo. It is tall (85% of the screen) only from
 * 1024 px, in the side-by-side layout; the stacked layout has no forced height, so there is no empty gap on a tablet (R30).
 * Phone and tablet (up to 1023 px, R28): the photo is a band at the top, the full width (16 rem high, 18 rem from 768 px: R33),
 * with a slanted bottom edge, and the text is below it at the full width of the page. There the text row is a plain block and the
 * column is `w-full min-w-0`, and the heading may break anywhere (`break-words`), so no engine can size the column by the width of
 * the heading on one line and push it past the screen edge (R31); the row is a flex row only from 1024 px.
 * From 1024 px: the photo box is absolute, so it fills the whole right half from top to bottom and to the right edge of the
 * screen, with a slanted left edge. It is a child of the section itself, not of the page-width container, so it can reach the
 * edge; the text stays inside the page width on the left half. Nothing goes below the hero, so there is no overlap.
 * The header is transparent on this page and sits over the photo (z-20), so the photo has a dark veil at its top: the white
 * header links stay readable even over the white sheets of the photo (5.26:1 in the worst case). The veil is short and soft
 * (R27): 6 rem, solid for the 3 rem that cover the header's text, then a gentle fade.
 * The heading uses balanced line breaks (text-balance), so a tablet never shows a single word alone on the last line (R29).
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
      className="on-dark relative flex flex-col bg-linear-to-tr from-hero-from to-hero-to text-white lg:min-h-[85svh]"
    >
      <div className="relative h-64 shrink-0 [clip-path:polygon(0_0,100%_0,100%_85%,0_100%)] md:h-72 lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-1/2 lg:[clip-path:polygon(15%_0,100%_0,100%_100%,0_100%)]">
        <picture className="block h-full">
          <source media={PHONE_SCREENS} srcSet={`${heroPhone.src} ${heroPhone.width}w`} sizes="100vw" />
          {/* A plain <img> on purpose: it is the fallback of the <picture> above, with the attributes of next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...heroImage} alt={hero.alt} className="h-full w-full object-cover dark:brightness-75" />
        </picture>
        {/* The dark mode only: a see-through navy over the whole photo (the stethoscope's white sheets would glare on a dark page), on
            top of the photo being a little dimmer. Hidden in the light mode, which keeps the photo as it was. */}
        <div
          data-hero-tint=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-veil/60 to-veil/30 dark:block"
        />
        {/* The veil: decoration only, behind the header's white links. 6 rem high, solid (85%) for the first 4.5 rem, which covers
            everything the header draws (its items end at about 3.5 rem), then a fade out over the last 1.5 rem. It was solid for 3 rem and
            80%; measured on the real pixels, the lower part of the items was then over a fading veil and a white sheet of the photo gave
            3.8:1 to 4.3:1, under the 4.5:1 that text needs (tests/end-to-end/hero-header-contrast.spec.ts). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-veil/85 via-veil/85 via-75% to-transparent"
        />
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 lg:flex lg:items-end lg:pb-16 lg:pt-28">
        <div className="w-full min-w-0 lg:w-1/2 lg:pr-8">
          <h1
            id="hero-heading"
            className="text-balance break-words text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl"
          >
            {words.heading}
          </h1>
          <p className="mt-4 text-xl text-white lg:text-2xl">{words.line}</p>
          <div className="mt-6">
            {/* prefetch={false}: the home page does not download the Find page's code before it is asked for (R43). */}
            <Link href="/find" prefetch={false} className={`${buttonClasses("onDark")} sm:w-auto sm:px-8`}>
              {words.findCare}
            </Link>
          </div>
          <p className="mt-4 text-lg text-white">{words.note}</p>
        </div>
      </div>
    </section>
  );
}
