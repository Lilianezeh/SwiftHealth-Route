// @vitest-environment jsdom
/** The faint background slideshow behind "Find by type". Requirements: US-13, NFR-01, NFR-10, NFR-13. Spec: specs/2026-10-22-home-photos/
 * requirements.md (revision 4) and ui-spec 2.1 (revision of 2026-10-23). Fake timers drive the 7 seconds; reduce motion and the visibility of the
 * tab are stubbed. The photos are decorative (no alt text, hidden from screen readers) and at 45%, with every text on a white surface, so every text passes WCAG AA (4.5:1) even
 * over a pure black photo pixel.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BackdropSlideshow } from "@/components/home/BackdropSlideshow";
import { FindByType } from "@/components/home/FindByType";
import { BACKDROP_PHOTOS, BACKDROP_STRENGTH, MAGNIFIC_CREDIT } from "@/config/sitePhotos";

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
    expect(html).toMatch(/width="800"/);
    expect(html).toMatch(/height="533"/);
  });

  it("is decorative: empty alt text, the whole layer hidden from screen readers, never in the tab order", () => {
    const { container } = renderSlideshow();

    const image = container.querySelector("img") as HTMLImageElement;
    expect(image).toHaveAttribute("alt", "");
    expect(image.closest("[aria-hidden='true']")).not.toBeNull();
    expect(image.closest("[data-backdrop-frame]")?.className).toMatch(/\bpointer-events-none\b/);
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

  it("are all hidden from screen readers and cover the section behind the content, at the strength of the config (45%)", () => {
    const { container } = renderSlideshow();

    const frame = container.querySelector("[data-backdrop-frame]") as HTMLElement;
    const layer = container.querySelector("[data-backdrop]") as HTMLElement;
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(frame.className).toMatch(/\bpointer-events-none\b/);
    expect(frame.className).toMatch(/(^|\s)-z-10(\s|$)/); // under the heading, the tiles and the controls
    expect(frame.contains(layer)).toBe(true);
    expect(BACKDROP_STRENGTH).toBe(0.45); // the owner's choice, 2026-10-23
    expect(layer.style.opacity).toBe("0.45");
  });

  it("are shown whole in a 3:2 band under 1024 px, with a fade at its bottom edge, and fill the whole section behind the cards from 1024 px", () => {
    const { container } = renderSlideshow();

    const frame = container.querySelector("[data-backdrop-frame]") as HTMLElement;
    expect(frame.className).toMatch(/\baspect-\[3\/2\]/); // as wide as the section and 3:2 like the photos: no photo is cropped, no face is cut
    expect(frame.className).toMatch(/\bw-full\b/);
    expect(frame.className).toMatch(/\[mask-image:linear-gradient\(to_bottom,black_60%,transparent\)\]/); // it fades into the tint at its bottom edge
    expect(frame.className).toMatch(/\blg:absolute\b/);
    expect(frame.className).toMatch(/\blg:inset-0\b/);
    expect(frame.className).toMatch(/\blg:aspect-auto\b/);
    expect(frame.className).toMatch(/\blg:\[mask-image:none\]/);
    expect(container.querySelector("[data-backdrop-tint]")?.className).toMatch(/\bbg-pine-100\/40\b/); // the light brand-blue tint over the photos
  });

  it("give each photo one focus point for the wide screens, where it is cropped, so a face is never cut in half", () => {
    const { container } = renderSlideshow();

    const image = container.querySelector("img") as HTMLImageElement;
    expect(image.style.getPropertyValue("--focus")).toBe(BACKDROP_PHOTOS[0].focus);
    expect(image.className).toMatch(/\blg:\[object-position:var\(--focus\)\]/);
  });

  it("come in two sizes: the 800 px file for phones and tablets, the 1600 px file for wide screens (srcset and sizes), still lazy", () => {
    const { container } = renderSlideshow();

    // A phone (under 768 px) always takes the 800 px file, whatever its pixel density: a <source> for it, like the hero's. A srcset with sizes would
    // have sent the 1600 px file to a phone with a 2x screen (Lighthouse's phone did exactly that). Everyone else chooses by width and density.
    const source = container.querySelector("picture > source") as HTMLSourceElement;
    expect(source).toHaveAttribute("media", "(max-width: 767px)");
    expect(source).toHaveAttribute("srcset", BACKDROP_PHOTOS[0].src);
    const image = container.querySelector("picture > img") as HTMLImageElement;
    expect(image).toHaveAttribute("src", BACKDROP_PHOTOS[0].src);
    expect(image.getAttribute("srcset")).toBe(`${BACKDROP_PHOTOS[0].src} 800w, ${BACKDROP_PHOTOS[0].srcLarge} 1600w`);
    expect(image.getAttribute("sizes")).toBe("100vw");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("width", "800");
    expect(image).toHaveAttribute("height", "533");
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
    expect(pause.querySelector("svg.lucide-pause")).toHaveAttribute("aria-hidden", "true"); // a pause icon, decoration only: the text names the button
    fireEvent.click(pause);
    await pass(SLIDE_MS * 3);

    expect(shownIndex(container)).toBe(0);
    expect(screen.queryByRole("button", { name: "Pause photos" })).toBeNull();

    const play = screen.getByRole("button", { name: "Play photos" });
    expect(play.querySelector("svg.lucide-play")).toHaveAttribute("aria-hidden", "true"); // and a play icon while it is paused
    expect(play.querySelector("svg.lucide-pause")).toBeNull();
    fireEvent.click(play);
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
    expect(credit.className).toMatch(/\bbg-surface\b/); // never on a photo
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
  // A pure black photo pixel at the chosen strength over the section's light blue (pine-50), then the light brand-blue tint (pine-100 at 40%) over it:
  // the worst case under any text that is not on a white surface.
  const WORST_BACKGROUND = laidOver(tokenColour("pine-100"), laidOver("#000000", tokenColour("pine-50"), BACKDROP_STRENGTH), 0.4);

  it("has the heading of Find by type on a soft white backing (bg-surface/90) in its own forest colour, at least 4.5:1 on the worst case", () => {
    render(<FindByType />);

    const heading = screen.getByRole("heading", { level: 2, name: "Find by type" });
    const backing = Number(/\bbg-surface\/(\d+)\b/.exec(heading.className)?.[1]) / 100;
    expect(backing).toBeGreaterThanOrEqual(0.9);
    expect(heading.className).toMatch(/\btext-forest\b/);
    expect(heading.className).toMatch(/\brounded-xl\b/);
    expect(heading.className).toMatch(/\bpx-4\b/); // padding: the backing is a soft pill around the words, like the Pause button
    expect(contrast(tokenColour("forest"), laidOver("#ffffff", WORST_BACKGROUND, backing))).toBeGreaterThanOrEqual(4.5);
  });

  it("has the section in the light brand blue (pine-50, with the pine-100 tint over the photos) and the tiles on white cards, forest text, at least 4.5:1", () => {
    const { container } = render(<FindByType />);

    expect(container.querySelector("section")?.className).toMatch(/\bbg-pine-50\b/); // not the grey-white of the first version of revision 5
    expect(container.querySelector("section")?.className).not.toMatch(/\bbg-surface\b/);
    for (const tile of screen.getAllByRole("link", { name: /Hospital|Clinic|Maternity|Pharmacy|Laboratory/ })) {
      expect(tile.className).toMatch(/\bbg-surface\b/);
    }
    expect(contrast(tokenColour("forest"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(WORST_BACKGROUND).not.toBe("#ffffff"); // the photo is really visible: the worst case is clearly darker than white
  });

  it("has the credit and the Pause button on white, with forest text, at least 4.5:1", () => {
    expect(contrast(tokenColour("forest"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    renderSlideshow();

    for (const control of [screen.getByRole("link", { name: /Designed by Magnific/ }), screen.getByRole("button", { name: "Pause photos" })]) {
      expect(control.className).toMatch(/\bbg-surface\b/);
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

  it("is the height the section really has: 51.67% of the width + 802 px on a phone, + 564 px on a tablet, 760 px on a laptop (measured at 13 widths)", () => {
    expect(css).toMatch(/\.section-lazy\s*\{[^}]*contain-intrinsic-size:\s*auto calc\(51\.67vw \+ 802px\)/);
    expect(css).toMatch(/@media \(min-width: 768px\)\s*\{\s*\.section-lazy\s*\{[^}]*auto calc\(51\.67vw \+ 564px\)/);
    expect(css).toMatch(/@media \(min-width: 1024px\)\s*\{\s*\.section-lazy\s*\{[^}]*auto 760px/);
  });
});

describe("the layout of the section (revision 6)", () => {
  it("has the heading and the cards in the lower part: the content at the bottom, pulled 15% of the width up over the photo band under 1024 px, and a 760 px section from 1024 px", () => {
    const { container } = render(<FindByType />);

    const section = container.querySelector("section") as HTMLElement;
    expect(section.className).toMatch(/\bflex\b/);
    expect(section.className).toMatch(/\bflex-col\b/);
    expect(section.className).toMatch(/\bjustify-end\b/); // the content sits at the bottom, the faces above it
    expect(section.className).toMatch(/\blg:min-h-\[760px\]/);
    const content = container.querySelector("[data-backdrop-frame] + div") as HTMLElement;
    expect(content.className).toMatch(/(^|\s)-mt-\[15%\](\s|$)/);
    expect(content.className).toMatch(/\blg:mt-0\b/);
  });

  it("puts Pause and the credit in two rows on a phone and in one row from 768 px (a fixed height, whatever the width)", () => {
    renderSlideshow();

    const row = screen.getByRole("button", { name: "Pause photos" }).parentElement as HTMLElement;
    expect(row.className).toMatch(/\bflex-col\b/);
    expect(row.className).toMatch(/\bitems-start\b/);
    expect(row.className).toMatch(/\bmd:flex-row\b/);
  });

  it("makes the cards 190 px high with 64 px icons and 20 px names, and a 16 px line under each name (the owner's words)", () => {
    const { container } = render(<FindByType />);

    const words: Record<string, string> = {
      Hospital: "Admission, surgery and emergency care",
      Clinic: "Check-ups and everyday treatment",
      Maternity: "Antenatal care and childbirth",
      Pharmacy: "Medicines and advice",
      Laboratory: "Tests and results",
    };
    for (const [name, line] of Object.entries(words)) {
      const card = screen.getByRole("link", { name }); // the name is still just the label: the line is the description
      expect(card.className).toMatch(/\bh-\[190px\]/);
      const label = container.querySelector(`#type-name-${name.toLowerCase()}`) as HTMLElement;
      const description = container.querySelector(`#type-line-${name.toLowerCase()}`) as HTMLElement;
      expect(label.textContent).toBe(name);
      expect(label.className).toMatch(/\btext-xl\b/); // 20 px
      expect(description.textContent).toBe(line);
      expect(description.className).toMatch(/\btext-base\b/); // 16 px
      expect(card).toHaveAttribute("aria-labelledby", `type-name-${name.toLowerCase()}`);
      expect(card).toHaveAccessibleDescription(line);
      const icon = card.querySelector("span") as HTMLElement;
      expect(icon.className).toMatch(/\bmd:h-16\b/); // 64 px (56 px on a phone)
      expect(icon.className).toMatch(/\bmd:w-16\b/);
      expect(icon.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("lifts a card a little on hover and on keyboard focus (transform only, so nothing moves around it), and not at all with reduce motion", () => {
    render(<FindByType />);

    for (const card of screen.getAllByRole("link", { name: /Hospital|Clinic|Maternity|Pharmacy|Laboratory/ })) {
      expect(card.className).toMatch(/\bhover:-translate-y-1\b/);
      expect(card.className).toMatch(/\bfocus-visible:-translate-y-1\b/);
      expect(card.className).toMatch(/\bhover:shadow-lg\b/);
      expect(card.className).toMatch(/\bduration-200\b/);
      expect(card.className).toMatch(/\bmotion-reduce:transition-none\b/);
      expect(card.className).toMatch(/\bmotion-reduce:hover:translate-y-0\b/);
      expect(card.className).toMatch(/\bmotion-reduce:focus-visible:translate-y-0\b/);
    }
  });

  it("keeps the five tiles at 48 px or more with 16 px text, two columns on a phone with the last tile centred, one row on a laptop", () => {
    const { container } = render(<FindByType />);

    const list = container.querySelector("ul") as HTMLElement;
    expect(list.className).toMatch(/\bgrid-cols-4\b/); // two tiles of two columns each on a phone
    expect(list.className).toMatch(/\bmd:grid-cols-6\b/); // three tiles of two columns each on a tablet
    expect(list.className).toMatch(/\blg:grid-cols-5\b/); // one row of five on a laptop
    const tiles = [...container.querySelectorAll<HTMLElement>("li")];
    expect(tiles).toHaveLength(5);
    for (const item of tiles) expect(item.className).toMatch(/\bcol-span-2\b/);
    expect(tiles[4].className).toMatch(/\bcol-start-2\b/); // the fifth tile alone in the last row of a phone: in the middle
    expect(tiles[3].className).toMatch(/\bmd:col-start-2\b/); // the fourth tile of a tablet: the last row of two is in the middle
    expect(tiles[4].className).toMatch(/\bmd:col-start-auto\b/);
    expect(tiles[0].className).toMatch(/\blg:col-span-1\b/);
    for (const tile of screen.getAllByRole("link", { name: /Hospital|Clinic|Maternity|Pharmacy|Laboratory/ })) {
      expect(tile.className).toMatch(/\bh-\[190px\]/); // never under 48 px
      expect(tile.className).not.toMatch(/\btext-(xs|sm)\b/);
    }
  });
});
