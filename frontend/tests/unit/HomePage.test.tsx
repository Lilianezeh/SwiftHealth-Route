// @vitest-environment jsdom
/** The whole home page: seven parts, in the owner's order. Requirements: US-13, NFR-01, NFR-10, NFR-12, FR-02.
 * UI spec 2.1 (the exact words are the owner's, 2026-10-11; simplified on 2026-10-12 after the owner's review of the preview);
 * decisions 6, 12 and revision R1 to R7 in specs/2026-10-11-home-redesign/requirements.md. Parts 1 and 7 (header and footer)
 * come from the root layout, so the test renders them around the page the same way the layout does.
 */
import { render, screen, within } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { metadata } from "@/app/layout";
import Home from "@/app/page";
import { FacilityOwners } from "@/components/home/FacilityOwners";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { HOME_PHOTOS } from "@/config/home";
import { siteConfig } from "@/config/site";

import { readSource } from "../helpers/source";

function renderWholePage() {
  return render(
    <>
      <SiteHeader />
      <main>
        <Home />
      </main>
      <SiteFooter />
    </>,
  );
}

describe("the facility owners part", () => {
  it("has the owner photo, the exact heading, the exact text and a List your facility button", () => {
    render(<FacilityOwners />);

    expect(screen.getByRole("heading", { level: 2, name: "Run a hospital, clinic or pharmacy?" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "List your facility for free and help people find you when they need you. We verify every listing before it goes live.",
      ),
    ).toBeInTheDocument();
    const button = screen.getByRole("link", { name: "List your facility" });
    expect(button).toHaveAttribute("href", "/list-your-facility");
    expect(button.className).not.toMatch(/emergency/);
    const image = screen.getByAltText(HOME_PHOTOS.owner.alt);
    expect(image).toHaveAttribute("src", HOME_PHOTOS.owner.src);
    expect(image).toHaveAttribute("loading", "lazy");
  });
});

describe("the whole page", () => {
  it("has the seven parts in the owner's order", () => {
    renderWholePage();

    const landmarks = [
      screen.getByRole("banner"),
      screen.getByRole("heading", { level: 1 }),
      ...["How it works", "Browse by type", "Why SwiftHealth"].map((name) =>
        screen.getByRole("heading", { level: 2, name }),
      ),
      screen.getByRole("heading", { level: 2, name: "Run a hospital, clinic or pharmacy?" }),
      screen.getByRole("contentinfo"),
    ];

    for (let index = 1; index < landmarks.length; index += 1) {
      const before = landmarks[index - 1];
      const after = landmarks[index];
      expect(
        before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING,
        `${after.textContent} should come after ${before.textContent}`,
      ).toBeTruthy();
    }
  });

  it("has one h1 and four h2 (how it works, browse, why, facility owners), and no heading deeper than h3", () => {
    renderWholePage();

    const levels = screen.getAllByRole("heading").map((heading) => Number(heading.tagName.slice(1)));

    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels.filter((level) => level === 2)).toHaveLength(4); // how it works, browse, why, facility owners
    expect(Math.max(...levels)).toBeLessThanOrEqual(3);
  });

  it("has no SwiftRescue band and no About part: they were removed on 2026-10-12", () => {
    const { container } = renderWholePage();

    expect(screen.queryByRole("heading", { name: "In an emergency, every second counts." })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Starting in|Growing across/ })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Growing across Nigeria|every second counts/);
    for (const file of ["RescueBand", "AboutSwiftHealth"]) {
      expect(existsSync(join(process.cwd(), "src", "components", "home", `${file}.tsx`)), file).toBe(false);
    }
  });

  it("makes no request and reads no API: the page is not async and does not call getHealth or fetch", () => {
    const source = readSource("app/page.tsx");

    expect(source).not.toMatch(/getHealth|fetch\(|\basync\b|\bawait\b/);
    expect(source).not.toMatch(/lib\/api/);
  });

  it("names no city anywhere on the page: not in the text, not in the page description, not in the components", () => {
    const { container } = renderWholePage();
    const description = String(metadata.description);

    expect(container.textContent?.toLowerCase()).not.toContain("enugu");
    expect(description.toLowerCase()).not.toContain("enugu");
    expect(`${container.textContent} ${description}`.toLowerCase()).not.toMatch(/more cities|now live|only in/);
    for (const file of [
      "app/page.tsx",
      "app/layout.tsx",
      "config/home.ts",
      "components/home/HomeHero.tsx",
      "components/home/HowItWorks.tsx",
      "components/home/BrowseByType.tsx",
      "components/home/WhySwiftHealth.tsx",
      "components/home/FacilityOwners.tsx",
      "components/layout/SiteHeader.tsx",
      "components/layout/SiteFooter.tsx",
    ]) {
      expect(readSource(file), file).not.toMatch(/enugu/i);
    }
  });

  it("keeps siteConfig.launchCity, because other parts of the app may use it (the home page does not)", () => {
    expect(siteConfig.launchCity).toBe("Enugu");
  });

  it("has a page description that is the name, the tagline and what the site does", () => {
    const description = String(metadata.description);

    expect(description).toContain(siteConfig.name);
    expect(description).toContain(siteConfig.tagline);
  });

  it("has no percent sign and no number but the year: no invented statistics", () => {
    const { container } = renderWholePage();
    const copy = container.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[aria-hidden="true"]').forEach((element) => element.remove()); // the step numbers
    const text = (copy.textContent ?? "").replace(String(siteConfig.copyrightYear), "");

    expect(text).not.toContain("%");
    expect(text).not.toMatch(/\d/);
  });

  it("has no testimonial and no quotation marks around words of a person", () => {
    const { container } = renderWholePage();

    expect(container.querySelectorAll("blockquote, q")).toHaveLength(0);
  });

  it("has two images only, the hero and the owner photo, each with alt text, a width and a height", () => {
    const { container } = renderWholePage();

    const images = [...container.querySelectorAll("img")];

    expect(images.map((image) => image.getAttribute("src"))).toEqual([HOME_PHOTOS.hero.src, HOME_PHOTOS.owner.src]);
    for (const image of images) {
      expect(image.getAttribute("alt")?.length, image.getAttribute("src") ?? "").toBeGreaterThan(10);
      expect(Number(image.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(image.getAttribute("height"))).toBeGreaterThan(0);
    }
  });

  it("loads only the hero at once: the owner photo is lazy", () => {
    const { container } = renderWholePage();

    const eager = [...container.querySelectorAll("img")].filter((image) => image.getAttribute("loading") !== "lazy");

    expect(eager.map((image) => image.getAttribute("src"))).toEqual([HOME_PHOTOS.hero.src]);
  });

  it("uses the red emergency colour once: the SwiftRescue button of the header", () => {
    const { container } = renderWholePage();

    const red = [...container.querySelectorAll("a, button, div, section, span")].filter((element) =>
      /\b(bg|text|border)-emergency\b/.test(element.className),
    );

    expect(red.map((element) => element.textContent)).toEqual(["SwiftRescue"]);
  });

  it("has no Emergency help and no Open SwiftRescue button: the way to SwiftRescue is the header's red button", () => {
    renderWholePage();

    expect(screen.queryByRole("link", { name: "Emergency help" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open SwiftRescue" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SwiftRescue" })).toHaveAttribute("href", "/emergency");
  });

  it("points every button of the page to the right place", () => {
    renderWholePage();

    const main = screen.getByRole("main");
    const targets = (name: string) => within(main).getByRole("link", { name }).getAttribute("href");

    expect(targets("Find care near me")).toBe("/find");
    expect(targets("List your facility")).toBe("/list-your-facility");
  });
});
