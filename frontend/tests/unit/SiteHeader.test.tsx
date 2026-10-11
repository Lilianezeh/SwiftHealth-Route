// @vitest-environment jsdom
/** Tests for SiteHeader. Requirements: FR-02 (the SwiftRescue button on every page), NFR-10 (48 px targets, the light focus
 * ring on a dark background), US-13. UI spec, "Layout" (the header redesigned on 2026-10-11).
 * The phone menu is tested in MobileMenu.test.tsx.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/layout/SiteHeader";

describe("SiteHeader", () => {
  it("has the SwiftHealth wordmark, a link to the home page", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "SwiftHealth" })).toHaveAttribute("href", "/");
  });

  it("has Find care to /find, red SwiftRescue to /emergency, and For facilities to /list-your-facility", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Find care" })).toHaveAttribute("href", "/find");
    expect(screen.getByRole("link", { name: "SwiftRescue" })).toHaveAttribute("href", "/emergency");
    expect(screen.getByRole("link", { name: "For facilities" })).toHaveAttribute("href", "/list-your-facility");
  });

  it("puts the links in the order Find care, SwiftRescue, For facilities", () => {
    render(<SiteHeader />);

    const names = screen.getAllByRole("link").map((link) => link.textContent);

    expect(names).toEqual(["SwiftHealth", "Find care", "SwiftRescue", "For facilities"]);
  });

  it("makes SwiftRescue red (the emergency colour, white text), and no other link is red (FR-02)", () => {
    render(<SiteHeader />);

    const rescue = screen.getByRole("link", { name: "SwiftRescue" });
    expect(rescue.className).toMatch(/\bbg-emergency\b/);
    expect(rescue.className).toMatch(/\btext-white\b/);
    for (const link of screen.getAllByRole("link")) {
      if (link !== rescue) expect(link.className, link.textContent ?? "").not.toMatch(/emergency/);
    }
  });

  it("keeps SwiftRescue in the bar on a phone: it is not hidden and not inside the menu (FR-02)", async () => {
    render(<SiteHeader />);
    const rescue = screen.getByRole("link", { name: "SwiftRescue" });

    expect(rescue.className).not.toMatch(/\bhidden\b/);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const menu = screen.getByRole("navigation", { name: "Menu links" });

    expect(within(menu).queryByRole("link", { name: "SwiftRescue" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "SwiftRescue" })).toHaveLength(1);
  });

  it("shows Find care and For facilities in the bar from tablet width, and leaves them to the menu on a phone", () => {
    render(<SiteHeader />);

    for (const name of ["Find care", "For facilities"]) {
      expect(screen.getByRole("link", { name }).className, name).toMatch(/\bhidden\b.*\bmd:inline-flex\b/);
    }
    expect(screen.getByRole("button", { name: "Menu" }).closest("div")?.className).toMatch(/\bmd:hidden\b/);
  });

  it("has a forest background and the on-dark class, so the focus ring inside it is the light one", () => {
    render(<SiteHeader />);

    const header = screen.getByRole("banner");
    expect(header.className).toMatch(/\bbg-forest\b/);
    expect(header.className).toMatch(/\bon-dark\b/);
  });

  it("has a bright blue accent line under it (decoration: a border, never a background behind text)", () => {
    render(<SiteHeader />);

    const header = screen.getByRole("banner");
    expect(header.className).toMatch(/\bborder-b-4\b/);
    expect(header.className).toMatch(/\bborder-accent\b/);
    expect(header.className).not.toMatch(/\bbg-accent\b/);
  });

  it("keeps every tap target at 48 px or more, the Menu button too", () => {
    render(<SiteHeader />);

    for (const target of [...screen.getAllByRole("link"), screen.getByRole("button", { name: "Menu" })]) {
      expect(target.className, target.textContent ?? "").toMatch(/min-h-12(\s|$)/);
    }
  });
});
