"use client";

/** The hero of the home page with its photo slider. Requirements: US-13, NFR-01, NFR-10, NFR-13. UI spec 2.1 (revision of 2026-10-22);
 * specs/2026-10-22-home-photos/requirements.md part 2; tested by tests/unit/HeroSlider.test.tsx.
 *
 * The text of the hero (heading, line, search box, links) is passed in as `children` from the server: this component never changes it, and
 * a photo change never draws it again. Only the photos, the Pause button and the dots are client code.
 *
 * What the visitor gets:
 * - Before any script: the first photo (in the HTML, `fetchpriority="high"`, a phone gets the 640 px file) and the credit. Nothing else loads.
 * - After the page has loaded and the browser is idle: the next photo is added one step ahead of its turn, so it is ready when it fades in.
 * - Every 6 seconds the next photo fades in over 1.5 seconds (CSS `opacity`, no library). Pause/Play and the dots appear. A dot shows its photo
 *   and starts the 6 seconds again. The photos stop while the tab is hidden, and while the visitor has paused them.
 * - With "reduce motion" on: the first photo stays, still. No timer, no more photos, no Pause button, no dots.
 *
 * Layout (a phone and tablet under 1024 px, and from 1024 px): under 1024 px the photos are a band at the top and the text is below it on the
 * blue gradient, so the text never lies on a photo. From 1024 px the photos fill the hero and a dark blue overlay (80% under the text on the
 * left, 30% on the right) keeps the white text at 4.5:1 or better on any photo (5.26:1 on a pure white one; tests/unit/HomeHero.test.tsx).
 * The header is transparent on this page, so the top 6 rem of the photos has a veil (80%) behind its white links.
 * The one credit is fixed in the lower right corner of the photo area, the same on every slide (owner, 2026-10-22).
 */
import { Pause, Play } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { HERO_CREDIT, HERO_SIZES, HERO_SLIDE_SECONDS, HERO_SLIDES } from "@/config/heroPhotos";

const PHONE_SCREENS = "(max-width: 767px)";
const SLIDE_COUNT = HERO_SLIDES.length;

/** Runs `callback` once the page has loaded and the browser is idle; returns the function that cancels it. */
function whenPageIsIdle(callback: () => void): () => void {
  let timer: number | undefined;
  const start = () => {
    timer = window.setTimeout(callback, 200); // a short wait after the load event, so the photos never compete with the page
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
  return () => {
    window.removeEventListener("load", start);
    window.clearTimeout(timer);
  };
}

type HeroSliderProps = { children: ReactNode };

export function HeroSlider({ children }: HeroSliderProps) {
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false); // the page has loaded: more photos may be added and the photos may change
  const [paused, setPaused] = useState(false); // the visitor pressed Pause
  const [hidden, setHidden] = useState(false); // the tab is not shown
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null); // null until the browser has been asked (the server cannot know)
  const [restart, setRestart] = useState(0); // counted up by a dot, so the 6 seconds start again even for the same photo
  const [added, setAdded] = useState<number[]>([0]); // the photos already in the page: they stay, so a fade never starts from nothing

  const next = (current + 1) % SLIDE_COUNT;
  const slidesInPage = started ? [...new Set([...added, current, next])].sort((first, second) => first - second) : [0];

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)"); // an old browser without matchMedia just gets the slider
    setReducedMotion(query?.matches ?? false);
    if (!query) return;
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion !== false) return; // reduce motion: one still photo, nothing else is ever added
    return whenPageIsIdle(() => setStarted(true));
  }, [reducedMotion]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (started) setAdded((before) => (before.includes(current) && before.includes(next) ? before : [...new Set([...before, current, next])]));
  }, [started, current, next]);

  useEffect(() => {
    if (!started || paused || hidden || reducedMotion !== false) return;
    const timer = window.setTimeout(() => setCurrent((index) => (index + 1) % SLIDE_COUNT), HERO_SLIDE_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [started, paused, hidden, reducedMotion, current, restart]);

  function showSlide(index: number) {
    setStarted(true); // a dot may be tapped in the first moments, before the page was idle
    setCurrent(index);
    setRestart((count) => count + 1);
  }

  const withControls = reducedMotion === false;

  return (
    <section
      aria-labelledby="hero-heading"
      className="on-dark relative flex flex-col bg-linear-to-tr from-pine-dark to-sky text-white lg:min-h-[85svh]"
    >
      <div className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 lg:z-10 lg:flex lg:items-end lg:pb-16 lg:pt-28">
        <div className="relative w-full min-w-0 lg:w-1/2 lg:pr-8">
          {children}
          {withControls && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4">
              <button
                type="button"
                onClick={() => setPaused((before) => !before)}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/70 px-4 text-base font-semibold text-white"
              >
                <DecorativeIcon icon={paused ? Play : Pause} />
                {paused ? "Play photos" : "Pause photos"}
              </button>
              <div role="group" aria-label="Choose a photo" className="flex">
                {HERO_SLIDES.map((slide, index) => (
                  <button
                    key={slide.name}
                    type="button"
                    onClick={() => showSlide(index)}
                    aria-label={`Show photo ${index + 1} of ${SLIDE_COUNT}: ${slide.shortName}`}
                    aria-current={index === current ? "true" : undefined}
                    className="flex h-12 w-7 items-center justify-center"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-3.5 w-3.5 rounded-full border-2 border-white ${index === current ? "bg-white" : "bg-transparent"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The photos come last in the page order (the heading, the search box and the controls are reached first, and the credit link last),
          and first on the screen: `order-first` on a phone and tablet, behind the text from 1024 px. */}
      <div className="relative order-first h-72 shrink-0 overflow-hidden md:h-80 lg:pointer-events-none lg:absolute lg:inset-0 lg:order-none lg:h-auto">
        {slidesInPage.map((index) => {
          const slide = HERO_SLIDES[index];
          const shown = index === current;
          return (
            <div
              key={slide.name}
              data-slide={slide.name}
              aria-hidden={shown ? undefined : true}
              className={`absolute inset-0 transition-opacity duration-[1500ms] motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
            >
              <picture className="block h-full">
                <source media={PHONE_SCREENS} srcSet={`${slide.phoneSrc} ${HERO_SIZES.phone.width}w`} sizes="100vw" />
                {/* A plain <img> on purpose: the fallback of the <picture>, a fixed size so nothing moves when it loads. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.wideSrc}
                  alt={shown ? slide.alt : ""}
                  width={HERO_SIZES.wide.width}
                  height={HERO_SIZES.wide.height}
                  loading={index === 0 ? undefined : "lazy"}
                  fetchPriority={index === 0 ? "high" : undefined}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </picture>
            </div>
          );
        })}
        {/* Decoration behind the white text: the veil under the header's links (6 rem, 80%), a light tint on a phone and tablet, and
            from 1024 px the overlay under the text (80% on the left, 30% on the right). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-pine-dark/35 lg:bg-transparent lg:bg-linear-to-r lg:from-pine-dark/80 lg:via-pine-dark/80 lg:via-55% lg:to-pine-dark/30"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-pine-dark/80 via-pine-dark/80 via-50% to-transparent"
        />
        <a
          href={HERO_CREDIT.href}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto absolute bottom-2 right-2 z-10 inline-flex min-h-12 items-center rounded-lg bg-pine-dark/90 px-3 text-base text-white underline"
        >
          {HERO_CREDIT.text}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>

    </section>
  );
}
