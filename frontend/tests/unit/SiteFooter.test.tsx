// @vitest-environment jsdom
/** Tests for SiteFooter. Requirements: US-13, NFR-10, NFR-13 (credit). UI spec, "Layout" (redesigned on 2026-10-11).
 * Decision 14 and revision R10 (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md: the six links and the copyright
 * line. The Magnific credit came back on 2026-10-28 as ONE line at the bottom right of the footer (specs/2026-10-28-hero-slideshow/).
 */
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { siteConfig } from "@/config/site";

import { readSource } from "../helpers/source";

// The footer is a server component: the route group of the page tells it whether this is the home page (R44), where it has no gap and
// no line above it (R26). Each test chooses the page.
const address = { pathname: "/find" };

function FooterOnPage() {
  return <SiteFooter isHomePage={address.pathname === "/"} />;
}

beforeEach(() => {
  address.pathname = "/find";
});

describe("SiteFooter", () => {
  it("puts its links and its © line in the same container as the section headings: max-w-6xl, 16 px at the sides (R26)", () => {
    const { container } = render(<FooterOnPage />);

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
    const { container } = render(<FooterOnPage />);

    const footer = container.querySelector("footer") as HTMLElement;
    expect(footer.className).not.toMatch(/\bmt-\d+\b|\bborder-t\b|\bborder-black/);
  });

  it("keeps the 4 rem gap and the thin line above it on every other page", () => {
    for (const pathname of ["/find", "/search", "/emergency", "/privacy", "/listing/night-pharmacy-a"]) {
      address.pathname = pathname;
      const { container, unmount } = render(<FooterOnPage />);

      const footer = container.querySelector("footer") as HTMLElement;
      expect(footer.className, pathname).toMatch(/\bmt-16\b/);
      expect(footer.className, pathname).toMatch(/\bborder-t\b/);
      unmount();
    }
  });

  it("keeps its six links, in the same order", () => {
    render(<FooterOnPage />);

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
    render(<FooterOnPage />);

    for (const link of within(screen.getByRole("navigation", { name: "Footer" })).getAllByRole("link")) {
      expect(link.className, link.textContent ?? "").toMatch(/min-h-12(\s|$)/);
    }
  });

  it("has exactly one outside link, the photo credit, and no other credit wording (since 2026-10-28); the Unsplash photos need none", () => {
    const { container } = render(<FooterOnPage />);

    expect(container.querySelectorAll('a[href^="http"], a[target="_blank"]')).toHaveLength(1);
    expect(container.textContent).not.toMatch(/Images designed by|photo credit|Photo by/i);
    expect(container.textContent?.toLowerCase()).not.toContain("unsplash");
  });

  it("keeps the credit's address and words in the photo config, not in siteConfig: the footer reads MAGNIFIC_CREDIT", () => {
    const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(withoutComments(readSource("components/layout/SiteFooter.tsx"))).toContain("MAGNIFIC_CREDIT");
    expect(withoutComments(readSource("config/site.ts")).toLowerCase()).not.toContain("magnific");
    expect(readSource("config/site.ts")).not.toContain("photoCredit");
  });

  it("ends with the copyright line, and the year comes from siteConfig, not from the clock", () => {
    render(<FooterOnPage />);

    expect(siteConfig.copyrightYear).toBe(2026);
    expect(screen.getByText(`© ${siteConfig.copyrightYear} SwiftHealth Route`)).toBeInTheDocument();
    const source = readSource("components/layout/SiteFooter.tsx");
    expect(source).not.toMatch(/new Date|getFullYear|Date\.now/);
  });

  it("puts the copyright line after the links, and the photo credit after the copyright line, at the bottom of the footer", () => {
    const { container } = render(<FooterOnPage />);

    const text = container.textContent ?? "";

    expect(text.indexOf("Contact")).toBeLessThan(text.indexOf("© 2026 SwiftHealth Route"));
    expect(text.indexOf("© 2026 SwiftHealth Route")).toBeLessThan(text.indexOf("Photos: Designed by Magnific"));
  });
});

describe("the photo credit (owner, 2026-10-28: one line in the footer instead of a credit on each photo)", () => {
  it("is one link, 'Photos: Designed by Magnific', to www.magnific.com, opening in a new tab in a safe way", () => {
    render(<FooterOnPage />);

    const links = screen.getAllByRole("link", { name: /Magnific/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent(/^Photos: Designed by Magnific/);
    expect(links[0]).toHaveAccessibleName("Photos: Designed by Magnific (opens in a new tab)");
    expect(links[0]).toHaveAttribute("href", "https://www.magnific.com");
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0].getAttribute("rel")).toContain("noopener");
    expect(links[0].getAttribute("rel")).toContain("noreferrer");
  });

  it("is in the footer of every page, on the home page too, and nowhere else (not in the Footer navigation)", () => {
    for (const pathname of ["/", "/find", "/emergency", "/privacy"]) {
      address.pathname = pathname;
      const { container, unmount } = render(<FooterOnPage />);

      expect(within(container.querySelector("footer") as HTMLElement).getAllByRole("link", { name: /Magnific/ })).toHaveLength(1);
      expect(within(screen.getByRole("navigation", { name: "Footer" })).queryByRole("link", { name: /Magnific/ })).toBeNull();
      unmount();
    }
  });

  it("is 16 px, at least 48 px high to tap, in the link colour of the theme (so it passes AA in Light and in Dark), underlined, at the bottom right", () => {
    render(<FooterOnPage />);

    const credit = screen.getByRole("link", { name: /Magnific/ });
    expect(credit.className).toMatch(/\btext-base\b/);
    expect(credit.className).toMatch(/\bmin-h-12\b/);
    expect(credit.className).toMatch(/\btext-forest\b/); // forest: 5.6:1 on the light page, 9.8:1 on the dark one
    expect(credit.className).toMatch(/\bunderline\b/);
    expect(credit.className).toMatch(/\bml-auto\b/); // right-aligned, also when it wraps under the © line on a phone
    expect(credit.closest("div")?.className).toMatch(/\bflex-wrap\b/); // tidy at 320 px: it wraps instead of running over the edge
  });

  it("has no photo credit in any other component (the hero, the emergency photos, the slideshow): the one place is the footer", () => {
    for (const file of ["components/home/HeroSlideshow.tsx", "components/home/HomeHero.tsx", "components/home/FindByType.tsx", "components/emergency/GroupPhoto.tsx"]) {
      expect(readSource(file), file).not.toMatch(/Magnific|MAGNIFIC_CREDIT/);
    }
    expect(readSource("components/layout/SiteFooter.tsx")).toMatch(/MAGNIFIC_CREDIT/);
  });
});
