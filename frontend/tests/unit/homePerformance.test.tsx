// @vitest-environment jsdom
/** The home page loads fast: what the code can guarantee. Requirements: NFR-01, NFR-10, US-13. UI spec, "Accessibility and
 * performance" (the home page's loading rules); revisions R42 to R47 (2026-10-13) in specs/2026-10-11-home-redesign/requirements.md.
 * What only a browser can show (one hero photo per width, the first HTML, no other page's code) is checked in
 * tests/end-to-end/home-layout.spec.ts.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import Home from "@/app/(home)/page";
import { HomeImage } from "@/components/home/HomeImage";
import { PageFrame } from "@/components/layout/PageFrame";
import { HOME_PHOTOS } from "@/config/home";

import { readSource } from "../helpers/source";

// next/link stands in for itself here, so that the test can read the `prefetch` prop that the real component keeps to itself.
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean | null; children?: React.ReactNode }) =>
      createElement("a", { href, "data-prefetch": String(prefetch), ...rest }, children),
  };
});

const APP = join(process.cwd(), "src", "app");

/** The addresses the page files give, with the route groups "(name)" taken out, as Next.js does. */
function addressesOfThePages(folder = APP, parts: string[] = []): string[] {
  const addresses: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
      addresses.push(...addressesOfThePages(join(folder, entry.name), isGroup ? parts : [...parts, entry.name]));
    } else if (entry.name === "page.tsx") {
      addresses.push(`/${parts.join("/")}`);
    }
  }
  return addresses.sort();
}

describe("no page of another address is downloaded early: every link of the home page has prefetch={false} (R43)", () => {
  it("has prefetch false on every link of the header, the page and the footer", () => {
    const { container } = render(
      <PageFrame isHomePage>
        <Home />
      </PageFrame>,
    );

    // The skip link ("#main") stays on the same page, so there is nothing to prefetch (phase 13c).
    const links = [...container.querySelectorAll("a")].filter((link) => !(link.getAttribute("href") ?? "").startsWith("#"));
    expect(links.length).toBeGreaterThanOrEqual(15); // the logo, 2 header links, the hero button, 5 tiles, the owners button, 6 footer links
    for (const link of links) expect(link.getAttribute("data-prefetch"), link.textContent ?? "").toBe("false");
  });

  it("has it on the links of the phone menu too", async () => {
    render(<PageFrame isHomePage>{null}</PageFrame>);

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const panel = screen.getByRole("navigation", { name: "Menu links" });

    const links = [...panel.querySelectorAll("a")];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("data-prefetch"), link.textContent ?? "").toBe("false");
  });
});

describe("the header and the footer are server components (R44)", () => {
  it("send no JavaScript of their own: no use client and no usePathname in the layout components except the Menu button", () => {
    for (const file of ["PageFrame", "SiteHeader", "HeaderNavigation", "SiteFooter", "Logo"]) {
      const source = readSource(`components/layout/${file}.tsx`);
      expect(source, file).not.toMatch(/["']use client["']/);
      expect(source, file).not.toMatch(/usePathname|useEffect|useState|next\/navigation/);
    }
    expect(readSource("components/layout/MobileMenu.tsx")).toMatch(/^"use client";/); // the one client part of the header
  });

  it("sends no JavaScript from the home page's own components either", () => {
    const folder = join(process.cwd(), "src", "components", "home");
    for (const file of readdirSync(folder)) {
      expect(readFileSync(join(folder, file), "utf8"), file).not.toMatch(/["']use client["']/);
    }
  });
});

describe("the route groups choose the header and the footer, and no address changes (R44)", () => {
  it("keeps exactly the addresses the site had before the move", () => {
    expect(addressesOfThePages()).toEqual(
      [
        "/",
        "/about",
        "/admin",
        "/admin/import-export", // phase 14, CSV import and export
        "/admin/listings", // phase 10, the staff list
        "/admin/listings/[id]", // phase 10, the editor of one listing
        "/admin/listings/[id]/checks", // phase 10, its verification log
        "/admin/listings/new", // phase 10, a new listing
        "/admin/login", // phase 10, the staff login
        "/admin/recheck", // phase 11, listings past or near their check date
        "/admin/reports", // phase 11, the report queue
        "/admin/staff", // phase 10, the staff accounts
        "/blood",
        "/blood/donate", // phase 8, donation centres
        "/contact",
        "/emergency",
        "/find",
        "/how-we-verify",
        "/list-your-facility",
        "/listing/[slug]",
        "/privacy",
        "/provider",
        "/report/[slug]", // was /report/[id] until phase 9 (decision B1 in specs/2026-10-20-reports/)
        "/search",
        "/terms",
      ].sort(),
    );
  });

  it("has the home page in app/(home), the dashboards in app/(dashboards), and nothing left at the old places", () => {
    for (const file of ["(home)/page.tsx", "(home)/layout.tsx", "(public)/layout.tsx", "(dashboards)/layout.tsx", "(dashboards)/admin/page.tsx", "(dashboards)/provider/page.tsx", "not-found.tsx"]) {
      expect(existsSync(join(APP, file)), file).toBe(true);
    }
    for (const oldPlace of ["page.tsx", "admin", "provider"]) expect(existsSync(join(APP, oldPlace)), oldPlace).toBe(false);
  });

  it("draws the header and the footer in the layouts of the groups, not in the root layout", () => {
    const root = readSource("app/layout.tsx");
    expect(root).not.toMatch(/SiteHeader|SiteFooter|PageFrame/);
    expect(root).toMatch(/<html lang="en">/);
    expect(readSource("app/(home)/layout.tsx")).toMatch(/<PageFrame isHomePage>/);
    for (const layout of ["app/(public)/layout.tsx", "app/(dashboards)/layout.tsx", "app/not-found.tsx"]) {
      const source = readSource(layout);
      expect(source, layout).toMatch(/<PageFrame>|<PageFrame isHomePage=\{false\}>/); // the blue bar and the gap above the footer
      expect(source, layout).not.toMatch(/isHomePage>|isHomePage \/>/);
    }
  });
});

describe("the owners' photo (R45)", () => {
  it("is drawn without the next/image component: the plain img attributes, still lazy, with its size and its alt text", () => {
    const source = readSource("components/home/HomeImage.tsx");
    expect(source).not.toMatch(/import Image\b/); // the next/image component brings client JavaScript
    expect(source).toMatch(/import \{ getImageProps \} from "next\/image"/); // its server-side helper does not
    expect(source).not.toMatch(/<Image\b/);

    const { container } = render(<HomeImage photo={HOME_PHOTOS.owner} className="h-auto" />);
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/images/home/hero4-portrait.webp");
    expect(image).toHaveAttribute("width", "800");
    expect(image).toHaveAttribute("height", "1200");
    expect(image).toHaveAttribute("alt", HOME_PHOTOS.owner.alt);
    expect(image).toHaveAttribute("loading", "lazy"); // the native lazy loading the owner chose (no scroll watcher)
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).not.toHaveAttribute("fetchpriority", "high"); // only the hero is high priority
  });
});

describe("the photos are cached for a year, and a new photo gets a new file name (R42)", () => {
  const netlify = readFileSync(join(process.cwd(), "..", "netlify.toml"), "utf8");

  it("sends Cache-Control public, max-age=31536000, immutable for /images/*", () => {
    const block = netlify.match(/\[\[headers\]\]\s*\n\s*for\s*=\s*"\/images\/\*"\s*\n\s*\[headers\.values\]\s*\n\s*Cache-Control\s*=\s*"([^"]+)"/);
    expect(block, "a [[headers]] block for /images/*").not.toBeNull();
    expect(block?.[1]).toBe("public, max-age=31536000, immutable");
  });

  it("does not touch /_next/static (the Netlify runtime already caches it for a year) or the pages", () => {
    expect(netlify).not.toMatch(/for\s*=\s*"\/_next/);
    expect(netlify).not.toMatch(/for\s*=\s*"\/\*"/);
  });

  it("says in the image script that a new photo needs a new file name", () => {
    expect(readFileSync(join(process.cwd(), "scripts", "optimize-home-images.mjs"), "utf8")).toMatch(/new file name/i);
  });
});
