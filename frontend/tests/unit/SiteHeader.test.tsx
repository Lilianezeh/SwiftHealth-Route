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

  it("has Find care to /find, red SwiftRescue to /emergency, and For facilities to /list-your-facility", () => {
    render(<HeaderOnPage />);

    expect(screen.getByRole("link", { name: "Find care" })).toHaveAttribute("href", "/find");
    expect(screen.getByRole("link", { name: "SwiftRescue" })).toHaveAttribute("href", "/emergency");
    expect(screen.getByRole("link", { name: "For facilities" })).toHaveAttribute("href", "/list-your-facility");
  });

  it("puts the links in the order Find care, SwiftRescue, For facilities, Log in, Sign up (sign-up open)", async () => {
    await stubSignupOpen(true);
    render(<HeaderOnPage />);
    await screen.findByRole("link", { name: "Sign up" });

    const names = screen.getAllByRole("link").map(nameOf);

    expect(names).toEqual(["SwiftHealth Route", "Find care", "SwiftRescue", "For facilities", "Log in", "Sign up"]);
  });

  it("has Log in to /log-in always, and Sign up to /sign-up while sign-up is open (Phase 3b, D16)", async () => {
    await stubSignupOpen(true);
    render(<HeaderOnPage />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
    expect(await screen.findByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
  });

  it("shows Log in and Sign up in the bar from tablet width and leaves them to the menu on a phone", async () => {
    await stubSignupOpen(true);
    render(<HeaderOnPage />);
    await screen.findByRole("link", { name: "Sign up" });

    for (const name of ["Log in", "Sign up"]) {
      expect(screen.getByRole("link", { name }).className, name).toMatch(/\bhidden\b.*\bmd:inline-flex\b/);
    }
  });

  it("puts Log in and Sign up in the phone menu after For facilities, and SwiftRescue still outside it", async () => {
    await stubSignupOpen(true);
    render(<HeaderOnPage />);
    await screen.findByRole("link", { name: "Sign up" });

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const menu = screen.getByRole("navigation", { name: "Menu links" });

    expect(within(menu).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Find care",
      "For facilities",
      "Log in",
      "Sign up",
    ]);
    expect(within(menu).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
    expect(within(menu).getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
    expect(within(menu).queryByRole("link", { name: "SwiftRescue" })).not.toBeInTheDocument();
  });

  it.each([false, "fails"] as const)(
    "shows no Sign up link while sign-up is closed (%s), in the bar or in the menu, and keeps Log in",
    async (state) => {
      await stubSignupOpen(state);
      render(<HeaderOnPage />);
      await waitFor(() => expect(fetch).toHaveBeenCalled());

      expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
      expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Menu" }));
      const menu = screen.getByRole("navigation", { name: "Menu links" });
      expect(within(menu).getByRole("link", { name: "Log in" })).toBeInTheDocument();
      expect(within(menu).queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
    },
  );

  it("does not make Log in or Sign up red: red is for SwiftRescue only", async () => {
    await stubSignupOpen(true);
    render(<HeaderOnPage />);
    await screen.findByRole("link", { name: "Sign up" });

    for (const name of ["Log in", "Sign up"]) {
      expect(screen.getByRole("link", { name }).className, name).not.toMatch(/emergency|red/);
    }
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

  it("has a forest background and the on-dark class, so the focus ring inside it is the light one", () => {
    render(<HeaderOnPage />);

    const header = screen.getByRole("banner");
    expect(header.className).toMatch(/\bbg-forest\b/);
    expect(header.className).toMatch(/\bon-dark\b/);
  });

  it("has a bright blue accent line under it (decoration: a border, never a background behind text)", () => {
    render(<HeaderOnPage />);

    const header = screen.getByRole("banner");
    expect(header.className).toMatch(/\bborder-b-4\b/);
    expect(header.className).toMatch(/\bborder-accent\b/);
    expect(header.className).not.toMatch(/\bbg-accent\b/);
  });

  it("is transparent on the home page, on top of the hero: no background, no line under it, above the photo (R18)", () => {
    address.pathname = "/";
    render(<HeaderOnPage />);

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
    render(<HeaderOnPage />);

    expect(screen.queryByRole("link", { name: "Find care" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").map(nameOf)).toEqual([
      "SwiftHealth Route",
      "SwiftRescue",
      "For facilities",
      "Log in",
    ]); // sign-up is closed in these tests unless one says otherwise, so no Sign up
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

    expect(screen.getByRole("link", { name: "SwiftRescue" }).className).toMatch(/\bpx-2\.5\b.*\bsm:px-4\b/);
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
