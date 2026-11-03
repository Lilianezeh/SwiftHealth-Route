// @vitest-environment jsdom
/** Tests for SiteHeader. Requirements: FR-02 (the SwiftRescue button on every page), NFR-10 (48 px targets, the light focus
 * ring on a dark background), US-13. UI spec, "Layout" (the header redesigned on 2026-10-11).
 * The phone menu is tested in MobileMenu.test.tsx.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/layout/SiteHeader";

import { stubSignupOpen } from "../helpers/api";

// The header is a server component: the route group of the page tells it whether this is the home page (R44), and on the home page
// it is transparent and hides "Find care" (R14, R18). Each test chooses the page it is on.
const address = { pathname: "/find" };

function HeaderOnPage() {
  return <SiteHeader isHomePage={address.pathname === "/"} />;
}

beforeEach(async () => {
  address.pathname = "/find";
  await stubSignupOpen(false); // the header asks GET /meta whether sign-up is open; closed unless a test says otherwise
});
afterEach(() => vi.unstubAllGlobals());

// A link's name as a screen reader says it: the logo is one image labelled "SwiftHealth Route"; the other links are their text.
const nameOf = (link: HTMLElement) => link.querySelector('[role="img"]')?.getAttribute("aria-label") ?? link.textContent;

describe("SiteHeader", () => {
  it("has the SwiftHealth wordmark, a link to the home page", () => {
    render(<HeaderOnPage />);

    expect(screen.getByRole("link", { name: "SwiftHealth Route" })).toHaveAttribute("href", "/");
  });

  it("has Find care to /find, red SwiftRescue to /emergency, and For facilities to /for-facilities", () => {
    render(<HeaderOnPage />);

    expect(screen.getByRole("link", { name: "Find care" })).toHaveAttribute("href", "/find");
    expect(screen.getByRole("link", { name: "SwiftRescue" })).toHaveAttribute("href", "/emergency");
    expect(screen.getByRole("link", { name: "For facilities" })).toHaveAttribute("href", "/for-facilities");
  });

  it("puts the links, logged out, in the order Find care, SwiftRescue, For facilities and nothing else (owner, 2026-11-02)", () => {
    render(<HeaderOnPage />);

    const names = screen.getAllByRole("link").map(nameOf);

    expect(names).toEqual(["SwiftHealth Route", "Find care", "SwiftRescue", "For facilities"]);
  });

  it.each([true, false, "fails"] as const)(
    "has no Log in and no Sign up link, in the bar or in the phone menu, whether sign-up is open (%s) or not",
    async (state) => {
      await stubSignupOpen(state);
      render(<HeaderOnPage />);
      await userEvent.click(screen.getByRole("button", { name: "Menu" }));
      const menu = screen.getByRole("navigation", { name: "Menu links" });

      for (const name of [/log in/i, /sign up/i, /my account/i]) {
        expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
        expect(within(menu).queryByRole("link", { name })).not.toBeInTheDocument();
      }
      expect(within(menu).getAllByRole("link").map((link) => link.textContent)).toEqual(["Find care", "For facilities"]);
    },
  );

  it("does not ask GET /meta: sign-up is no longer the header's business", async () => {
    await stubSignupOpen(true);
    render(<HeaderOnPage />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("has no link to /log-in or /sign-up anywhere in the header", async () => {
    await stubSignupOpen(true);
    const { container } = render(<HeaderOnPage />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    const addresses = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(addresses.filter((address) => /log-in|sign-up|staff-portal/.test(address ?? ""))).toEqual([]);
  });

  it("makes SwiftRescue red (the emergency colour, white text), and no other link is red (FR-02)", () => {
    render(<HeaderOnPage />);

    const rescue = screen.getByRole("link", { name: "SwiftRescue" });
    expect(rescue.className).toMatch(/\bbg-emergency\b/);
    expect(rescue.className).toMatch(/\btext-white\b/);
    for (const link of screen.getAllByRole("link")) {
      if (link !== rescue) expect(link.className, link.textContent ?? "").not.toMatch(/emergency/);
    }
  });

  it("keeps SwiftRescue in the bar on a phone: it is not hidden and not inside the menu (FR-02)", async () => {
    render(<HeaderOnPage />);
    const rescue = screen.getByRole("link", { name: "SwiftRescue" });

    expect(rescue.className).not.toMatch(/\bhidden\b/);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const menu = screen.getByRole("navigation", { name: "Menu links" });

    expect(within(menu).queryByRole("link", { name: "SwiftRescue" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "SwiftRescue" })).toHaveLength(1);
  });

  it("shows Find care and For facilities in the bar from tablet width, and leaves them to the menu on a phone", () => {
    render(<HeaderOnPage />);

    for (const name of ["Find care", "For facilities"]) {
      expect(screen.getByRole("link", { name }).className, name).toMatch(/\bhidden\b.*\bmd:inline-flex\b/);
    }
    expect(screen.getByRole("button", { name: "Menu" }).closest("div")?.className).toMatch(/\bmd:hidden\b/);
  });

  it("keeps the links of the bar close (px-2) at tablet width and roomier (lg:px-3) from desktop width, so the bar fits in 768 px (browser suite)", async () => {
    render(<HeaderOnPage />);

    for (const name of ["Find care", "For facilities"]) {
      expect(screen.getByRole("link", { name }).className, name).toMatch(/\bpx-2\b.*\blg:px-3\b/);
    }
    expect(screen.getByRole("link", { name: "Find care" }).className).not.toMatch(/(^|\s)px-3\b/);
  });

  it("has a forest background and the on-dark class, so the focus ring inside it is the light one", () => {
    render(<HeaderOnPage />);

    const header = screen.getByRole("banner");
    expect(header.className).toMatch(/\bbg-bar\b/); // the header blue (a navy in the dark mode: the bar token)
    expect(header.className).toMatch(/\bon-dark\b/);
  });

  it("has a bright blue accent line under it (decoration: a border, never a background behind text)", () => {
    render(<HeaderOnPage />);

    const header = screen.getByRole("banner");
    expect(header.className).toMatch(/\bborder-b-4\b/);
    expect(header.className).toMatch(/\bborder-accent\b/);
    expect(header.className).not.toMatch(/\bbg-accent\b/);
  });

  it("is a solid brand-colour bar ABOVE the photo on a phone and a tablet (under 1024 px), in the normal flow, with the accent line (owner, 2026-11-03)", () => {
    address.pathname = "/";
    render(<HeaderOnPage />);

    const header = screen.getByRole("banner");
    expect(header.className).toMatch(/(^|\s)relative\b/); // in the flow: the photo starts under it, so nothing is laid over the photo
    expect(header.className).toMatch(/(^|\s)bg-bar\b/);
    expect(header.className).toMatch(/(^|\s)border-b-4\b/);
    expect(header.className).toMatch(/(^|\s)border-accent\b/);
    expect(header.className).toMatch(/\bon-dark\b/); // the light focus ring
    expect(header.className).not.toMatch(/(^|\s)(absolute|top-0|inset-x-0|z-20)\b/); // these are only from 1024 px (lg:)
  });

  it("stays transparent on top of the hero from 1024 px, exactly as before: no background, no line under it, above the photo (R18)", () => {
    address.pathname = "/";
    render(<HeaderOnPage />);

    const header = screen.getByRole("banner");
    for (const name of ["lg:absolute", "lg:inset-x-0", "lg:top-0", "lg:z-20", "lg:bg-transparent", "lg:border-b-0"]) {
      expect(header.className, name).toMatch(new RegExp(`(^|\\s)${name.replace(/[/:]/g, "\\$&")}(\\s|$)`));
    }
  });

  it("writes its logo word and its links in white on the home page", () => {
    address.pathname = "/";
    render(<HeaderOnPage />);

    expect(screen.getByRole("banner").className).toMatch(/\btext-white\b/);
    expect(screen.getByRole("banner").className).not.toMatch(/\btext-paper\b/);
    expect(screen.getByRole("link", { name: "SwiftRescue" }).className).toMatch(/\bbg-emergency\b/); // the red button is unchanged
    expect(screen.getByRole("link", { name: "SwiftRescue" }).className).toMatch(/\btext-white\b/);
  });

  it("keeps the blue bar with its accent line on every other page, in the normal flow", () => {
    for (const pathname of ["/find", "/search", "/emergency", "/privacy", "/listing/night-pharmacy-a"]) {
      address.pathname = pathname;
      const { unmount } = render(<HeaderOnPage />);

      const header = screen.getByRole("banner");
      expect(header.className, pathname).toMatch(/\bbg-bar\b/);
      expect(header.className, pathname).toMatch(/\bborder-b-4\b/);
      expect(header.className, pathname).toMatch(/\bborder-accent\b/);
      expect(header.className, pathname).toMatch(/\brelative\b/);
      expect(header.className, pathname).not.toMatch(/\babsolute\b/);
      unmount();
    }
  });

  it("hides Find care on the home page, in the bar: the hero button does the same", () => {
    address.pathname = "/";
    render(<HeaderOnPage />);

    expect(screen.queryByRole("link", { name: "Find care" })).not.toBeInTheDocument();
    // Logged out, on the home page: the logo, SwiftRescue, For facilities (and the Theme button, which is a button, not a link).
    expect(screen.getAllByRole("link").map(nameOf)).toEqual(["SwiftHealth Route", "SwiftRescue", "For facilities"]);
    expect(screen.getByRole("button", { name: /theme|light|dark/i })).toBeInTheDocument();
  });

  it("hides Find care on the home page in the phone menu too, and keeps For facilities there", async () => {
    address.pathname = "/";
    render(<HeaderOnPage />);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const menu = screen.getByRole("navigation", { name: "Menu links" });

    expect(within(menu).queryByRole("link", { name: "Find care" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "For facilities" })).toBeInTheDocument();
  });

  it.each(["/find", "/search", "/emergency", "/listing/night-pharmacy-a", "/privacy", "/list-your-facility"])(
    "shows Find care on %s, in the bar and in the menu",
    async (pathname) => {
      address.pathname = pathname;
      render(<HeaderOnPage />);

      expect(screen.getByRole("link", { name: "Find care" })).toHaveAttribute("href", "/find");
      await userEvent.click(screen.getByRole("button", { name: "Menu" }));
      const menu = screen.getByRole("navigation", { name: "Menu links" });
      expect(within(menu).getByRole("link", { name: "Find care" })).toHaveAttribute("href", "/find");
    },
  );

  it("keeps SwiftRescue and the logo on the home page too (FR-02)", () => {
    address.pathname = "/";
    render(<HeaderOnPage />);

    expect(screen.getByRole("link", { name: "SwiftRescue" })).toHaveAttribute("href", "/emergency");
    expect(screen.getByRole("link", { name: "SwiftHealth Route" })).toHaveAttribute("href", "/");
  });

  it("has the new logo in the first link: one image named SwiftHealth Route, a pin and the words SwiftHealth and Route (R38)", () => {
    render(<HeaderOnPage />);

    const link = screen.getByRole("link", { name: "SwiftHealth Route" });
    expect(within(link).getAllByRole("img", { name: "SwiftHealth Route" })).toHaveLength(1); // heard once
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(within(link).getByText("SwiftHealth")).toBeInTheDocument();
    expect(within(link).getByText("Route")).toBeInTheDocument();
  });

  it("always uses the dark tone of the logo: a white pin and light words, on the blue bar and on the hero (the owner's decision)", () => {
    for (const pathname of ["/", "/find"]) {
      address.pathname = pathname;
      const { container, unmount } = render(<HeaderOnPage />);

      expect(container.querySelector(".logo-pin__body")?.getAttribute("class"), pathname).toMatch(/\bfill-white\b/);
      expect(container.querySelector(".logo-pin__pulse")?.getAttribute("class"), pathname).toMatch(/\bstroke-sky\b/);
      expect(screen.getByText("SwiftHealth").className, pathname).toMatch(/\btext-white\b/);
      expect(screen.getByText("Route").className, pathname).toMatch(/\btext-sky-pale\b/);
      unmount();
    }
  });

  it("is compact on a phone so the full wordmark fits from 360 px: a smaller SwiftRescue button and an icon-only Menu (R40)", () => {
    render(<HeaderOnPage />);

    // px-2 and the 2 px white edge together are the 10 px of side space it had (px-2.5); sm:px-3.5 and the edge are the 16 px of sm:px-4
    expect(screen.getByRole("link", { name: "SwiftRescue" }).className).toMatch(/\bborder-2\b.*\bpx-2\b.*\bsm:px-3\.5\b/);
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-label", "Menu");
    expect(menu.textContent).toBe(""); // the icon only
    expect(menu.className).toMatch(/\bmin-w-12\b/);
    expect(menu.className).not.toMatch(/\bpx-4\b/);
  });

  it("has a small white siren icon (lucide) on the red SwiftRescue button, hidden from screen readers, and no cross (R36)", () => {
    render(<HeaderOnPage />);

    const rescue = screen.getByRole("link", { name: "SwiftRescue" }); // the siren adds nothing to the name
    const icon = rescue.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon?.getAttribute("class")).toMatch(/lucide-siren/); // the lucide Siren
    expect(icon?.getAttribute("class")).not.toMatch(/cross|plus|heart|hospital/); // never a red cross or a medical cross
    expect(rescue.className).toMatch(/\btext-white\b/); // the icon takes the white of the text (currentColor)
    expect(rescue.textContent).toBe("SwiftRescue");
    expect(rescue.className).toMatch(/\bgap-/); // a little space between the icon and the word
    expect(rescue.querySelectorAll("svg")).toHaveLength(1);
  });

  it("keeps every tap target at 48 px or more, the Menu button too", () => {
    render(<HeaderOnPage />);

    for (const target of [...screen.getAllByRole("link"), screen.getByRole("button", { name: "Menu" })]) {
      expect(target.className, target.textContent ?? "").toMatch(/min-h-12(\s|$)/);
    }
  });
});
