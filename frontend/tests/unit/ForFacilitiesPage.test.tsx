// @vitest-environment jsdom
/** The "For facilities" page `/for-facilities`. Requirements: FR-23, FR-44, FR-45, FR-50, FR-51, NFR-10, NFR-12. UI spec 2.9b;
 * api-spec section 3 (`featured_price_naira` of GET /meta) and section 8 ("Sponsored rules").
 * A server page with one small client part (the price and the Sign up button). No city, no medical claim, no legal claim.
 */
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ForFacilitiesPage, { metadata } from "@/app/(public)/for-facilities/page";
import { siteConfig } from "@/config/site";
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
  it("has exactly one h1, 'For facilities', and the four h2 sections in order", () => {
    stubMeta();
    const { container } = render(<ForFacilitiesPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("For facilities");
    const headings = [...container.querySelectorAll("h2")].map((heading) => heading.textContent);
    expect(headings).toEqual(["Listing is free", "How verification works", "Featured", "How to claim your facility"]);
  });

  it("says listing is free during launch and that every listing is checked before it goes live", () => {
    stubMeta();
    render(<ForFacilitiesPage />);

    expect(screen.getByText("Listing is free during our launch. Our team checks every listing before it goes live.")).toBeInTheDocument();
  });

  it("explains verification: a call and a visit, the date, the checks again, and that paying never buys the label", () => {
    stubMeta();
    const text = render(<ForFacilitiesPage />).container.textContent ?? "";

    expect(text).toMatch(/call and a visit/i);
    expect(text).toMatch(/last verified/i);
    expect(text).toMatch(/checks again|checked again/i);
    expect(text).toMatch(/Paying never buys the Verified label/);
    expect(screen.getByRole("link", { name: "How we verify" })).toHaveAttribute("href", "/how-we-verify");
  });

  it("explains Featured with the Sponsored label, 30 days, the rules, and never in SwiftRescue", () => {
    stubMeta();
    const text = render(<ForFacilitiesPage />).container.textContent ?? "";

    expect(text).toMatch(/appears first in matching searches, with a Sponsored label, for 30 days/);
    expect(text).toMatch(/Only a published, verified listing can be featured/);
    expect(text).toMatch(/never in SwiftRescue/i);
    expect(text).toMatch(/does not change verification/i);
  });

  it("gives the four steps to claim a facility in an ordered list", () => {
    stubMeta();
    render(<ForFacilitiesPage />);

    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent(/Sign up/);
    expect(steps[1]).toHaveTextContent(/ask to manage it, or register it/);
    expect(steps[2]).toHaveTextContent(/phones the facility/);
    expect(steps[3]).toHaveTextContent(/edit it, move or close it, add branches/);
    expect(screen.getByRole("list").tagName).toBe("OL");
  });
});

describe("the price", () => {
  it("is read from the API and shown as naira for 30 days", async () => {
    stubMeta({ featured_price_naira: "5000.00" });
    render(<ForFacilitiesPage />);

    expect(await screen.findByText("Price: ₦5,000 for 30 days")).toBeInTheDocument();
  });

  it("follows the API: a different price, with kobo when there are any", async () => {
    stubMeta({ featured_price_naira: "7500.50" });
    render(<ForFacilitiesPage />);

    expect(await screen.findByText("Price: ₦7,500.50 for 30 days")).toBeInTheDocument();
  });

  it("is not in the page's own text: no amount is written in the source", () => {
    const source = readSource("app/(public)/for-facilities/page.tsx") + readSource("components/facility/ForFacilitiesParts.tsx");
    expect(source).not.toMatch(/₦\s?\d|\b5[,.]?000\b/);
  });

  it("is left out, and the rest of the page stays, when the API cannot be reached", async () => {
    stubMeta("fails");
    render(<ForFacilitiesPage />);

    expect(await screen.findByRole("link", { name: "List your facility" })).toBeInTheDocument();
    expect(screen.queryByText(/^Price:/)).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Featured" })).toBeInTheDocument();
  });
});

describe("the two buttons", () => {
  it("shows Sign up to /sign-up and List your facility to /list-your-facility while sign-up is open", async () => {
    stubMeta({ signup_open: true });
    render(<ForFacilitiesPage />);

    expect(await screen.findByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: "List your facility" })).toHaveAttribute("href", "/list-your-facility");
    expect(screen.queryByText("Sign-up is not open yet.")).toBeNull();
  });

  it("shows no Sign up link while sign-up is closed, says so, and keeps List your facility", async () => {
    stubMeta({ signup_open: false });
    render(<ForFacilitiesPage />);

    expect(await screen.findByText("Sign-up is not open yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
    expect(screen.getByRole("link", { name: "List your facility" })).toHaveAttribute("href", "/list-your-facility");
  });

  it("shows no Sign up link when the API cannot be reached (a link to a page that cannot work is worse than none)", async () => {
    stubMeta("fails");
    render(<ForFacilitiesPage />);

    expect(await screen.findByText("Sign-up is not open yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
  });

  it("makes both buttons at least 50 px high", async () => {
    stubMeta({ signup_open: true });
    render(<ForFacilitiesPage />);

    for (const name of ["Sign up", "List your facility"]) {
      expect((await screen.findByRole("link", { name })).className).toMatch(/min-h-\[50px\]/);
    }
  });
});

describe("the page as a whole", () => {
  it("has a title and a description for the search engines", () => {
    expect(metadata.title).toBe("For facilities");
    expect(String(metadata.description).length).toBeGreaterThan(40);
  });

  it("names no city, gives no medical advice and makes no legal claim", () => {
    stubMeta();
    const { container } = render(<ForFacilitiesPage />);
    const text = container.textContent ?? "";

    expect(text).not.toContain(siteConfig.launchCity);
    expect(readSource("app/(public)/for-facilities/page.tsx")).not.toMatch(/Enugu/);
    expect(text).not.toMatch(/diagnos|treat(ment)?\b|cure\b|medical advice/i);
    expect(text).not.toMatch(/liab|governing law|binding|you agree|guarantee|comply/i);
  });

  it("shows no phone number and no address", () => {
    stubMeta();
    const { container } = render(<ForFacilitiesPage />);

    expect(container.textContent).not.toMatch(/\+234|0[789][01]\d[ -]?\d{3}[ -]?\d{4}|@/);
  });

  it("is a server page: only the small parts are client components, and it stores nothing", () => {
    const page = readSource("app/(public)/for-facilities/page.tsx");
    const parts = readSource("components/facility/ForFacilitiesParts.tsx");

    expect(page).not.toMatch(/["']use client["']|fetch\(|localStorage|sessionStorage|useEffect/);
    expect(parts).toMatch(/["']use client["']/);
    expect(parts).not.toMatch(/fetch\(|localStorage|sessionStorage|document\.cookie/);
  });

  it("makes every link at least 48 px high", async () => {
    stubMeta({ signup_open: true });
    const { container } = render(<ForFacilitiesPage />);
    await screen.findByRole("link", { name: "Sign up" });

    for (const link of container.querySelectorAll("a")) expect(link.className).toMatch(/min-h-12|min-h-\[50px\]/);
  });
});

describe("the header and the Menu", () => {
  it("point For facilities to this page", () => {
    expect(siteConfig.facilitiesLink.href).toBe("/for-facilities");
    expect(siteConfig.menuLinks.find((link) => link.label === "For facilities")?.href).toBe("/for-facilities");
  });
});
