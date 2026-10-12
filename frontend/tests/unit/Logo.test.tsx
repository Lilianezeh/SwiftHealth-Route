// @vitest-environment jsdom
/** The logo: a map pin with a plus, an inline SVG. Requirements: US-13, NFR-10. UI spec, "Layout"; revision R16 (2026-10-12) in
 * specs/2026-10-11-home-redesign/requirements.md. Next to the word SwiftHealth in the header. No red cross.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo } from "@/components/layout/Logo";

import { readSource } from "../helpers/source";

describe("the logo", () => {
  it("is an inline SVG that screen readers skip, because the word next to it names the link", () => {
    const { container } = render(<Logo />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg?.querySelector("title")).toBeNull();
  });

  it("draws a pin with a white plus inside it, and nothing else", () => {
    const { container } = render(<Logo />);

    const paths = container.querySelectorAll("svg path");
    expect(paths).toHaveLength(2);
    expect(container.querySelector(".logo-pin__body")).not.toBeNull();
    expect(container.querySelector(".logo-pin__plus")).not.toBeNull();
  });

  it("has the pin in the bright blue accent with a thin white edge, and the plus in white", () => {
    const { container } = render(<Logo />);

    expect(container.querySelector(".logo-pin__body")?.getAttribute("class")).toMatch(/\bfill-accent\b/);
    expect(container.querySelector(".logo-pin__body")?.getAttribute("class")).toMatch(/\bstroke-white\b/);
    expect(container.querySelector(".logo-pin__plus")?.getAttribute("class")).toMatch(/\bfill-white\b/);
  });

  it("is not red and is not a cross by itself: no emergency colour, no hand-written colour", () => {
    const { container } = render(<Logo />);

    expect(container.innerHTML).not.toMatch(/emergency|red|#[0-9a-fA-F]{3,6}|rgb/i);
    expect(readSource("components/layout/Logo.tsx")).not.toMatch(/emergency/);
  });

  it("has a fixed size, so the header does not jump while it loads", () => {
    const { container } = render(<Logo />);

    const svg = container.querySelector("svg");
    expect(Number(svg?.getAttribute("width"))).toBeGreaterThan(0);
    expect(Number(svg?.getAttribute("height"))).toBeGreaterThan(0);
    expect(svg).toHaveAttribute("viewBox");
  });
});
