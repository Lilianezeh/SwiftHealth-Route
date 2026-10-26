// @vitest-environment jsdom
/** The account links of the header: Log in and Sign up, or My account when a session exists. Requirements: FR-02, NFR-01,
 * NFR-10. UI spec, "Layout" (Phase 3b, decision D16 in specs/2026-10-23-accounts-and-facility-ownership/).
 * The swap must not move the bar: both versions sit in the same grid cell, the unused one invisible and hidden from
 * screen readers. A visitor with no session sees no change after the page loads.
 */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AccountLinks } from "@/components/layout/AccountLinks";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { siteConfig } from "@/config/site";
import { clearStaffSession, saveStaffSession } from "@/lib/staff/session";
import type { StaffRole } from "@/types/staff";

function userWith(role: StaffRole) {
  return { id: 3, name: "Ada", email: "ada@example.com", phone: "+2340000000001", role, is_active: true };
}

beforeEach(() => window.sessionStorage.clear());
afterEach(() => window.sessionStorage.clear());

describe("with no session", () => {
  it("shows Log in and Sign up as links, and My account is not offered to a screen reader", () => {
    render(<AccountLinks />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
    expect(screen.queryByRole("link", { name: "My account" })).not.toBeInTheDocument();
  });

  it("draws My account too, invisible and hidden, so the cell is as wide as the wider version (no layout shift)", () => {
    const { container } = render(<AccountLinks />);

    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).not.toBeNull();
    expect(hidden?.className).toMatch(/\binvisible\b/);
    expect(hidden?.textContent).toBe("My account");
    expect(hidden?.className).toMatch(/\bcol-start-1\b.*\brow-start-1\b|\brow-start-1\b.*\bcol-start-1\b/);
    expect(container.firstElementChild?.className).toMatch(/\bgrid\b/);
  });

  it("keeps the links out of a phone's bar and every one at least 48 px high", () => {
    render(<AccountLinks />);

    expect(screen.getByRole("link", { name: "Log in" }).closest("div[class*='hidden']")).not.toBeNull();
    for (const name of ["Log in", "Sign up"]) {
      expect(screen.getByRole("link", { name }).className).toMatch(/min-h-12/);
    }
  });
});

describe("with a session", () => {
  it.each([
    ["provider", "/provider"],
    ["editor", "/admin"],
    ["admin", "/admin"],
    ["verifier", "/admin/listings?mine=true"],
  ] as const)("shows My account to where a %s starts (%s), instead of Log in and Sign up", async (role, address) => {
    saveStaffSession({ token: "t.o.k", user: userWith(role) });
    render(<AccountLinks />);

    expect(await screen.findByRole("link", { name: "My account" })).toHaveAttribute("href", address);
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
  });

  it("changes at once when the person logs in or out in this tab", async () => {
    render(<AccountLinks />);
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();

    act(() => saveStaffSession({ token: "t.o.k", user: userWith("editor") }));
    expect(await screen.findByRole("link", { name: "My account" })).toBeInTheDocument();

    act(() => clearStaffSession());
    expect(await screen.findByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My account" })).not.toBeInTheDocument();
  });

  it("ignores a damaged session value", () => {
    window.sessionStorage.setItem("swifthealth.staff-session", "{not json");
    render(<AccountLinks />);

    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
  });

  it("does not put a name, an email or a token in the page", async () => {
    saveStaffSession({ token: "secret.token.value", user: userWith("editor") });
    const { container } = render(<AccountLinks />);
    await screen.findByRole("link", { name: "My account" });

    expect(container.innerHTML).not.toMatch(/Ada|ada@example|secret\.token/);
  });
});

describe("in the phone menu", () => {
  it("shows Log in and Sign up with no session", async () => {
    render(<MobileMenu links={siteConfig.menuLinks} />);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const panel = screen.getByRole("navigation", { name: "Menu links" });

    expect(within(panel).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
    expect(within(panel).getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
  });

  it("shows My account instead with a session", async () => {
    saveStaffSession({ token: "t.o.k", user: userWith("provider") });
    render(<MobileMenu links={siteConfig.menuLinks} />);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const panel = screen.getByRole("navigation", { name: "Menu links" });

    expect(await within(panel).findByRole("link", { name: "My account" })).toHaveAttribute("href", "/provider");
    expect(within(panel).queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    for (const link of within(panel).getAllByRole("link")) expect(link.className).toMatch(/min-h-12/);
  });
});

describe("the footer is not touched (D16)", () => {
  it("has no Log in or Sign up link", async () => {
    const { SiteFooter } = await import("@/components/layout/SiteFooter");
    render(<SiteFooter isHomePage={false} />);

    expect(screen.queryByRole("link", { name: /log in|sign up|my account/i })).not.toBeInTheDocument();
  });
});
