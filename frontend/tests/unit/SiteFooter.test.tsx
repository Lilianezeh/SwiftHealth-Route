// @vitest-environment jsdom
/** Tests for SiteFooter. Requirements: US-13, NFR-10, NFR-13 (credit). UI spec, "Layout" (redesigned on 2026-10-11).
 * Decision 14 in specs/2026-10-11-home-redesign/requirements.md: the six links, the Magnific credit, the copyright line.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { siteConfig } from "@/config/site";

import { readSource } from "../helpers/source";

describe("SiteFooter", () => {
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

  it('has the credit "Images designed by Magnific" as a link to https://www.magnific.com', () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: /^Images designed by Magnific/ })).toHaveAttribute(
      "href",
      "https://www.magnific.com",
    );
  });

  it("opens the credit in a new tab, safely, and tells a screen reader so", () => {
    render(<SiteFooter />);

    const credit = screen.getByRole("link", { name: /^Images designed by Magnific/ });
    expect(credit).toHaveAttribute("target", "_blank");
    expect(credit).toHaveAttribute("rel", "noopener noreferrer");
    expect(credit).toHaveTextContent("(opens in a new tab)");
  });

  it("has no Unsplash credit", () => {
    const { container } = render(<SiteFooter />);

    expect(container.textContent?.toLowerCase()).not.toContain("unsplash");
    expect(readSource("components/layout/SiteFooter.tsx").toLowerCase()).not.toContain("unsplash");
    expect(readSource("config/site.ts").toLowerCase()).not.toContain("unsplash");
  });

  it("ends with the copyright line, and the year comes from siteConfig, not from the clock", () => {
    render(<SiteFooter />);

    expect(siteConfig.copyrightYear).toBe(2026);
    expect(screen.getByText(`© ${siteConfig.copyrightYear} SwiftHealth`)).toBeInTheDocument();
    const source = readSource("components/layout/SiteFooter.tsx");
    expect(source).not.toMatch(/new Date|getFullYear|Date\.now/);
  });

  it("puts the credit after the links and the copyright line last", () => {
    const { container } = render(<SiteFooter />);

    const text = container.textContent ?? "";

    expect(text.indexOf("Contact")).toBeLessThan(text.indexOf("Images designed by Magnific"));
    expect(text.indexOf("Images designed by Magnific")).toBeLessThan(text.indexOf("© 2026 SwiftHealth"));
  });
});
