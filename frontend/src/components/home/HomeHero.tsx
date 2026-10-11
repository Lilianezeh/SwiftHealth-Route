/** Part 2 of the home page: the hero. Requirements: US-13, NFR-01, NFR-10, FR-02. UI spec 2.1; decisions 9, 10 and 19 in
 * specs/2026-10-11-home-redesign/requirements.md.
 *
 * On a phone: one photo fills the background under a dark blue overlay, and it is the SMALL file (hero-phone.webp). From
 * 768 px: the text on the left, and on the right the big photo with the second one smaller in front, with rounded corners.
 * The hero is one <picture>: its <source> for screens up to 767 px has one file, so every phone takes it whatever its pixel
 * density, and a phone never downloads hero.webp or hero2.webp. The second photo is a lazy image in a box that is hidden
 * below 768 px, and a browser does not fetch a lazy image that is not shown. The hero is loaded at once but is not asked to
 * be preloaded (that would make a phone preload the big file too).
 */
import { getImageProps } from "next/image";
import Link from "next/link";

import { HomeImage } from "@/components/home/HomeImage";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { HOME_PHOTOS, HOME_WORDS } from "@/config/home";

const PHONE_SCREENS = "(max-width: 767px)";

export function HomeHero() {
  const { hero, heroPhone, hero2 } = HOME_PHOTOS;
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
      className="on-dark relative isolate overflow-hidden bg-pine-dark text-white md:bg-forest"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:py-16">
        <div className="relative z-10">
          <h1 id="hero-heading" className="text-3xl font-bold leading-tight md:text-5xl">
            {words.heading}
          </h1>
          <p className="mt-4 text-lg">{words.line}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/find"
              className="inline-flex min-h-[50px] items-center justify-center rounded-xl bg-white px-6 text-base font-semibold text-forest hover:bg-pine-50 active:bg-pine-100"
            >
              {words.findCare}
            </Link>
            <Link href="/emergency" className={`${buttonClasses("emergency")} sm:w-auto sm:px-6`}>
              {words.emergency}
            </Link>
          </div>
          <p className="mt-4 text-base">{words.note}</p>
        </div>

        {/* The photos. On a phone this box is the background of the whole hero; from 768 px it is the right-hand column. */}
        <div className="absolute inset-0 -z-10 md:relative md:inset-auto md:z-auto md:min-h-[26rem] lg:min-h-[30rem]">
          <picture>
            <source media={PHONE_SCREENS} srcSet={`${heroPhone.src} ${heroPhone.width}w`} sizes="100vw" />
            {/* A plain <img> on purpose: it is the fallback of the <picture> above, with the attributes of next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              {...heroImage}
              alt={hero.alt}
              className="absolute inset-0 h-full w-full object-cover md:inset-auto md:right-0 md:top-0 md:h-auto md:w-[80%] md:rounded-2xl"
            />
          </picture>
          {/* Dark blue over the phone photo: white text on it is at least 4.5:1 over any photo. Not shown from 768 px. */}
          <div aria-hidden="true" className="absolute inset-0 bg-pine-dark/85 md:hidden" />
          <div className="hidden md:absolute md:bottom-0 md:left-0 md:block md:w-[58%]">
            <HomeImage photo={hero2} className="h-auto w-full rounded-2xl border-4 border-white shadow-card" />
          </div>
        </div>
      </div>
    </section>
  );
}
