// @vitest-environment jsdom
/** Tests for SiteHeader. Requirements: FR-02 (the SwiftRescue button on every page), NFR-10 (48 px targets, the light focus
 * ring on a dark background), US-13. UI spec, "Layout" (the header redesigned on 2026-10-11).
 * The phone menu is tested in MobileMenu.test.tsx.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/layout/SiteHeader";

// The header reads the address to hide "Find care" on the home page (R14): each test chooses the page it is on.
const address = vi.hoisted(() => ({ pathname: "/find" }));
vi.mock("next/navigation", () => ({ usePathname: () => address.pathname }));

beforeEach(() => {
  address.pathname = "/find";
});

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

  it("is transparent on the home page, on top of the hero: no background, no line under it, above the photo (R18)", () => {
    address.pathname = "/";
    render(<SiteHeader />);

    const header = screen.getByRole("banner");
    expect(header.className).toMatch(/\babsolute\b/);
    expect(header.className).toMatch(/\binset-x-0\b/);
    expect(header.className).toMatch(/\btop-0\b/);
    expect(header.className).toMatch(/\bz-20\b/); // above the hero photo
    expect(header.className).toMatch(/\bon-dark\b/); // the light focus ring
    expect(header.className).not.toMatch(/\bbg-|\bborder-b|\bborder-accent\b/);
  });

  it("writes its logo word and its links in white on the home page", () => {
    address.pathname = "/";
    render(<SiteHeader />);

    expect(screen.getByRole("banner").className).toMatch(/\btext-white\b/);
    expect(screen.getByRole("banner").className).not.toMatch(/\btext-paper\b/);
    expect(screen.getByRole("link", { name: "SwiftRescue" }).className).toMatch(/\bbg-emergency\b/); // the red button is unchanged
    expect(screen.getByRole("link", { name: "SwiftRescue" }).className).toMatch(/\btext-white\b/);
  });

  it("keeps the blue bar with its accent line on every other page, in the normal flow", () => {
    for (const pathname of ["/find", "/search", "/emergency", "/privacy", "/listing/night-pharmacy-a"]) {
      address.pathname = pathname;
      const { unmount } = render(<SiteHeader />);

      const header = screen.getByRole("banner");
      expect(header.className, pathname).toMatch(/\bbg-forest\b/);
      expect(header.className, pathname).toMatch(/\bborder-b-4\b/);
      expect(header.className, pathname).toMatch(/\bborder-accent\b/);
      expect(header.className, pathname).toMatch(/\brelative\b/);
      expect(header.className, pathname).not.toMatch(/\babsolute\b/);
      unmount();
    }
  });

  it("hides Find care on the home page, in the bar: the hero button does the same", () => {
    address.pathname = "/";
    render(<SiteHeader />);

    expect(screen.queryByRole("link", { name: "Find care" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "SwiftHealth",
      "SwiftRescue",
      "For facilities",
    ]);
  });

  it("hides Find care on the home page in the phone menu too, and keeps For facilities there", async () => {
    address.pathname = "/";
    render(<SiteHeader />);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const menu = screen.getByRole("navigation", { name: "Menu links" });

    expect(within(menu).queryByRole("link", { name: "Find care" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "For facilities" })).toBeInTheDocument();
  });

  it.each(["/find", "/search", "/emergency", "/listing/night-pharmacy-a", "/privacy", "/list-your-facility"])(
    "shows Find care on %s, in the bar and in the menu",
    async (pathname) => {
      address.pathname = pathname;
      render(<SiteHeader />);

      expect(screen.getByRole("link", { name: "Find care" })).toHaveAttribute("href", "/find");
      await userEvent.click(screen.getByRole("button", { name: "Menu" }));
      const menu = screen.getByRole("navigation", { name: "Menu links" });
      expect(within(menu).getByRole("link", { name: "Find care" })).toHaveAttribute("href", "/find");
    },
  );

  it("keeps SwiftRescue and the logo on the home page too (FR-02)", () => {
    address.pathname = "/";
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "SwiftRescue" })).toHaveAttribute("href", "/emergency");
    expect(screen.getByRole("link", { name: "SwiftHealth" })).toHaveAttribute("href", "/");
  });

  it("has the logo in the wordmark link: a pin that screen readers do not read, then the word", () => {
    render(<SiteHeader />);

    const wordmark = screen.getByRole("link", { name: "SwiftHealth" });
    expect(wordmark.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(wordmark).toHaveTextContent("SwiftHealth");
  });

  it("is compact on a phone so it fits 320 px, and roomier from 640 px (R32): small wordmark and side space", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "SwiftHealth" }).className).toMatch(/\btext-base\b.*\bsm:text-lg\b/);
    expect(screen.getByRole("link", { name: "SwiftRescue" }).className).toMatch(/\bpx-3\b.*\bsm:px-4\b/);
    expect(screen.getByRole("button", { name: "Menu" }).className).toMatch(/\bpx-3\b.*\bsm:px-4\b/);
  });

  it("draws only the pin below 400 px and keeps the word for screen readers, so the link is still named SwiftHealth (R32)", () => {
    render(<SiteHeader />);

    const link = screen.getByRole("link", { name: "SwiftHealth" });
    const word = within(link).getByText("SwiftHealth");
    expect(word.className).toMatch(/\bmax-\[399px\]:sr-only\b/); // hidden to the eye only below 400 px
    expect(word.className).not.toMatch(/(^|\s)(hidden|invisible)\b/); // never display:none, which would take away the name
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps every tap target at 48 px or more, the Menu button too", () => {
    render(<SiteHeader />);

    for (const target of [...screen.getAllByRole("link"), screen.getByRole("button", { name: "Menu" })]) {
      expect(target.className, target.textContent ?? "").toMatch(/min-h-12(\s|$)/);
    }
  });
});
