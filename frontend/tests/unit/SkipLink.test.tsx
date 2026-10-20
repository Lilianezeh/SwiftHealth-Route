// @vitest-environment jsdom
/** The skip link and the main landmark. Requirements: NFR-10 (works with a keyboard and a screen reader), NFR-04.
 * UI spec 2.10 ("Skip link and titles"); decision D5 in specs/2026-10-20-info-pages/requirements.md.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageFrame } from "@/components/layout/PageFrame";

describe("the skip link", () => {
  it("is the first link of every page, and goes to the main part", () => {
    const { container } = render(<PageFrame><p>Page text</p></PageFrame>);

    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveAttribute("href", "#main");
    expect(container.querySelector("a")).toBe(link); // before the logo and every other link
  });

  it("is hidden until it has focus, and then at least 48 px high with a visible shape", () => {
    render(<PageFrame><p>Page text</p></PageFrame>);

    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link.className).toMatch(/\bsr-only\b/);
    expect(link.className).toMatch(/focus:not-sr-only/);
    expect(link.className).toMatch(/focus:min-h-12/);
    expect(link.className).toMatch(/focus:bg-/);
  });

  it("points at a main landmark with that id, which can take focus", () => {
    const { container } = render(<PageFrame><p>Page text</p></PageFrame>);

    const main = container.querySelector("main");
    expect(main).toHaveAttribute("id", "main");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(container.querySelectorAll("main")).toHaveLength(1);
  });

  it("is on the home page frame too", () => {
    render(<PageFrame isHomePage><p>Home</p></PageFrame>);

    expect(screen.getByRole("link", { name: "Skip to main content" })).toBeInTheDocument();
  });
});
