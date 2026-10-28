// @vitest-environment jsdom
/** The photo slideshow of the home page hero. Requirements: US-13, NFR-01, NFR-10, NFR-13, WCAG 2.2.2 (a way to pause), 2.5.8 and the project's
 * 48 px targets. Spec: specs/2026-10-28-hero-slideshow/requirements.md. Fake timers drive the 6 seconds; reduce motion and the visibility of the tab
 * are stubbed; jsdom never loads an image, so each test says when a photo has loaded.
 * The first slide (the stethoscope) comes from the server as `children`; this component adds the other five after the page has loaded.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroSlideshow } from "@/components/home/HeroSlideshow";
import { HERO_SLIDES } from "@/config/sitePhotos";

import { readSource } from "../helpers/source";

const SLIDE_MS = 6000;
const COUNT = HERO_SLIDES.length + 1; // the stethoscope and the five

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion: reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

const first = (
  <picture>
    <img src="/images/home/hero3.webp" alt="A stethoscope on a white sheet." width={1600} height={1067} className="h-full w-full object-cover" />
  </picture>
);
const shade = <div data-test-shade="" aria-hidden="true" />;

function renderHero() {
  return render(
    <section>
      <HeroSlideshow shade={shade}>{first}</HeroSlideshow>
    </section>,
  );
}

async function pass(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

function slides(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-hero-slide]")];
}

/** The index (0 to 5) of the photo that is shown now: the slide with full opacity (the page holds only the slides that were added, so the place
 * of a slide in the page is not its index; `data-index` is). */
function shownIndex(container: HTMLElement): number {
  const slide = slides(container).find((candidate) => /\bopacity-100\b/.test(candidate.className));
  return slide ? Number(slide.getAttribute("data-index")) : -1;
}

/** Tells the component that every photo that is in the page has loaded (jsdom never loads an image). */
function everyPhotoLoads(container: HTMLElement) {
  act(() => {
    for (const image of container.querySelectorAll("[data-hero-slide] img")) fireEvent.load(image);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  stubReducedMotion(false);
  setVisibility("visible");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("what the server sends", () => {
  it("is the stethoscope only, with the controls, and none of the other photos, no credit and no script of its own", () => {
    const html = renderToString(
      <HeroSlideshow shade={shade}>{first}</HeroSlideshow>,
    );

    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain("/images/home/hero3.webp");
    for (const photo of HERO_SLIDES) expect(html).not.toContain(photo.src.split("/").pop());
    expect(html).not.toMatch(/Magnific/);
    expect(html).toContain("data-test-shade");
  });

  it("has the controls in the HTML: Previous, Next, Pause and one dot for each of the six photos", () => {
    const html = renderToString(
      <HeroSlideshow shade={shade}>{first}</HeroSlideshow>,
    );

    for (const label of ["Previous photo", "Next photo", "Pause photos"]) expect(html).toContain(`aria-label="${label}"`);
    for (let photo = 1; photo <= COUNT; photo++) expect(html).toContain(`aria-label="Photo ${photo} of ${COUNT}"`);
  });
});

describe("the first photo and the frame", () => {
  it("keeps the stethoscope's own <picture> and <img> as the server drew them, in the first slide", () => {
    const { container } = renderHero();

    const firstSlide = slides(container)[0];
    expect(firstSlide.querySelector("img")?.getAttribute("src")).toBe("/images/home/hero3.webp");
    expect(firstSlide.querySelector("img")?.className).toBe("h-full w-full object-cover");
    expect(firstSlide.className).toMatch(/\babsolute\b.*\binset-0\b/);
    expect(shownIndex(container)).toBe(0);
  });

  it("is a group named 'Photos' that a screen reader calls a carousel, with the veil from the server inside the frame", () => {
    const { container } = renderHero();

    const group = screen.getByRole("group", { name: "Photos" });
    expect(group).toHaveAttribute("aria-roledescription", "carousel");
    expect(group.querySelector("[data-test-shade]")).not.toBeNull();
    expect(container.querySelector("[data-hero-frame]")?.className).toMatch(/\[clip-path:polygon\(0_0,100%_0,100%_85%,0_100%\)\]/); // the same slanted edge as the stethoscope's band had
    expect(container.querySelector("[data-hero-frame]")?.className).toMatch(/lg:\[clip-path:polygon\(15%_0,100%_0,100%_100%,0_100%\)\]/);
  });

  it("has the band's size classes unchanged: 16 rem, 18 rem from 768 px, and from 1024 px the right half of the section (no layout change)", () => {
    const { container } = renderHero();

    const band = container.querySelector("[data-hero-band]") as HTMLElement;
    for (const name of ["relative", "h-64", "shrink-0", "md:h-72", "lg:absolute", "lg:inset-y-0", "lg:right-0", "lg:h-auto", "lg:w-1/2"]) {
      expect(band.className, name).toMatch(new RegExp(`(^|\\s)${name.replace(/[/:]/g, "\\$&")}(\\s|$)`));
    }
  });
});

describe("the other photos are asked for only after the page has loaded", () => {
  it("adds the next photo (and only that) once the page has loaded and a moment has passed, not before", async () => {
    const { container } = renderHero();
    expect(slides(container)).toHaveLength(1);

    await pass(100);
    expect(slides(container)).toHaveLength(1); // a short wait after the load event, so the photos never compete with the page
    await pass(300);

    expect(slides(container)).toHaveLength(2);
    expect(slides(container)[1].querySelector("img")?.getAttribute("src")).toBe(HERO_SLIDES[0].src);
  });

  it("gives each added photo its 800 px file for a phone, the 800 and 1600 px files by width for the rest, and its alt text", async () => {
    const { container } = renderHero();
    await pass(400);

    const picture = slides(container)[1].querySelector("picture") as HTMLElement;
    expect(picture.querySelector("source")?.getAttribute("media")).toBe("(max-width: 767px)");
    expect(picture.querySelector("source")?.getAttribute("srcset")).toBe(HERO_SLIDES[0].src);
    const image = picture.querySelector("img") as HTMLImageElement;
    expect(image.getAttribute("srcset")).toBe(`${HERO_SLIDES[0].src} 800w, ${HERO_SLIDES[0].srcLarge} 1600w`);
    expect(image.getAttribute("sizes")).toBe("(min-width: 1024px) 50vw, 100vw");
    expect(image.getAttribute("alt")).toBe(HERO_SLIDES[0].alt);
    expect(image).toHaveAttribute("width", "800");
    expect(image).toHaveAttribute("height", "533");
  });

  it("uses each photo's focus point for the band under 1024 px and its own for from 1024 px", async () => {
    const { container } = renderHero();
    await pass(400);

    const image = slides(container)[1].querySelector("img") as HTMLImageElement;
    expect(image.style.getPropertyValue("--focus")).toBe(HERO_SLIDES[0].focus);
    expect(image.style.getPropertyValue("--focus-wide")).toBe(HERO_SLIDES[0].focusWide);
    expect(image.className).toMatch(/\[object-position:var\(--focus\)\]/);
    expect(image.className).toMatch(/lg:\[object-position:var\(--focus-wide\)\]/);
    expect(image.className).toMatch(/\bobject-cover\b/);
  });

  it("asks for no other photo for a visitor who wants less motion, until the visitor presses a button", async () => {
    stubReducedMotion(true);
    const { container } = renderHero();

    await pass(SLIDE_MS * 3);

    expect(slides(container)).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("the automatic change, every 6 seconds, with a soft crossfade", () => {
  it("changes to the next photo 6 seconds after it has loaded, and through all six, round to the stethoscope again", async () => {
    const { container } = renderHero();
    await pass(400);
    everyPhotoLoads(container);

    for (let step = 1; step <= COUNT; step++) {
      await pass(SLIDE_MS);
      everyPhotoLoads(container);
      expect(shownIndex(container), `after ${step} changes`).toBe(step % COUNT);
      await pass(400); // the photo after it is added ahead of its turn
      everyPhotoLoads(container);
    }
  });

  it("does not change while the next photo has not loaded: the photo on show stays", async () => {
    const { container } = renderHero();
    await pass(400); // photo 2 is in the page, not loaded

    await pass(SLIDE_MS * 3);

    expect(shownIndex(container)).toBe(0);
  });

  it("fades with a transition of about a second on the slide's opacity only, and not at all for reduce motion", async () => {
    const { container } = renderHero();
    await pass(400);

    for (const slide of slides(container)) {
      expect(slide.className).toMatch(/\btransition-opacity\b/);
      expect(slide.className).toMatch(/\bduration-\[1200ms\]/);
      expect(slide.className).toMatch(/\bmotion-reduce:transition-none\b/);
    }
  });

  it("hides the photos that are not on show from a screen reader, and shows the photo that is", async () => {
    const { container } = renderHero();
    await pass(400);

    expect(slides(container)[0]).toHaveAttribute("aria-hidden", "false");
    expect(slides(container)[1]).toHaveAttribute("aria-hidden", "true");
  });

  it("stops while the tab is hidden and goes on when it is shown again", async () => {
    const { container } = renderHero();
    await pass(400);
    everyPhotoLoads(container);

    setVisibility("hidden");
    await pass(SLIDE_MS * 4);
    expect(shownIndex(container)).toBe(0);

    setVisibility("visible");
    await pass(SLIDE_MS);
    expect(shownIndex(container)).toBe(1);
  });
});

describe("Pause and Play (WCAG 2.2.2)", () => {
  it("is a visible 48 px button named 'Pause photos'; it holds the photo, then says 'Play photos', and Play starts the 6 seconds again", async () => {
    const { container } = renderHero();
    await pass(400);
    everyPhotoLoads(container);

    const pause = screen.getByRole("button", { name: "Pause photos" });
    expect(pause.className).toMatch(/\bmin-h-12\b/);
    expect(pause.className).toMatch(/\bmin-w-12\b/);
    expect(pause.querySelector("svg.lucide-pause")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(pause);
    await pass(SLIDE_MS * 3);
    expect(shownIndex(container)).toBe(0);

    const play = screen.getByRole("button", { name: "Play photos" });
    expect(play.querySelector("svg.lucide-play")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(play);
    await pass(SLIDE_MS);
    expect(shownIndex(container)).toBe(1);
  });
});

describe("the buttons and the dots", () => {
  it("have Previous, Next and one dot for each photo, each at least 48 px, each a real button with an aria-label", () => {
    renderHero();

    const buttons = [
      screen.getByRole("button", { name: "Previous photo" }),
      screen.getByRole("button", { name: "Next photo" }),
      screen.getByRole("button", { name: "Pause photos" }),
      ...Array.from({ length: COUNT }, (_, index) => screen.getByRole("button", { name: `Photo ${index + 1} of ${COUNT}` })),
    ];
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
      expect(button.className, button.getAttribute("aria-label") ?? "").toMatch(/\bmin-h-12\b/);
      expect(button.className, button.getAttribute("aria-label") ?? "").toMatch(/\bmin-w-12\b/);
    }
    expect(screen.getByRole("group", { name: "Choose a photo" })).toBeInTheDocument();
  });

  it("go to the next and the previous photo, round the end, and wait for a photo that has not loaded without a gap", async () => {
    const { container } = renderHero();
    await pass(400);

    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(shownIndex(container)).toBe(0); // photo 2 has not loaded: the stethoscope stays, no empty frame
    everyPhotoLoads(container);
    await pass(10);
    expect(shownIndex(container)).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    await pass(10);
    expect(shownIndex(container)).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Previous photo" })); // from the first to the last: that photo is added now
    everyPhotoLoads(container);
    await pass(10);
    expect(shownIndex(container)).toBe(COUNT - 1);
    expect(slides(container)[slides(container).length - 1].querySelector("img")?.getAttribute("src")).toBe(HERO_SLIDES[HERO_SLIDES.length - 1].src);
  });

  it("jump to any photo with its dot, and mark the one on show with aria-current", async () => {
    const { container } = renderHero();
    await pass(400);

    expect(screen.getByRole("button", { name: `Photo 1 of ${COUNT}` })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: `Photo 4 of ${COUNT}` }));
    everyPhotoLoads(container);
    await pass(10);

    expect(shownIndex(container)).toBe(3);
    expect(screen.getByRole("button", { name: `Photo 4 of ${COUNT}` })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: `Photo 1 of ${COUNT}` })).not.toHaveAttribute("aria-current");
  });

  it("work from the keyboard: Tab reaches them and Enter and Space press them", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const { container } = renderHero();

    await user.tab();
    const focused = document.activeElement as HTMLElement;
    expect(focused.tagName).toBe("BUTTON");
    screen.getByRole("button", { name: "Next photo" }).focus();
    await user.keyboard("{Enter}");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    everyPhotoLoads(container);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(shownIndex(container)).toBe(1);

    screen.getByRole("button", { name: "Pause photos" }).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Play photos" })).toBeInTheDocument();
  });

  it("tell a screen reader which photo is on show after a button is pressed, in a polite live region, and say nothing for the automatic change", async () => {
    const { container } = renderHero();
    await pass(400);
    everyPhotoLoads(container);
    const region = container.querySelector("[data-hero-announcement]") as HTMLElement;
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.className).toMatch(/\bsr-only\b/);

    await pass(SLIDE_MS);
    expect(shownIndex(container)).toBe(1);
    expect(region.textContent).toBe(""); // the automatic change is silent

    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    everyPhotoLoads(container);
    await pass(10);
    expect(region.textContent).toBe(`Photo 3 of ${COUNT}`);
  });
});

describe("with reduce motion", () => {
  it("changes nothing by itself: no timer, no Pause button, but Previous, Next and the dots still work", async () => {
    stubReducedMotion(true);
    const { container } = renderHero();

    await pass(SLIDE_MS * 3);
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.queryByRole("button", { name: /Pause photos|Play photos/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Next photo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(slides(container)).toHaveLength(2); // that photo is asked for now, because the visitor asked for it
    everyPhotoLoads(container);
    await pass(10);
    expect(shownIndex(container)).toBe(1);
    await pass(SLIDE_MS * 3);
    expect(shownIndex(container)).toBe(1); // and nothing else changes by itself
  });
});

describe("the photos are shown as they are: full brightness, in both modes", () => {
  it("puts no filter, wash, tint or theme class on any slide, its picture or its image: only opacity 0 or 100 on the slide", async () => {
    const { container } = renderHero();
    await pass(400);
    everyPhotoLoads(container);
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    await pass(10);

    for (const slide of slides(container)) {
      const classes = [slide, ...slide.querySelectorAll("picture, img")].map((element) => element.className).join(" ");
      expect(classes).not.toMatch(/\bdark:|brightness|saturate|contrast|grayscale|sepia|blur|hue-rotate|mix-blend|backdrop-|bg-/);
      expect(classes.match(/\bopacity-\d+/g)?.every((value) => value === "opacity-0" || value === "opacity-100")).toBe(true);
    }
    const frame = container.querySelector("[data-hero-frame]") as HTMLElement;
    expect(frame.className).not.toMatch(/\bdark:|filter|brightness|opacity-|bg-/);
    expect(container.querySelectorAll("[data-hero-frame] > *:not([data-hero-slide]):not([data-test-shade])")).toHaveLength(0); // nothing else over the photos
  });
});

describe("the source", () => {
  it("is the one client part of the hero, has no credit and no outside address, and no colour of its own", () => {
    const source = readSource("components/home/HeroSlideshow.tsx");

    expect(source).toMatch(/^"use client";/);
    expect(source).not.toMatch(/Magnific|https?:\/\//);
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|rgba\(/);
  });
});
