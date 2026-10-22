// @vitest-environment jsdom
/** The gentle fade-and-slide of the photos of the home page. Requirements: US-13, NFR-01 (no layout shift), NFR-10. Spec:
 * specs/2026-10-22-home-photos/requirements.md part 3. A photo starts 24 px lower and transparent and, when it scrolls into view, fades and slides
 * to its place once (CSS transition, an IntersectionObserver, no library). Without scripts, or when the observer is missing, the photo is simply
 * shown. With "reduce motion" nothing moves at all: the script does not even start, and the CSS has no hidden state.
 */
import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Reveal } from "@/components/home/Reveal";

type ObserverCall = { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; observed: Element[]; disconnected: boolean };
const observers: ObserverCall[] = [];

function stubObserver() {
  observers.length = 0;
  class FakeObserver {
    private readonly record: ObserverCall;
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.record = { callback, options, observed: [], disconnected: false };
      observers.push(this.record);
    }
    observe(element: Element) {
      this.record.observed.push(element);
    }
    unobserve() {}
    disconnect() {
      this.record.disconnected = true;
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
}

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion: reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function intersect(record: ObserverCall, isIntersecting: boolean) {
  act(() => {
    record.callback([{ isIntersecting, target: record.observed[0] } as unknown as IntersectionObserverEntry], record as unknown as IntersectionObserver);
  });
}

beforeEach(() => {
  stubObserver();
  stubReducedMotion(false);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the photo before and after the script", () => {
  it("is in the server's HTML with no hidden mark: without JavaScript the photo is simply shown", () => {
    const html = renderToString(
      <Reveal>
        <img src="/x.webp" alt="x" />
      </Reveal>,
    );

    expect(html).toContain("/x.webp");
    expect(html).not.toContain("data-reveal");
  });

  it("starts hidden after the script runs, and is shown once it scrolls into view", () => {
    const { container } = render(
      <Reveal>
        <img src="/x.webp" alt="x" />
      </Reveal>,
    );
    const wrapper = container.firstElementChild as HTMLElement;

    expect(wrapper).toHaveAttribute("data-reveal", "hidden");
    expect(observers).toHaveLength(1);
    expect(observers[0].observed).toEqual([wrapper]);

    intersect(observers[0], true);

    expect(wrapper).toHaveAttribute("data-reveal", "revealed");
  });

  it("does not show it while it is outside the screen, only when 15% of it is in view", () => {
    const { container } = render(<Reveal><img src="/x.webp" alt="x" /></Reveal>);

    intersect(observers[0], false);

    expect(container.firstElementChild).toHaveAttribute("data-reveal", "hidden");
    expect(observers[0].options?.threshold).toBe(0.15);
  });

  it("happens once: after it is shown the observer is disconnected and the photo stays", () => {
    const { container } = render(<Reveal><img src="/x.webp" alt="x" /></Reveal>);

    intersect(observers[0], true);

    expect(observers[0].disconnected).toBe(true);
    intersect(observers[0], false);
    expect(container.firstElementChild).toHaveAttribute("data-reveal", "revealed");
  });

  it("disconnects the observer when the page is closed", () => {
    const { unmount } = render(<Reveal><img src="/x.webp" alt="x" /></Reveal>);

    unmount();

    expect(observers[0].disconnected).toBe(true);
  });

  it("leaves the photo alone, shown, in a browser that has no IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<Reveal><img src="/x.webp" alt="x" /></Reveal>);

    expect(container.firstElementChild).not.toHaveAttribute("data-reveal");
  });
});

describe("reduce motion", () => {
  it("never starts: no observer, no hidden mark, the photo is shown at once", () => {
    stubReducedMotion(true);
    const { container } = render(<Reveal><img src="/x.webp" alt="x" /></Reveal>);

    expect(observers).toHaveLength(0);
    expect(container.firstElementChild).not.toHaveAttribute("data-reveal");
  });
});

describe("the CSS", () => {
  const css = readFileSync(join(process.cwd(), "src", "styles", "globals.css"), "utf8");
  const reveal = css.slice(css.indexOf(".photo-reveal"));

  it("has the hidden start state only inside @media (prefers-reduced-motion: no-preference)", () => {
    const guard = css.indexOf("@media (prefers-reduced-motion: no-preference)");

    expect(guard).toBeGreaterThan(-1);
    expect(css.indexOf(".photo-reveal")).toBeGreaterThan(guard);
    expect(css.slice(0, guard)).not.toMatch(/photo-reveal/); // nowhere before the guard
  });

  it("slides 24 px and fades in 0.8 s, and moves only opacity and transform (the layout never shifts)", () => {
    expect(reveal).toMatch(/translateY\(24px\)/);
    expect(reveal).toMatch(/opacity:\s*0/);
    expect(reveal).toMatch(/800ms/);
    expect(reveal).toMatch(/transition:\s*opacity 800ms[^;]*,\s*transform 800ms/);
    expect(reveal).not.toMatch(/\b(height|width|margin|padding|top|left)\s*:/);
  });

  it("hides only a photo that the script has marked hidden", () => {
    expect(reveal).toMatch(/\.photo-reveal\[data-reveal="hidden"\]/);
    expect(reveal).not.toMatch(/\.photo-reveal\s*\{[^}]*opacity:\s*0/); // the bare class hides nothing
  });
});
