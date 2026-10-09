// @vitest-environment jsdom
/** Tests for SiteHeader. Requirements: FR-02 (the SwiftRescue button on every page), NFR-10 (focus ring on a dark background). */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/layout/SiteHeader";

describe("SiteHeader", () => {
  it("links the name to /find and has the red SwiftRescue button to /emergency", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "SwiftHealth" })).toHaveAttribute("href", "/find");
    expect(screen.getByRole("link", { name: "SwiftRescue" })).toHaveAttribute("href", "/emergency");
  });

  it("has a forest background and the on-dark class, so the focus ring inside it is the light one", () => {
    render(<SiteHeader />);

    const header = screen.getByRole("banner");
    expect(header.className).toMatch(/\bbg-forest\b/);
    expect(header.className).toMatch(/\bon-dark\b/);
  });

  it("keeps its tap targets at 48 px or more", () => {
    render(<SiteHeader />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.className, link.textContent ?? "").toMatch(/min-h-12(\s|$)/);
    }
  });
});
