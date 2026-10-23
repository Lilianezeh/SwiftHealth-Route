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
 * The photos are decorative: no alt text, hidden from screen readers, under the content at BACKDROP_STRENGTH (about 40%) over the section's white
 * background. Every text is on a white surface (the tiles, the Pause button, the credit, and the heading's soft white backing in FindByType), so
 * WCAG AA holds whatever the photo is (tested with the worst case, a pure black pixel). The credit is one link for the whole slideshow, on a
 * white pill, never on a photo. Each photo has a focus point for a narrow and a wide screen (`object-position`, config/sitePhotos.ts), so a face is
 * never cut in half when the photo is cropped to fill the taller section.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
      <div
        data-backdrop=""
        aria-hidden="true"
        style={{ opacity: BACKDROP_STRENGTH }}
        className="pointer-events-none absolute inset-0 -z-10"
      >
        {photosInPage.map((index) => (
          <div
            key={BACKDROP_PHOTOS[index].src}
            data-backdrop-slide=""
            className={`absolute inset-0 transition-opacity duration-[1500ms] motion-reduce:transition-none ${index === current ? "opacity-100" : "opacity-0"}`}
          >
            {/* A plain <img> on purpose: decorative, a fixed size so nothing moves when it loads, and a small file of ours. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={index === 0 ? firstPhoto : undefined}
              src={BACKDROP_PHOTOS[index].src}
              alt=""
              width={BACKDROP_PHOTOS[index].width}
              height={BACKDROP_PHOTOS[index].height}
              loading="lazy"
              decoding="async"
              onLoad={index === 0 ? () => setFirstLoaded(true) : undefined}
              style={
                {
                  "--focus-narrow": BACKDROP_PHOTOS[index].focus.narrow,
                  "--focus-wide": BACKDROP_PHOTOS[index].focus.wide,
                } as CSSProperties
              }
              className="h-full w-full object-cover [object-position:var(--focus-narrow)] md:[object-position:var(--focus-wide)]"
            />
          </div>
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-6 md:py-12 lg:py-16">
        {children}
        {/* The row of the controls is in the server's HTML from the first paint (its height is kept), so nothing moves when the Pause button
            appears after the script has run. The button says "Pause" or "Play" (its name for a screen reader is "Pause photos" / "Play photos"),
            so that it and the credit fit in one row on a phone. */}
        <div className="mt-4 flex min-h-12 flex-wrap items-center gap-2 md:mt-6 md:gap-3">
          {reducedMotion === false && (
            <button
              type="button"
              onClick={() => setPaused((before) => !before)}
              aria-label={paused ? "Play photos" : "Pause photos"}
              className="inline-flex min-h-12 items-center rounded-xl border border-line bg-white px-3 text-base font-semibold text-forest md:px-4"
            >
              {paused ? "Play" : "Pause"}
            </button>
          )}
          <a
            href={MAGNIFIC_CREDIT.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center rounded-xl bg-white px-3 text-base font-semibold text-forest underline md:px-4"
          >
            {MAGNIFIC_CREDIT.text}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </>
  );
}
