// @vitest-environment jsdom
/** The account link of the header: My account when a session exists, and nothing for a visitor. Requirements: FR-02, NFR-01,
 * NFR-10. UI spec, "Layout" (accounts phase 3b, decision D16; changed on 2026-11-02 by the owner: Log in and Sign up are no longer
 * in the header, so visitors do not think they need an account; they are on /for-facilities and /staff-portal).
 * A visitor sees nothing here and the header asks GET /meta for nothing. Someone logged in (a session in this tab) sees My account,
 * to where their role starts.
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountLinks } from "@/components/layout/AccountLinks";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { siteConfig } from "@/config/site";
import { clearStaffSession, saveStaffSession } from "@/lib/staff/session";
import type { StaffRole } from "@/types/staff";

import { stubSignupOpen } from "../helpers/api";

function userWith(role: StaffRole) {
  return { id: 3, name: "Ada", email: "ada@example.com", phone: "+2340000000001", role, is_active: true };
}

beforeEach(async () => {
  window.sessionStorage.clear();
  await stubSignupOpen(true); // open, to show that even then the header offers nothing to a visitor
});
afterEach(() => {
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("with no session", () => {
  it("shows nothing at all: no link, not even a hidden one", () => {
    const { container } = render(<AccountLinks />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(container.textContent).toBe("");
  });

  it("asks nothing from the API, whether sign-up is open or not", async () => {
    render(
      <>
        <AccountLinks />
        <MobileMenu links={siteConfig.menuLinks} />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("ignores a damaged session value", () => {
    window.sessionStorage.setItem("swifthealth.staff-session", "{not json");
    const { container } = render(<AccountLinks />);

    expect(container.textContent).toBe("");
  });
});

describe("with a session", () => {
  it.each([
    ["provider", "/provider"],
    ["editor", "/admin"],
    ["admin", "/admin"],
    ["verifier", "/admin/listings?mine=true"],
  ] as const)("shows My account to where a %s starts (%s)", async (role, address) => {
    saveStaffSession({ token: "t.o.k", user: userWith(role) });
    render(<AccountLinks />);

    expect(await screen.findByRole("link", { name: "My account" })).toHaveAttribute("href", address);
    expect(screen.queryByRole("link", { name: /log in|sign up/i })).not.toBeInTheDocument();
  });

  it("appears at once when the person logs in in this tab, and goes when they log out", async () => {
    const { container } = render(<AccountLinks />);
    expect(container.textContent).toBe("");

    act(() => saveStaffSession({ token: "t.o.k", user: userWith("editor") }));
    expect(await screen.findByRole("link", { name: "My account" })).toBeInTheDocument();

    act(() => clearStaffSession());
    await vi.waitFor(() => expect(screen.queryByRole("link", { name: "My account" })).not.toBeInTheDocument());
  });

  it("is a link of 48 px, from tablet width up (on a phone it is in the Menu)", async () => {
    saveStaffSession({ token: "t.o.k", user: userWith("editor") });
    render(<AccountLinks />);

    const link = await screen.findByRole("link", { name: "My account" });
    expect(link.className).toMatch(/min-h-12/);
    expect(link.className).toMatch(/\bhidden\b.*\bmd:inline-flex\b/);
    expect(link.className).toMatch(/text-base/);
  });

  it("does not put a name, an email or a token in the page", async () => {
    saveStaffSession({ token: "secret.token.value", user: userWith("editor") });
    const { container } = render(<AccountLinks />);
    await screen.findByRole("link", { name: "My account" });

    expect(container.innerHTML).not.toMatch(/Ada|ada@example|secret\.token/);
  });
});

describe("in the phone menu", () => {
  it("has only the page links with no session", async () => {
    render(<MobileMenu links={siteConfig.menuLinks} />);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const panel = screen.getByRole("navigation", { name: "Menu links" });

    expect(panel.querySelectorAll("a")).toHaveLength(siteConfig.menuLinks.length);
    expect([...panel.querySelectorAll("a")].map((link) => link.textContent)).toEqual(["Find care", "For facilities"]);
  });

  it("adds My account with a session, to where the role starts, with a 48 px row", async () => {
    saveStaffSession({ token: "t.o.k", user: userWith("provider") });
    render(<MobileMenu links={siteConfig.menuLinks} />);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const panel = screen.getByRole("navigation", { name: "Menu links" });

    expect(await screen.findByRole("link", { name: "My account" })).toHaveAttribute("href", "/provider");
    expect([...panel.querySelectorAll("a")].map((link) => link.textContent)).toEqual(["Find care", "For facilities", "My account"]);
    for (const link of panel.querySelectorAll("a")) expect(link.className).toMatch(/min-h-12/);
  });
});

describe("the footer", () => {
  it("has no Log in, Sign up or My account link of its own: the Staff portal link is the one way to the staff pages", async () => {
    const { SiteFooter } = await import("@/components/layout/SiteFooter");
    render(<SiteFooter isHomePage={false} />);

    expect(screen.queryByRole("link", { name: /log in|sign up|my account/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Staff portal" })).toHaveAttribute("href", "/staff-portal");
  });
});
