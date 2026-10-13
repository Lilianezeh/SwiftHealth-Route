// @vitest-environment jsdom
/** The logo: a map pin with a heartbeat line, and the wordmark SwiftHealth Route. Requirements: US-13, NFR-10. UI spec, "Layout";
 * revisions R38 and R39 (2026-10-13) in specs/2026-10-11-home-redesign/requirements.md. One reusable inline SVG component with
 * two tones (light and dark background). No red, no cross.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo, LogoPin } from "@/components/layout/Logo";

import { readSource } from "../helpers/source";

const PIN_BODY = "M18 45C10 35 2 26 2 17a16 16 0 0 1 32 0c0 9-8 18-16 28z"; // the shape of the map pins
const PULSE = "M7 18H12.5L15.2 11L19.4 25L22.3 18H29"; // the heartbeat line, inside the round head of the pin

describe("the logo's accessible name", () => {
  it("is SwiftHealth Route, once: one image with that label, and everything inside it hidden from screen readers", () => {
    const { container } = render(<Logo tone="dark" />);

    expect(screen.getAllByRole("img", { name: "SwiftHealth Route" })).toHaveLength(1);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg?.querySelector("title")).toBeNull();
    expect(container.querySelector('[class*="sr-only"]')).toBeNull(); // no second, hidden copy of the name
    expect(container.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThanOrEqual(2); // the SVG and the words
  });
});

describe("the pin", () => {
  it("is the shape of the map pins with a heartbeat line in its round head, and nothing else", () => {
    const { container } = render(<LogoPin tone="light" />);

    const paths = container.querySelectorAll("svg path");
    expect(paths).toHaveLength(2);
    expect(container.querySelector(".logo-pin__body")).toHaveAttribute("d", PIN_BODY);
    const pulse = container.querySelector(".logo-pin__pulse");
    expect(pulse).toHaveAttribute("d", PULSE);
    expect(pulse).toHaveAttribute("fill", "none");
    expect(pulse).toHaveAttribute("stroke-width", "2.4");
    expect(pulse).toHaveAttribute("stroke-linecap", "round");
    expect(pulse).toHaveAttribute("stroke-linejoin", "round");
  });

  it("has a fixed size, so the header does not jump while it loads", () => {
    const { container } = render(<LogoPin tone="light" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 36 46");
    expect(Number(svg?.getAttribute("width"))).toBeGreaterThan(0);
    expect(Number(svg?.getAttribute("height"))).toBeGreaterThan(0);
  });

  it("on a light background is sky blue with a white line", () => {
    const { container } = render(<LogoPin tone="light" />);

    expect(container.querySelector(".logo-pin__body")?.getAttribute("class")).toMatch(/\bfill-sky\b/);
    expect(container.querySelector(".logo-pin__pulse")?.getAttribute("class")).toMatch(/\bstroke-white\b/);
  });

  it("on a dark background (the blue bar, the dark hero) is white with a sky blue line", () => {
    const { container } = render(<LogoPin tone="dark" />);

    expect(container.querySelector(".logo-pin__body")?.getAttribute("class")).toMatch(/\bfill-white\b/);
    expect(container.querySelector(".logo-pin__pulse")?.getAttribute("class")).toMatch(/\bstroke-sky\b/);
  });
});

describe("the wordmark", () => {
  it("is SwiftHealth and Route, taken from the brand config", () => {
    render(<Logo tone="light" />);

    expect(screen.getByText("SwiftHealth")).toBeInTheDocument();
    expect(screen.getByText("Route")).toBeInTheDocument();
    expect(readSource("components/layout/Logo.tsx").replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/SwiftHealth|"Route"/);
  });

  it("on a light background is navy and blue: SwiftHealth in pine-dark, Route in sky", () => {
    render(<Logo tone="light" />);

    expect(screen.getByText("SwiftHealth").className).toMatch(/\btext-pine-dark\b/);
    expect(screen.getByText("Route").className).toMatch(/\btext-sky\b/);
  });

  it("on a dark background is white and light blue: SwiftHealth in white, Route in sky-pale", () => {
    render(<Logo tone="dark" />);

    expect(screen.getByText("SwiftHealth").className).toMatch(/\btext-white\b/);
    expect(screen.getByText("Route").className).toMatch(/\btext-sky-pale\b/);
  });

  it("is on one line from 640 px and stacked below: Route small, in letter-spaced capitals, under SwiftHealth", () => {
    render(<Logo tone="dark" />);

    const main = screen.getByText("SwiftHealth");
    const accent = screen.getByText("Route");
    const words = main.parentElement as HTMLElement;
    expect(accent.parentElement).toBe(words);
    expect(words.className).toMatch(/\bflex-col\b/); // stacked on a phone
    expect(words.className).toMatch(/\bsm:flex-row\b/); // one line from 640 px
    expect(accent.className).toMatch(/\buppercase\b/); // ROUTE (the words stay "Route" in the page)
    expect(accent.className).toMatch(/\btracking-\[0\.2\d*em\]/); // letter-spaced
    expect(accent.className).toMatch(/\btext-\[0\.625rem\]/); // 10 px
    expect(accent.className).toMatch(/\bsm:normal-case\b/);
    expect(accent.className).toMatch(/\bsm:tracking-normal\b/);
    expect(accent.className).toMatch(/\bsm:text-lg\b/); // as big as SwiftHealth from 640 px
    expect(main.className).toMatch(/\btext-base\b.*\bsm:text-lg\b/);
  });

  it("hides ROUTE below 360 px, and the whole wordmark below 344 px (only the pin), so the header fits 320 px (R40)", () => {
    render(<Logo tone="dark" />);

    // "ROUTE" goes first. In a real browser (Chromium, the widest fallback font) "SwiftHealth" alone still overflowed the screen
    // between 320 and 340 px and fits from 344 px, so below 344 px only the pin is drawn; the name stays for screen readers.
    expect(screen.getByText("Route").className).toMatch(/\bmax-\[359px\]:hidden\b/);
    const words = screen.getByText("SwiftHealth").parentElement as HTMLElement;
    expect(words.className).toMatch(/\bmax-\[344px\]:hidden\b/);
    expect(screen.getByText("SwiftHealth").className).not.toMatch(/\bmax-\[\d+px\]:hidden\b/);
    expect(screen.getByRole("img", { name: "SwiftHealth Route" })).toBeInTheDocument(); // the name is not hidden with the words
  });
});

describe("what the logo is not", () => {
  it("is not red and not a cross: no emergency colour, no hand-written colour, no plus", () => {
    const { container } = render(<Logo tone="dark" />);

    expect(container.innerHTML).not.toMatch(/emergency|#[0-9a-fA-F]{3,6}|rgb|M16 9h4v6h6v4h-6v6h-4v-6h-6v-4h6z/);
    expect(readSource("components/layout/Logo.tsx")).not.toMatch(/bg-emergency|text-emergency|fill-emergency/);
  });
});
