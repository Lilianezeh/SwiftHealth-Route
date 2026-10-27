"use client";

/** The faint background slideshow behind "Find by type", with its Pause button and its credit. Requirements: US-13, NFR-01, NFR-10, NFR-13,
 * WCAG 2.2.2 (a way to pause). Spec: specs/2026-10-22-home-photos/requirements.md (revision 4) and ui-spec 2.1; tested by
 * tests/unit/BackdropSlideshow.test.tsx.
 *
 * The heading and the tiles are passed in as `children` from the server: this component never changes them, and a change of photo never draws
 * them again. It draws three things around them: the photos (a layer behind the content), the Pause button and the credit (after the content).
 * What the visitor gets:
 * - Before any script: the first photo (in the HTML, lazy, with its size fixed) and the credit. Nothing else.
 * - Once the first photo has loaded and the page is idle, the next photo is added, one step ahead of its turn, so it is ready when it fades in.
 *   Only the first photo is asked for early; the section itself is `content-visibility: auto`, so even that waits until the section is near.
 * - Every 7 seconds the next photo fades in over 1.5 seconds (CSS `opacity`, no library). A Pause / Play button (48 px, with a text label) stops it.
 *   The photos also stop while the tab is hidden, and while the visitor has paused them.
 * - With "reduce motion" on: the first photo stays, still. No timer, no more photos, no fade, no Pause button (nothing moves).
 * The photos are decorative: no alt text, hidden from screen readers, under the content at BACKDROP_STRENGTH (45%) over the section's white
 * background. Every text is on a white surface (the tiles, the Pause button, the credit, and the heading's soft white backing in FindByType), so
 * WCAG AA holds whatever the photo is (tested with the worst case, a pure black pixel). The credit is one link for the whole slideshow, on a
 * white pill, never on a photo. Each photo has a focus point for a narrow and a wide screen (`object-position`, config/sitePhotos.ts), so a face is
 * never cut in half when the photo is cropped to fill the taller section.
 */
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { BACKDROP_PHOTOS, BACKDROP_STRENGTH, MAGNIFIC_CREDIT } from "@/config/sitePhotos";

const SLIDE_SECONDS = 7; // how long each photo stays
const PHOTO_COUNT = BACKDROP_PHOTOS.length;

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

type BackdropSlideshowProps = { children: ReactNode };

export function BackdropSlideshow({ children }: BackdropSlideshowProps) {
  const firstPhoto = useRef<HTMLImageElement>(null);
  const [current, setCurrent] = useState(0);
  const [firstLoaded, setFirstLoaded] = useState(false); // the first photo is in: only then are more photos asked for
  const [started, setStarted] = useState(false); // the first photo has loaded and the page is idle: more photos may be added and the photos may change
  const [paused, setPaused] = useState(false); // the visitor pressed Pause
  const [hidden, setHidden] = useState(false); // the tab is not shown
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null); // null until the browser has been asked (the server cannot know)
  const [added, setAdded] = useState<number[]>([0]); // the photos already in the page: they stay, so a fade never starts from nothing

  const next = (current + 1) % PHOTO_COUNT;
  const photosInPage = started ? [...new Set([...added, current, next])].sort((first, second) => first - second) : [0];

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)"); // an old browser without matchMedia just gets the slideshow
    setReducedMotion(query?.matches ?? false);
    if (!query) return;
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // The first photo may have loaded before this script ran (it is in the server's HTML), so the load event is not enough: ask the image too.
  useEffect(() => {
    if (firstPhoto.current?.complete && firstPhoto.current.naturalWidth > 0) setFirstLoaded(true);
  }, []);

  useEffect(() => {
    if (reducedMotion !== false || !firstLoaded) return; // reduce motion: one still photo, nothing else is ever added
    return whenPageIsIdle(() => setStarted(true));
  }, [reducedMotion, firstLoaded]);

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
    const timer = window.setTimeout(() => setCurrent((index) => (index + 1) % PHOTO_COUNT), SLIDE_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [started, paused, hidden, reducedMotion, current]);

  return (
    <>
      {/* The frame of the photos. Under 1024 px it is a band at the top of the section, as wide as the section and 3:2 like the photos, so each
          photo is shown WHOLE (nothing, no face, is cut) and fades out at its bottom edge into the section's tint; the heading and the cards
          start a little before the end of the band (the negative margin of the content below), so the faces are above them. From 1024 px
          the frame fills the whole section behind the cards, and each photo is cropped to fill it, around its focus point. */}
      <div
        data-backdrop-frame=""
        aria-hidden="true"
        className="pointer-events-none relative -z-10 aspect-[3/2] w-full [-webkit-mask-image:linear-gradient(to_bottom,black_60%,transparent)] [mask-image:linear-gradient(to_bottom,black_60%,transparent)] lg:absolute lg:inset-0 lg:aspect-auto lg:[-webkit-mask-image:none] lg:[mask-image:none]"
      >
        <div data-backdrop="" style={{ opacity: BACKDROP_STRENGTH }} className="absolute inset-0">
          {photosInPage.map((index) => (
            <div
              key={BACKDROP_PHOTOS[index].src}
              data-backdrop-slide=""
              className={`absolute inset-0 transition-opacity duration-[1500ms] motion-reduce:transition-none ${index === current ? "opacity-100" : "opacity-0"}`}
            >
              {/* A plain <img> on purpose: decorative, a fixed size so nothing moves when it loads, and files of ours. A phone (under 768 px)
                  always takes the 800 px file, whatever its pixel density (the <source>, like the hero's); a tablet or a laptop chooses between
                  the 800 px and the 1600 px file by its width and density (srcset and sizes). Still lazy: nothing is asked for before the section
                  is near. */}
              <picture>
                <source media="(max-width: 767px)" srcSet={BACKDROP_PHOTOS[index].src} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={index === 0 ? firstPhoto : undefined}
                  src={BACKDROP_PHOTOS[index].src}
                  srcSet={`${BACKDROP_PHOTOS[index].src} ${BACKDROP_PHOTOS[index].width}w, ${BACKDROP_PHOTOS[index].srcLarge} ${BACKDROP_PHOTOS[index].widthLarge}w`}
                  sizes="100vw"
                  alt=""
                  width={BACKDROP_PHOTOS[index].width}
                  height={BACKDROP_PHOTOS[index].height}
                  loading="lazy"
                  decoding="async"
                  onLoad={index === 0 ? () => setFirstLoaded(true) : undefined}
                  style={{ "--focus": BACKDROP_PHOTOS[index].focus } as CSSProperties}
                  className="h-full w-full object-cover lg:[object-position:var(--focus)]"
                />
              </picture>
            </div>
          ))}
        </div>
        {/* The light brand-blue tint over the photos (the wash). The tiles, the heading's backing, Pause and the credit are white, so every text
            is on a white surface whatever is under it. */}
        <div data-backdrop-tint="" className="absolute inset-0 bg-pine-100/40" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-0 -mt-[15%] lg:mt-0 lg:pb-16">
        {children}
        {/* The row of the controls is in the server's HTML from the first paint (its height is kept), so nothing moves when the Pause button
            appears after the script has run. The button says "Pause" or "Play" (its name for a screen reader is "Pause photos" / "Play photos"),
            so that it and the credit fit in one row on a phone. */}
        <div className="mt-4 flex min-h-12 flex-col items-start gap-2 md:mt-6 md:flex-row md:flex-wrap md:items-center md:gap-3">
          {/* Until the browser has been asked about reduced motion, an invisible copy of the Pause button keeps its place (same words, same
              type, so the same width in any font): the credit does not move when the button appears (CLS 0). */}
          {reducedMotion === null && (
            <span
              data-pause-space=""
              aria-hidden="true"
              className="invisible inline-flex min-h-12 items-center gap-2 rounded-xl border border-line px-3 text-base font-semibold md:px-4"
            >
              <span className="h-5 w-5" />
              Pause
            </span>
          )}
          {reducedMotion === false && (
            <button
              type="button"
              onClick={() => setPaused((before) => !before)}
              aria-label={paused ? "Play photos" : "Pause photos"}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-base font-semibold text-forest md:px-4"
            >
              <DecorativeIcon icon={paused ? Play : Pause} className="h-5 w-5" />
              {paused ? "Play" : "Pause"}
            </button>
          )}
          <a
            href={MAGNIFIC_CREDIT.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center rounded-xl bg-surface px-3 text-base font-semibold text-forest underline md:px-4"
          >
            {MAGNIFIC_CREDIT.text}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </>
  );
}
