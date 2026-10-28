"use client";

/** The photo band of the home page hero: the stethoscope first, then five photos that change by themselves and by hand. Requirements: US-13,
 * NFR-01, NFR-10, NFR-13, WCAG 2.2.2 (a way to pause). Spec: specs/2026-10-28-hero-slideshow/requirements.md; tested by
 * tests/unit/HeroSlideshow.test.tsx and tests/end-to-end/hero-slideshow.spec.ts.
 *
 * The first slide is the stethoscope exactly as the server draws it (`children`: its <picture>, eager, high priority, the phone file for phones), so the
 * hero's own photo is still the first thing the page asks for. `shade` is the veil under the header, drawn by the server too. What the visitor gets:
 * - Before any script: the stethoscope and the controls. The band has its size and its slanted edge from the classes below, so nothing moves.
 * - Once the page has loaded and a moment has passed, the next photo is added, one step ahead of its turn. A photo that is asked for by hand
 *   (a button or a dot) is added then. Under "reduce motion" nothing is added by itself.
 * - Every 6 seconds, 6 seconds after the next photo has loaded, it fades in over 1.2 seconds (CSS `opacity`, no library). A photo that has not loaded
 *   is never shown: the one on show stays until it has. A Pause / Play button (48 px) stops the timer; so does a hidden tab.
 * - Previous, Next and one dot for each photo (all 48 px, real buttons with an aria-label) change the photo by hand, with a polite announcement.
 * - With "reduce motion" on: no timer, no Pause button (nothing moves by itself); the buttons and the dots still work.
 * The photos are shown as they are: full brightness in both modes, no filter, wash or tint on them (owner, 2026-10-28). The only thing over them is the
 * veil under the header (`shade`) and the controls. Every control has a dark fill and a white edge, so it stands out from a bright photo (the fill) and
 * from a dark one (the edge). Each photo has a focus point for the band under 1024 px and one from 1024 px (config/sitePhotos.ts), so a face is not cut.
 */
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { HERO_SLIDES } from "@/config/sitePhotos";

const SLIDE_SECONDS = 6; // how long each photo stays
const PHOTO_COUNT = HERO_SLIDES.length + 1; // the stethoscope, then the five

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

const CONTROL =
  "inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-snow bg-pine text-white shadow-card " +
  "focus-visible:shadow-[0_0_0_2px_var(--color-pine-dark)] disabled:opacity-50";

type HeroSlideshowProps = {
  /** The stethoscope's <picture>, as the server draws it. */
  children: ReactNode;
  /** The veil under the header, over the photos. */
  shade: ReactNode;
};

export function HeroSlideshow({ children, shade }: HeroSlideshowProps) {
  const [shown, setShown] = useState(0); // the photo on show
  const [wanted, setWanted] = useState(0); // the photo that is to be shown as soon as it has loaded
  const [loaded, setLoaded] = useState<number[]>([0]); // the stethoscope is in the server's HTML and is the first thing the page asks for
  const [added, setAdded] = useState<number[]>([0]); // the photos in the page: they stay, so a fade never starts from nothing
  const [started, setStarted] = useState(false); // the page has loaded and is idle: the next photo may be added and the photos may change
  const [paused, setPaused] = useState(false); // the visitor pressed Pause
  const [hidden, setHidden] = useState(false); // the tab is not shown
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null); // null until the browser has been asked (the server cannot know)
  const [message, setMessage] = useState(""); // what a screen reader is told after a button was pressed
  const toldNext = useRef(false); // the next change of photo was asked for by hand: announce it

  const upcoming = (shown + 1) % PHOTO_COUNT;
  const upcomingLoaded = loaded.includes(upcoming);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)"); // an old browser without matchMedia just gets the slideshow
    setReducedMotion(query?.matches ?? false);
    if (!query) return;
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion !== false) return; // reduce motion: nothing is asked for before the visitor asks
    return whenPageIsIdle(() => setStarted(true));
  }, [reducedMotion]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The next photo is added one step ahead of its turn, so it is ready when it fades in.
  useEffect(() => {
    if (started) setAdded((before) => (before.includes(upcoming) ? before : [...before, upcoming]));
  }, [started, upcoming]);

  // A photo is shown only once it has loaded: until then the photo on show stays (no empty frame).
  useEffect(() => {
    if (wanted !== shown && loaded.includes(wanted)) setShown(wanted);
  }, [wanted, shown, loaded]);

  useEffect(() => {
    if (toldNext.current && wanted === shown) {
      toldNext.current = false;
      setMessage(`Photo ${shown + 1} of ${PHOTO_COUNT}`);
    }
  }, [shown, wanted]);

  useEffect(() => {
    if (!started || paused || hidden || reducedMotion !== false || !upcomingLoaded) return;
    const timer = window.setTimeout(() => setWanted(upcoming), SLIDE_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [started, paused, hidden, reducedMotion, shown, upcoming, upcomingLoaded]);

  function go(index: number) {
    const target = (index + PHOTO_COUNT) % PHOTO_COUNT;
    if (target === shown && target === wanted) return;
    toldNext.current = true;
    setAdded((before) => (before.includes(target) ? before : [...before, target]));
    setWanted(target);
  }

  function markLoaded(index: number) {
    setLoaded((before) => (before.includes(index) ? before : [...before, index]));
  }

  const photosInPage = [...added].sort((first, second) => first - second);

  return (
    <div
      data-hero-band=""
      role="group"
      aria-roledescription="carousel"
      aria-label="Photos"
      className="relative h-64 shrink-0 md:h-72 lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-1/2"
    >
      {/* The frame: the same box and the same slanted edge as the stethoscope's band had. Under 1024 px the bottom edge slants, from 1024 px the left edge. */}
      <div
        data-hero-frame=""
        className="absolute inset-0 [clip-path:polygon(0_0,100%_0,100%_85%,0_100%)] lg:[clip-path:polygon(15%_0,100%_0,100%_100%,0_100%)]"
      >
        {photosInPage.map((index) => (
          <div
            key={index}
            data-hero-slide=""
            data-index={index}
            aria-hidden={index !== shown}
            className={`absolute inset-0 transition-opacity duration-[1200ms] motion-reduce:transition-none ${index === shown ? "opacity-100" : "opacity-0"}`}
          >
            {index === 0 ? (
              children
            ) : (
              /* A plain <img> on purpose: files of ours with a fixed size, so nothing moves when one loads. A phone (under 768 px) always takes the
                 800 px file, whatever its pixel density; a wider screen chooses between the 800 px and the 1600 px file by its width and density
                 (the band is half the screen from 1024 px). */
              <picture className="block h-full">
                <source media="(max-width: 767px)" srcSet={HERO_SLIDES[index - 1].src} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={(image) => {
                    if (image?.complete && image.naturalWidth > 0) markLoaded(index);
                  }}
                  src={HERO_SLIDES[index - 1].src}
                  srcSet={`${HERO_SLIDES[index - 1].src} ${HERO_SLIDES[index - 1].width}w, ${HERO_SLIDES[index - 1].srcLarge} ${HERO_SLIDES[index - 1].widthLarge}w`}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  alt={HERO_SLIDES[index - 1].alt}
                  width={HERO_SLIDES[index - 1].width}
                  height={HERO_SLIDES[index - 1].height}
                  decoding="async"
                  onLoad={() => markLoaded(index)}
                  style={{ "--focus": HERO_SLIDES[index - 1].focus, "--focus-wide": HERO_SLIDES[index - 1].focusWide } as CSSProperties}
                  className="h-full w-full object-cover [object-position:var(--focus)] lg:[object-position:var(--focus-wide)]"
                />
              </picture>
            )}
          </div>
        ))}
        {shade}
      </div>

      {/* The controls: over the photo, at the bottom of the band, outside the clipped frame so the slanted edge never cuts them. Up to 479 px two
          rows (the dots, then Previous, Next and Pause), hanging 16 px below the band; from 480 px one row at the bottom left. */}
      <div
        data-hero-controls=""
        className="absolute inset-x-0 -bottom-4 z-10 flex flex-wrap items-center justify-center gap-2 px-4 min-[480px]:bottom-0 min-[480px]:justify-start lg:bottom-6 lg:left-14 lg:right-auto lg:px-0"
      >
        <button type="button" aria-label="Previous photo" onClick={() => go(shown - 1)} className={CONTROL}>
          <DecorativeIcon icon={ChevronLeft} className="h-6 w-6" />
        </button>
        <div role="group" aria-label="Choose a photo" className="order-first flex basis-full justify-center min-[480px]:order-none min-[480px]:basis-auto">
          {Array.from({ length: PHOTO_COUNT }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Photo ${index + 1} of ${PHOTO_COUNT}`}
              aria-current={index === shown ? "true" : undefined}
              onClick={() => go(index)}
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full focus-visible:shadow-[0_0_0_2px_var(--color-pine-dark)]"
            >
              <span className={`block h-4 w-4 rounded-full border-2 shadow-card ${index === shown ? "border-pine bg-snow" : "border-snow bg-pine"}`} />
            </button>
          ))}
        </div>
        <button type="button" aria-label="Next photo" onClick={() => go(shown + 1)} className={CONTROL}>
          <DecorativeIcon icon={ChevronRight} className="h-6 w-6" />
        </button>
        {reducedMotion !== true && (
          <button type="button" aria-label={paused ? "Play photos" : "Pause photos"} onClick={() => setPaused((before) => !before)} className={CONTROL}>
            <DecorativeIcon icon={paused ? Play : Pause} className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* A polite live region without role="status" (the page has its own status messages): it speaks only after a button was pressed. */}
      <span data-hero-announcement="" aria-live="polite" className="sr-only">
        {message}
      </span>
    </div>
  );
}
