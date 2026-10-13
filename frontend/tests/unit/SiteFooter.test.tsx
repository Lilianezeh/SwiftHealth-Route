// @vitest-environment jsdom
/** Tests for SiteFooter. Requirements: US-13, NFR-10, NFR-13 (credit). UI spec, "Layout" (redesigned on 2026-10-11).
 * Decision 14 and revision R10 (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md: the six links and the copyright
 * line; the Magnific credit was removed when the photos were replaced.
 */
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { siteConfig } from "@/config/site";

import { readSource } from "../helpers/source";

// The footer reads the address: on the home page it has no gap and no line above it (R26). Each test chooses the page.
const address = vi.hoisted(() => ({ pathname: "/find" }));
vi.mock("next/navigation", () => ({ usePathname: () => address.pathname }));

beforeEach(() => {
  address.pathname = "/find";
});

describe("SiteFooter", () => {
  it("puts its links and its © line in the same container as the section headings: max-w-6xl, 16 px at the sides (R26)", () => {
    const { container } = render(<SiteFooter />);

    const inner = container.querySelector("footer > div") as HTMLElement;
    expect(inner.className).toMatch(/\bmx-auto\b/);
    expect(inner.className).toMatch(/\bmax-w-6xl\b/);
    expect(inner.className).toMatch(/\bpx-4\b/);
    expect(inner.contains(screen.getByRole("navigation", { name: "Footer" }))).toBe(true);
    expect(inner.contains(screen.getByText("© 2026 SwiftHealth Route"))).toBe(true);
    expect(container.querySelector("footer")?.className).not.toMatch(/(^|\s)px-/); // no padding of its own at the far edge
  });

  it("has no top margin and no line above it on the home page, so there is no empty beige band (R26)", () => {
    address.pathname = "/";
    const { container } = render(<SiteFooter />);

    const footer = container.querySelector("footer") as HTMLElement;
    expect(footer.className).not.toMatch(/\bmt-\d+\b|\bborder-t\b|\bborder-black/);
  });

  it("keeps the 4 rem gap and the thin line above it on every other page", () => {
    for (const pathname of ["/find", "/search", "/emergency", "/privacy", "/listing/night-pharmacy-a"]) {
      address.pathname = pathname;
      const { container, unmount } = render(<SiteFooter />);

      const footer = container.querySelector("footer") as HTMLElement;
      expect(footer.className, pathname).toMatch(/\bmt-16\b/);
      expect(footer.className, pathname).toMatch(/\bborder-t\b/);
      unmount();
    }
  });

  it("keeps its six links, in the same order", () => {
    render(<SiteFooter />);

    const links = within(screen.getByRole("navigation", { name: "Footer" })).getAllByRole("link");

    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["About", "/about"],
      ["How we verify", "/how-we-verify"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Contact", "/contact"],
      ["List your facility", "/list-your-facility"],
    ]);
  });

  it("makes the footer links at least 48 px high", () => {
    render(<SiteFooter />);

    for (const link of within(screen.getByRole("navigation", { name: "Footer" })).getAllByRole("link")) {
      expect(link.className, link.textContent ?? "").toMatch(/min-h-12(\s|$)/);
    }
  });

  it("has no photo credit and no outside link: no photo of the site needs one (owner, 2026-10-12)", () => {
    const { container } = render(<SiteFooter />);

    expect(container.querySelectorAll('a[href^="http"], a[target="_blank"]')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Images designed by|photo credit|Photo by/i);
  });

  it("says nothing of Magnific or Unsplash, in the page or in the source", () => {
    const { container } = render(<SiteFooter />);

    // The code, without its comments: a comment may say why the credit was removed.
    const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const text of [
      container.textContent ?? "",
      withoutComments(readSource("components/layout/SiteFooter.tsx")),
      withoutComments(readSource("config/site.ts")),
    ]) {
      expect(text.toLowerCase()).not.toContain("magnific");
      expect(text.toLowerCase()).not.toContain("unsplash");
    }
    expect(readSource("config/site.ts")).not.toContain("photoCredit");
  });

  it("ends with the copyright line, and the year comes from siteConfig, not from the clock", () => {
    render(<SiteFooter />);

    expect(siteConfig.copyrightYear).toBe(2026);
    expect(screen.getByText(`© ${siteConfig.copyrightYear} SwiftHealth Route`)).toBeInTheDocument();
    const source = readSource("components/layout/SiteFooter.tsx");
    expect(source).not.toMatch(/new Date|getFullYear|Date\.now/);
  });

  it("puts the copyright line after the links, and it is the last thing in the footer", () => {
    const { container } = render(<SiteFooter />);

    const text = container.textContent ?? "";

    expect(text.indexOf("Contact")).toBeLessThan(text.indexOf("© 2026 SwiftHealth Route"));
    expect(text.trim().endsWith("© 2026 SwiftHealth Route")).toBe(true);
  });
});
