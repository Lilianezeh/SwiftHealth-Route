// @vitest-environment jsdom
/** The faint background slideshow behind "Find by type". Requirements: US-13, NFR-01, NFR-10, NFR-13. Spec: specs/2026-10-22-home-photos/
 * requirements.md (revision 4) and ui-spec 2.1 (revision of 2026-10-23). Fake timers drive the 7 seconds; reduce motion and the visibility of the
 * tab are stubbed. The photos are decorative (no alt text, hidden from screen readers) and faint (18%), so every text passes WCAG AA (4.5:1) even
 * over a pure black photo pixel.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BackdropSlideshow } from "@/components/home/BackdropSlideshow";
import { FindByType } from "@/components/home/FindByType";
import { BACKDROP_PHOTOS, MAGNIFIC_CREDIT } from "@/config/sitePhotos";

import { contrast, laidOver, tokenColour } from "../helpers/contrast";
import { readSource } from "../helpers/source";

const SLIDE_MS = 7000;
const FADE_MS = 1500;

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

function renderSlideshow() {
  return render(
    <section>
      <BackdropSlideshow>
        <h2>The heading</h2>
        <ul>
          <li>
            <a href="/search">A tile</a>
          </li>
        </ul>
      </BackdropSlideshow>
    </section>,
  );
}

async function pass(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

/** The photos in the page, with the slides' wrapper: which one is shown is the one with opacity-100. */
function slides(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-backdrop-slide]")];
}

function shownIndex(container: HTMLElement): number {
  return slides(container).findIndex((slide) => /\bopacity-100\b/.test(slide.className));
}

/** Tells the slideshow that its first photo has loaded (jsdom never loads an image). */
function firstPhotoLoads(container: HTMLElement) {
  act(() => {
    fireEvent.load(container.querySelector("img") as HTMLElement);
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

describe("the first photo", () => {
  it("is the only photo in the HTML the server sends, lazy and fixed in size, with the credit and no control: the page works before any script", () => {
    const html = renderToString(
      <BackdropSlideshow>
        <h2>x</h2>
      </BackdropSlideshow>,
    );

    expect(html).toContain(BACKDROP_PHOTOS[0].src);
    expect(html).not.toContain(BACKDROP_PHOTOS[1].src);
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain(MAGNIFIC_CREDIT.text);
    expect(html).not.toMatch(/Pause|Play/);
    expect(html).toMatch(/loading="lazy"/);
    expect(html).toMatch(/width="960"/);
    expect(html).toMatch(/height="640"/);
  });

  it("is decorative: empty alt text, the whole layer hidden from screen readers, never in the tab order", () => {
    const { container } = renderSlideshow();

    const image = container.querySelector("img") as HTMLImageElement;
    expect(image).toHaveAttribute("alt", "");
    expect(image.closest("[aria-hidden='true']")).not.toBeNull();
    expect(image.closest("[data-backdrop]")?.className).toMatch(/\bpointer-events-none\b/);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("the other photos", () => {
  it("are not added before the first has loaded, and then only after the page is idle, one ahead of their turn", async () => {
    const { container } = renderSlideshow();

    await pass(3000);
    expect(container.querySelectorAll("img")).toHaveLength(1); // the first has not loaded: nothing else is asked for

    firstPhotoLoads(container);
    expect(container.querySelectorAll("img")).toHaveLength(1); // not at once either: after the page is idle
    await pass(1000);

    const sources = [...container.querySelectorAll("img")].map((image) => image.getAttribute("src"));
    expect(sources).toEqual([BACKDROP_PHOTOS[0].src, BACKDROP_PHOTOS[1].src]);
  });

  it("change every 7 seconds with a 1.5 second fade, the next one is added ahead, and they go round", async () => {
    const { container } = renderSlideshow();
    firstPhotoLoads(container);
    await pass(1000);
    expect(shownIndex(container)).toBe(0);
    expect(slides(container)[0].className).toMatch(/\bduration-\[1500ms\]/);
    expect(FADE_MS).toBe(1500);

    await pass(SLIDE_MS);
    expect(shownIndex(container)).toBe(1);
    expect(container.querySelectorAll("img")).toHaveLength(3);

    for (let step = 0; step < 4; step += 1) await pass(SLIDE_MS); // 2, 3, 4, then round to the first again
    expect(shownIndex(container)).toBe(0);
    expect(container.querySelectorAll("img")).toHaveLength(BACKDROP_PHOTOS.length);
  });

  it("show the five photos in the owner's order: clinic, hospital, maternity, laboratory, pharmacy", async () => {
    const { container } = renderSlideshow();
    firstPhotoLoads(container);
    await pass(1000);
    const seen: string[] = [];

    for (let step = 0; step < BACKDROP_PHOTOS.length; step += 1) {
      seen.push(slides(container)[shownIndex(container)].querySelector("img")?.getAttribute("src") ?? "");
      await pass(SLIDE_MS);
    }

    expect(seen).toEqual(BACKDROP_PHOTOS.map((photo) => photo.src));
  });

  it("are all hidden from screen readers and cover the section behind the content, at 18% strength", () => {
    const { container } = renderSlideshow();

    const layer = container.querySelector("[data-backdrop]") as HTMLElement;
    expect(layer.className).toMatch(/\babsolute\b/);
    expect(layer.className).toMatch(/\binset-0\b/);
    expect(layer.className).toMatch(/(^|\s)-z-10(\s|$)/); // under the heading, the tiles and the controls
    expect(layer.className).toMatch(/\bopacity-\[0\.18\]/);
  });

  it("leave the heading and the tiles alone: they are the very same elements after the photos changed", async () => {
    const { container } = renderSlideshow();
    const heading = screen.getByRole("heading", { level: 2 });
    const tile = screen.getByRole("link", { name: "A tile" });
    firstPhotoLoads(container);
    await pass(1000);

    await pass(SLIDE_MS * 3);

    expect(screen.getByRole("heading", { level: 2 })).toBe(heading);
    expect(screen.getByRole("link", { name: "A tile" })).toBe(tile);
  });

  it("start no timer before the first photo has loaded, and leave none behind when the page is closed", async () => {
    const { container, unmount } = renderSlideshow();
    await pass(2000);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(0);

    firstPhotoLoads(container);
    await pass(1000);
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Pause and Play", () => {
  it("is a 48 px button with a text label; it holds the photo and then says Play, and Play starts the 7 seconds again", async () => {
    const { container } = renderSlideshow();
    firstPhotoLoads(container);
    await pass(1000);

    const pause = screen.getByRole("button", { name: "Pause photos" });
    expect(pause.className).toMatch(/\bmin-h-12\b/);
    expect(pause.textContent).toContain("Pause");
    fireEvent.click(pause);
    await pass(SLIDE_MS * 3);

    expect(shownIndex(container)).toBe(0);
    expect(screen.queryByRole("button", { name: "Pause photos" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Play photos" }));
    await pass(SLIDE_MS - 100);
    expect(shownIndex(container)).toBe(0);
    await pass(200);
    expect(shownIndex(container)).toBe(1);
  });

  it("is after the tiles in the page and has room kept for it from the first paint, so nothing moves when it appears", () => {
    const html = renderToString(
      <BackdropSlideshow>
        <h2>x</h2>
      </BackdropSlideshow>,
    );

    expect(html).toMatch(/min-h-12/); // the row of the controls exists in the server's HTML, empty
    const { container } = renderSlideshow();
    const tile = screen.getByRole("link", { name: "A tile" });
    const pause = screen.getByRole("button", { name: "Pause photos" });
    expect(tile.compareDocumentPosition(pause) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });
});

describe("a hidden tab", () => {
  it("stops the photos while the page is hidden and starts the 7 seconds again when it is shown", async () => {
    const { container } = renderSlideshow();
    firstPhotoLoads(container);
    await pass(1000);

    setVisibility("hidden");
    await pass(SLIDE_MS * 5);
    expect(shownIndex(container)).toBe(0);

    setVisibility("visible");
    await pass(SLIDE_MS - 100);
    expect(shownIndex(container)).toBe(0);
    await pass(200);
    expect(shownIndex(container)).toBe(1);
  });

  it("does not start again on its own when the visitor had paused it", async () => {
    const { container } = renderSlideshow();
    firstPhotoLoads(container);
    await pass(1000);
    fireEvent.click(screen.getByRole("button", { name: "Pause photos" }));

    setVisibility("hidden");
    setVisibility("visible");
    await pass(SLIDE_MS * 3);

    expect(shownIndex(container)).toBe(0);
  });
});

describe("reduce motion", () => {
  it("shows one still faint photo: no timer, no fade, no other photo in the page, no Pause button", async () => {
    stubReducedMotion(true);
    const { container } = renderSlideshow();
    firstPhotoLoads(container);

    await pass(SLIDE_MS * 5);

    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(shownIndex(container)).toBe(0);
    expect(screen.queryByRole("button")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the credit, the heading and the tiles", () => {
    stubReducedMotion(true);
    renderSlideshow();

    expect(screen.getByRole("link", { name: /Designed by Magnific/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A tile" })).toBeInTheDocument();
  });

  it("has no transition for a still photo: the fade classes are off with motion-reduce", () => {
    const { container } = renderSlideshow();

    expect(slides(container)[0].className).toMatch(/\bmotion-reduce:transition-none\b/);
  });
});

describe("the credit", () => {
  it("is one 'Designed by Magnific' link to www.magnific.com: new tab, safe, 16 px text, a 48 px tap area, on a white pill, after the tiles", () => {
    renderSlideshow();

    const credit = screen.getByRole("link", { name: /^Designed by Magnific/ });
    expect(screen.getAllByRole("link", { name: /magnific/i })).toHaveLength(1);
    expect(credit).toHaveAttribute("href", "https://www.magnific.com");
    expect(credit).toHaveAttribute("target", "_blank");
    expect(credit.getAttribute("rel")).toContain("noopener");
    expect(credit.getAttribute("rel")).toContain("noreferrer");
    expect(credit.className).toMatch(/\btext-base\b/);
    expect(credit.className).toMatch(/\bmin-h-12\b/);
    expect(credit.className).toMatch(/\bbg-white\b/); // never on a photo
    expect(credit.className).not.toMatch(/\babsolute\b/);
    expect(screen.getByRole("link", { name: "A tile" }).compareDocumentPosition(credit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is the same element, with the same words, on every photo: never one for each photo", async () => {
    const { container } = renderSlideshow();
    const credit = screen.getByRole("link", { name: /^Designed by Magnific/ });
    firstPhotoLoads(container);
    await pass(1000);

    await pass(SLIDE_MS * 3);

    expect(screen.getByRole("link", { name: /^Designed by Magnific/ })).toBe(credit);
    expect(container.textContent?.match(/Designed by Magnific/g)).toHaveLength(1);
  });
});

describe("all text passes WCAG AA, even over the darkest possible photo pixel", () => {
  const WORST_CASE = laidOver("#000000", tokenColour("pine-50"), 0.18); // a pure black pixel at 18% over the section's light blue

  it("has 18% in the code, and the heading in pine-dark is at least 4.5:1 on the worst case", () => {
    expect(readSource("components/home/BackdropSlideshow.tsx")).toMatch(/opacity-\[0\.18\]/);
    expect(contrast(tokenColour("pine-dark"), WORST_CASE)).toBeGreaterThanOrEqual(4.5);
  });

  it("puts the heading of Find by type in pine-dark, the colour that was tested", () => {
    const { container } = render(<FindByType />);

    expect(screen.getByRole("heading", { level: 2, name: "Find by type" }).className).toMatch(/\btext-pine-dark\b/);
    expect(container.querySelector("section")?.className).toMatch(/\bbg-pine-50\b/);
  });

  it("has the credit and the Pause button on white, with forest text, at least 4.5:1", () => {
    expect(contrast(tokenColour("forest"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    renderSlideshow();

    for (const control of [screen.getByRole("link", { name: /Designed by Magnific/ }), screen.getByRole("button", { name: "Pause photos" })]) {
      expect(control.className).toMatch(/\bbg-white\b/);
      expect(control.className).toMatch(/\btext-forest\b/);
    }
  });

  it("is decorated only with tokens: no colour written as a number", () => {
    expect(readSource("components/home/BackdropSlideshow.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});

describe("the section of Find by type", () => {
  it("is the one place of the slideshow, with the five tiles inside it, and it waits until it is near the screen (content-visibility)", () => {
    const { container } = render(<FindByType />);

    const section = container.querySelector("section") as HTMLElement;
    expect(section.className).toMatch(/\bsection-lazy\b/);
    expect(section.className).toMatch(/\brelative\b/);
    expect(section.className).toMatch(/\bisolate\b/); // so the layer stays behind the content of this section only
    expect(section.className).toMatch(/\boverflow-hidden\b/);
    expect(section.querySelector("[data-backdrop]")).not.toBeNull();
    expect(screen.getAllByRole("link", { name: /Hospital|Clinic|Maternity|Pharmacy|Laboratory/ })).toHaveLength(5);
    expect(readSource("styles/globals.css")).toMatch(/\.section-lazy\s*\{[^}]*content-visibility:\s*auto/);
  });
});

describe("the size kept for the section until it is drawn (no layout shift)", () => {
  const css = readSource("styles/globals.css");

  it("is the measured height of the section on a phone (662 px), a tablet (504 px) and a laptop (374 px)", () => {
    expect(css).toMatch(/\.section-lazy\s*\{[^}]*contain-intrinsic-size:\s*auto 662px/);
    expect(css).toMatch(/@media \(min-width: 768px\)\s*\{\s*\.section-lazy\s*\{[^}]*auto 504px/);
    expect(css).toMatch(/@media \(min-width: 1024px\)\s*\{\s*\.section-lazy\s*\{[^}]*auto 374px/);
  });
});
