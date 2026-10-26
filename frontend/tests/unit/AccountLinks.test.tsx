// @vitest-environment jsdom
/** The account links of the header: Log in and Sign up, or My account when a session exists. Requirements: FR-02, NFR-01,
 * NFR-10. UI spec, "Layout" (Phase 3b, decision D16 in specs/2026-10-23-accounts-and-facility-ownership/).
 * The swap must not move the bar: both versions sit in the same grid cell, the unused one invisible and hidden from
 * screen readers. A visitor with no session sees no change after the page loads.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
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
  await stubSignupOpen(true); // the links ask GET /meta whether sign-up is open; open unless a test says otherwise
});
afterEach(() => {
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("with no session", () => {
  it("shows Log in and Sign up as links, and My account is not offered to a screen reader", async () => {
    render(<AccountLinks />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
    expect(await screen.findByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
    expect(screen.queryByRole("link", { name: "My account" })).not.toBeInTheDocument();
  });

  it.each([false, "fails"] as const)(
    "while sign-up is closed (%s): Log in stays, Sign up is not a link, and its room is kept so nothing moves when it opens",
    async (state) => {
      await stubSignupOpen(state);
      const { container } = render(<AccountLinks />);
      await waitFor(() => expect(fetch).toHaveBeenCalled());

      expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
      expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
      const kept = [...container.querySelectorAll('[aria-hidden="true"]')].find((node) => node.textContent === "Sign up");
      expect(kept?.className).toMatch(/\binvisible\b/); // drawn, so the bar is as wide as when it is open; no tab stop, no reader
      expect(kept?.getAttribute("tabindex")).toBeNull(); // it is not a link, so it cannot be focused
      expect(kept?.tagName).not.toBe("A");
    },
  );

  it("asks GET /meta once for all the links of the page (the answer is kept)", async () => {
    render(
      <>
        <AccountLinks />
        <MobileMenu links={siteConfig.menuLinks} />
      </>,
    );
    await screen.findByRole("link", { name: "Sign up" });

    expect(vi.mocked(fetch).mock.calls.filter(([address]) => String(address).endsWith("/meta"))).toHaveLength(1);
  });

  it("draws My account too, invisible and hidden, so the cell is as wide as the wider version (no layout shift)", () => {
    const { container } = render(<AccountLinks />);

    const hidden = [...container.querySelectorAll('[aria-hidden="true"]')].find((node) => node.textContent === "My account");
    expect(hidden).not.toBeUndefined();
    expect(hidden?.className).toMatch(/\binvisible\b/);
    expect(hidden?.className).toMatch(/\bcol-start-1\b.*\brow-start-1\b|\brow-start-1\b.*\bcol-start-1\b/);
    expect(container.firstElementChild?.className).toMatch(/\bgrid\b/);
  });

  it("keeps the links out of a phone's bar and every one at least 48 px high", async () => {
    render(<AccountLinks />);
    await screen.findByRole("link", { name: "Sign up" });

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
  it("shows Log in and Sign up with no session while sign-up is open", async () => {
    render(<MobileMenu links={siteConfig.menuLinks} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const panel = screen.getByRole("navigation", { name: "Menu links" });

    expect(within(panel).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
    expect(await within(panel).findByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
  });

  it("shows only Log in while sign-up is closed", async () => {
    await stubSignupOpen(false);
    render(<MobileMenu links={siteConfig.menuLinks} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const panel = screen.getByRole("navigation", { name: "Menu links" });

    expect(within(panel).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Find care",
      "For facilities",
      "Log in",
    ]);
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
