// @vitest-environment jsdom
/** The photo slider of the home hero. Requirements: US-13, NFR-01, NFR-10, NFR-13. Spec: specs/2026-10-22-home-photos/requirements.md part 2,
 * ui-spec 2.1 (revision of 2026-10-22). Fake timers drive the 6 seconds; the browser's reduce-motion setting and tab visibility are stubbed.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroSlider } from "@/components/home/HeroSlider";
import { HERO_CREDIT, HERO_SLIDE_SECONDS, HERO_SLIDES } from "@/config/heroPhotos";

const SIX_SECONDS = HERO_SLIDE_SECONDS * 1000;

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion: reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function renderSlider() {
  return render(
    <HeroSlider>
      <h1>The fixed heading</h1>
      <form role="search">
        <input aria-label="Search" />
      </form>
    </HeroSlider>,
  );
}

async function pass(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

/** The photos on the page that a screen reader can reach: the ones with alt text. */
function seenPhotos(container: HTMLElement): string[] {
  return [...container.querySelectorAll("img")].filter((image) => image.alt !== "").map((image) => image.alt);
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
  it("is the only photo in the page at first, with its alt text, fixed size, high priority and a phone file in a <picture>", () => {
    const { container } = renderSlider();

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("alt", HERO_SLIDES[0].alt);
    expect(images[0]).toHaveAttribute("src", HERO_SLIDES[0].wideSrc);
    expect(images[0]).toHaveAttribute("width", "1280");
    expect(images[0]).toHaveAttribute("height", "800");
    expect(images[0].getAttribute("fetchpriority")).toBe("high");
    expect(images[0].getAttribute("loading")).not.toBe("lazy");
    const source = container.querySelector("picture > source");
    expect(source).toHaveAttribute("media", "(max-width: 767px)");
    expect(source).toHaveAttribute("srcset", `${HERO_SLIDES[0].phoneSrc} 640w`);
    expect(container.innerHTML).not.toContain(HERO_SLIDES[1].name);
  });

  it("is in the HTML the server sends, with the credit and no control: the page works before any script", () => {
    const html = renderToString(
      <HeroSlider>
        <h1>x</h1>
      </HeroSlider>,
    );

    expect(html).toContain(HERO_SLIDES[0].wideSrc);
    expect(html).toContain(HERO_SLIDES[0].phoneSrc);
    expect(html).toContain(HERO_CREDIT.text);
    expect(html).not.toContain(HERO_SLIDES[1].wideSrc);
    expect(html).not.toMatch(/Pause|Play|Show photo/);
  });
});

describe("the other photos", () => {
  it("are added one ahead of their turn, after the page has loaded, and a photo that is not shown is hidden from screen readers", async () => {
    const { container } = renderSlider();
    expect(container.querySelectorAll("img")).toHaveLength(1);

    await pass(1000);

    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(2);
    expect(images[1]).toHaveAttribute("src", HERO_SLIDES[1].wideSrc);
    expect(images[1]).toHaveAttribute("alt", "");
    expect(images[1].closest("[aria-hidden='true']")).not.toBeNull();
    expect(images[1]).toHaveAttribute("loading", "lazy");
    expect(seenPhotos(container)).toEqual([HERO_SLIDES[0].alt]);
  });

  it("change after 6 seconds, one at a time; the next is added ahead, and only the shown photo has alt text", async () => {
    const { container } = renderSlider();
    await pass(1000);

    await pass(SIX_SECONDS);

    expect(seenPhotos(container)).toEqual([HERO_SLIDES[1].alt]);
    expect(container.querySelectorAll("img")).toHaveLength(3);
    await pass(SIX_SECONDS);
    expect(seenPhotos(container)).toEqual([HERO_SLIDES[2].alt]);
  });

  it("fade: the shown photo is opaque, the others are transparent, with a 1.5 second transition that reduce motion removes", async () => {
    const { container } = renderSlider();
    await pass(1000);

    const [first, second] = [...container.querySelectorAll("img")].map((image) => image.closest("[data-slide]") as HTMLElement);
    expect(first.className).toMatch(/\bopacity-100\b/);
    expect(second.className).toMatch(/\bopacity-0\b/);
    expect(first.className).toMatch(/\bduration-\[1500ms\](\s|$)/);
    expect(first.className).toMatch(/\bmotion-reduce:transition-none\b/);
  });

  it("go round: after the eighth photo comes the first again", async () => {
    const { container } = renderSlider();
    await pass(1000);

    for (let step = 0; step < HERO_SLIDES.length; step += 1) await pass(SIX_SECONDS);

    expect(seenPhotos(container)).toEqual([HERO_SLIDES[0].alt]);
    expect(container.querySelectorAll("img")).toHaveLength(HERO_SLIDES.length);
  });

  it("leave the heading and the search box alone: they are the very same elements after the photos changed", async () => {
    renderSlider();
    const heading = screen.getByRole("heading", { level: 1 });
    const search = screen.getByRole("search");
    await pass(1000);

    await pass(SIX_SECONDS * 3);

    expect(screen.getByRole("heading", { level: 1 })).toBe(heading);
    expect(screen.getByRole("search")).toBe(search);
  });

  it("start no timer before they are needed and leave none behind when the page is closed", async () => {
    const { unmount } = renderSlider();
    await pass(1000);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Pause and Play", () => {
  it("shows a Pause button of at least 48 px with a text label; it holds the photo and then says Play", async () => {
    const { container } = renderSlider();
    await pass(1000);

    const pause = screen.getByRole("button", { name: "Pause photos" });
    expect(pause.className).toMatch(/\bmin-h-12\b/);
    expect(pause.textContent).toContain("Pause");
    fireEvent.click(pause);
    await pass(SIX_SECONDS * 4);

    expect(seenPhotos(container)).toEqual([HERO_SLIDES[0].alt]);
    expect(screen.getByRole("button", { name: "Play photos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause photos" })).toBeNull();
  });

  it("starts the photos again with Play: the next one comes after 6 seconds", async () => {
    const { container } = renderSlider();
    await pass(1000);
    fireEvent.click(screen.getByRole("button", { name: "Pause photos" }));
    await pass(SIX_SECONDS * 2);

    fireEvent.click(screen.getByRole("button", { name: "Play photos" }));
    await pass(SIX_SECONDS - 100);
    expect(seenPhotos(container)).toEqual([HERO_SLIDES[0].alt]);
    await pass(200);

    expect(seenPhotos(container)).toEqual([HERO_SLIDES[1].alt]);
  });
});

describe("the dots", () => {
  it("are one button for each photo, 48 px high, named 'Show photo N of 8: <short name>', with aria-current on the shown one", async () => {
    renderSlider();
    await pass(1000);

    const group = screen.getByRole("group", { name: "Choose a photo" });
    const dots = within(group).getAllByRole("button");
    expect(dots).toHaveLength(8);
    dots.forEach((dot, index) => {
      expect(dot).toHaveAccessibleName(`Show photo ${index + 1} of 8: ${HERO_SLIDES[index].shortName}`);
      expect(dot.className).toMatch(/\bh-12\b/);
      expect(dot.className).toMatch(/\bw-7\b/); // 28 px wide: eight dots and the Pause button fit a 320 px screen
    });
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    expect(dots[1]).not.toHaveAttribute("aria-current");
  });

  it("show the photo that was tapped, add the one after it, and start the 6 seconds again", async () => {
    const { container } = renderSlider();
    await pass(1000);
    await pass(SIX_SECONDS - 1000); // 5 seconds into the first photo

    fireEvent.click(screen.getByRole("button", { name: /^Show photo 5 of 8/ }));
    await act(async () => {});
    expect(seenPhotos(container)).toEqual([HERO_SLIDES[4].alt]);
    expect(screen.getByRole("button", { name: /^Show photo 5 of 8/ })).toHaveAttribute("aria-current", "true");
    expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(3);

    await pass(SIX_SECONDS - 500); // the old timer would have fired by now
    expect(seenPhotos(container)).toEqual([HERO_SLIDES[4].alt]);
    await pass(600);
    expect(seenPhotos(container)).toEqual([HERO_SLIDES[5].alt]);
  });

  it("keep a paused slider paused: a tapped dot shows its photo and nothing moves after it", async () => {
    const { container } = renderSlider();
    await pass(1000);
    fireEvent.click(screen.getByRole("button", { name: "Pause photos" }));

    fireEvent.click(screen.getByRole("button", { name: /^Show photo 3 of 8/ }));
    await pass(SIX_SECONDS * 3);

    expect(seenPhotos(container)).toEqual([HERO_SLIDES[2].alt]);
  });
});

describe("a hidden tab", () => {
  it("stops the photos while the page is hidden and starts the 6 seconds again when it is shown", async () => {
    const { container } = renderSlider();
    await pass(1000);

    setVisibility("hidden");
    await pass(SIX_SECONDS * 5);
    expect(seenPhotos(container)).toEqual([HERO_SLIDES[0].alt]);

    setVisibility("visible");
    await pass(SIX_SECONDS - 100);
    expect(seenPhotos(container)).toEqual([HERO_SLIDES[0].alt]);
    await pass(200);
    expect(seenPhotos(container)).toEqual([HERO_SLIDES[1].alt]);
  });

  it("does not start again on its own when the visitor had paused it", async () => {
    const { container } = renderSlider();
    await pass(1000);
    fireEvent.click(screen.getByRole("button", { name: "Pause photos" }));

    setVisibility("hidden");
    setVisibility("visible");
    await pass(SIX_SECONDS * 3);

    expect(seenPhotos(container)).toEqual([HERO_SLIDES[0].alt]);
  });
});

describe("reduce motion", () => {
  it("shows one still photo (the first), no timer, no other photo in the page, and no Pause button and no dots", async () => {
    stubReducedMotion(true);
    const { container } = renderSlider();

    await pass(SIX_SECONDS * 5);

    expect(seenPhotos(container)).toEqual([HERO_SLIDES[0].alt]);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("group", { name: "Choose a photo" })).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the credit and the text of the hero", () => {
    stubReducedMotion(true);
    renderSlider();

    expect(screen.getByRole("link", { name: /Designed by Magnific/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

describe("the credit", () => {
  it("is one 'Designed by Magnific' link to www.magnific.com, in a new tab, safe, 16 px text and a 48 px tap area", () => {
    renderSlider();

    const credit = screen.getByRole("link", { name: /^Designed by Magnific/ });
    expect(credit).toHaveAttribute("href", "https://www.magnific.com");
    expect(credit).toHaveAttribute("target", "_blank");
    expect(credit.getAttribute("rel")).toContain("noopener");
    expect(credit.getAttribute("rel")).toContain("noreferrer");
    expect(credit.className).toMatch(/\btext-base\b/);
    expect(credit.className).toMatch(/\bmin-h-12\b/);
  });

  it("is the same element, with the same words, on every slide: one link only, never one for each photo", async () => {
    const { container } = renderSlider();
    const credit = screen.getByRole("link", { name: /^Designed by Magnific/ });
    await pass(1000);

    await pass(SIX_SECONDS * 3);

    expect(screen.getAllByRole("link", { name: /magnific/i })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /^Designed by Magnific/ })).toBe(credit);
    expect(container.textContent?.match(/Designed by Magnific/g)).toHaveLength(1);
  });

  it("sits in the lower right corner of the photo area, over a dark chip, not over the text", () => {
    renderSlider();

    const credit = screen.getByRole("link", { name: /^Designed by Magnific/ });
    expect(credit.className).toMatch(/\babsolute\b/);
    expect(credit.className).toMatch(/\bbottom-\S+/);
    expect(credit.className).toMatch(/\bright-\S+/);
    expect(credit.className).toMatch(/\bbg-pine-dark\/\d+/);
    expect(credit.className).toMatch(/\btext-white\b/);
  });
});
