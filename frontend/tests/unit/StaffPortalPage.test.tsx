// @vitest-environment jsdom
/** The Staff portal page `/staff-portal`. Requirements: FR-48, FR-49, NFR-01, NFR-10. UI spec 2.9c; the owner's request of 2026-11-02:
 * Log in and Sign up are not in the header, so a visitor does not think they need an account. Staff reach them from a small link in the
 * footer. The page has "Log in" and, only while sign-up is open, "Sign up as staff" (the sign-up page then starts with Staff chosen).
 * A page for staff: not for search engines, and it is not in the header, the Menu or the sitemap.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StaffPortalPage, { metadata } from "@/app/(public)/staff-portal/page";
import { resetMetaCache } from "@/lib/api/meta";

import { META, json } from "../helpers/api";
import { readSource } from "../helpers/source";

function stubMeta(changes: Partial<typeof META> | "fails" = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string) => {
      if (new URL(address).pathname !== "/meta") return json({ detail: "Not found" }, 404);
      if (changes === "fails") return Promise.reject(new TypeError("offline"));
      return json({ ...META, ...changes });
    }),
  );
}

beforeEach(() => resetMetaCache());
afterEach(() => vi.unstubAllGlobals());

describe("the content", () => {
  it("has one h1, 'Staff portal', and says who it is for in plain words", () => {
    stubMeta();
    render(<StaffPortalPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Staff portal");
    expect(screen.getByText(/for the people who check and edit listings/i)).toBeInTheDocument();
  });

  it("tells facility owners where their sign-up is: For facilities", () => {
    stubMeta();
    render(<StaffPortalPage />);

    expect(screen.getByRole("link", { name: "For facilities" })).toHaveAttribute("href", "/for-facilities");
  });

  it("names no city, no phone number and no medical advice", () => {
    stubMeta();
    const text = render(<StaffPortalPage />).container.textContent ?? "";

    expect(text).not.toMatch(/Enugu/);
    expect(text).not.toMatch(/\+234|0[789][01]\d[ -]?\d{3}[ -]?\d{4}|@/);
    expect(text).not.toMatch(/diagnos|treat(ment)?\b|cure\b|medical advice/i);
  });
});

describe("the buttons", () => {
  it("shows Log in (to /log-in) and Sign up as staff (to /sign-up with Staff chosen) while sign-up is open", async () => {
    stubMeta({ signup_open: true });
    render(<StaffPortalPage />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
    expect(await screen.findByRole("link", { name: "Sign up as staff" })).toHaveAttribute("href", "/sign-up?as=staff");
    expect(screen.queryByText("Sign-up is not open yet.")).toBeNull();
  });

  it("explains that an admin must approve a staff sign-up, next to the button", async () => {
    stubMeta({ signup_open: true });
    render(<StaffPortalPage />);
    await screen.findByRole("link", { name: "Sign up as staff" });

    expect(screen.getByText("An admin must approve every staff sign-up before it can be used.")).toBeInTheDocument();
  });

  it.each([{ signup_open: false }, "fails"] as const)(
    "shows no sign-up button while sign-up is closed or cannot be checked (%j), says so, and keeps Log in",
    async (state) => {
      stubMeta(state);
      render(<StaffPortalPage />);

      expect(await screen.findByText("Sign-up is not open yet.")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Sign up as staff" })).toBeNull();
      expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in");
    },
  );

  it("makes the buttons at least 50 px high, in one column on a phone, with 16 px text", async () => {
    stubMeta({ signup_open: true });
    const { container } = render(<StaffPortalPage />);

    for (const name of ["Log in", "Sign up as staff"]) {
      const link = await screen.findByRole("link", { name });
      expect(link.className, name).toMatch(/min-h-\[50px\]/);
      expect(link.className, name).not.toMatch(/text-sm|text-xs/);
    }
    expect(container.querySelector("[data-account-buttons]")?.className).toMatch(/\bgrid-cols-1\b/);
  });

  it("makes every link at least 48 px high", async () => {
    stubMeta({ signup_open: true });
    const { container } = render(<StaffPortalPage />);
    await screen.findByRole("link", { name: "Sign up as staff" });

    for (const link of container.querySelectorAll("a")) expect(link.className).toMatch(/min-h-12|min-h-\[50px\]/);
  });
});

describe("the page as a whole", () => {
  it("is not for search engines and is not in the sitemap", () => {
    expect(metadata.title).toBe("Staff portal");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(readSource("app/sitemap.ts")).not.toContain("staff-portal");
  });

  it("is a server page with one small client part, and stores nothing", () => {
    const page = readSource("app/(public)/staff-portal/page.tsx");

    expect(page).not.toMatch(/["']use client["']|fetch\(|localStorage|sessionStorage|useEffect/);
  });

  it("is not in the header or the Menu: only the footer leads to it", () => {
    const site = readSource("config/site.ts");

    expect(site).toMatch(/footerLinks[\s\S]*staff-portal/);
    expect(site.slice(0, site.indexOf("footerLinks"))).not.toContain("staff-portal");
  });
});
