// @vitest-environment jsdom
/** The whole home page: seven parts, in the owner's order. Requirements: US-13, NFR-01, NFR-10, NFR-12, FR-02.
 * UI spec 2.1 (the exact words are the owner's, 2026-10-11; simplified on 2026-10-12 after the owner's review of the preview;
 * a hero like the reference site and no How it works since the fourth revision, R18 to R24);
 * decisions 6, 12 and revisions R1 to R24 in specs/2026-10-11-home-redesign/requirements.md. Parts 1 and 7 (header and footer)
 * come from the root layout, so the test renders them around the page the same way the layout does.
 */
import { render, screen, within } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { metadata } from "@/app/layout";
import Home, { metadata as homeMetadata } from "@/app/(home)/page";
import { FacilityOwners } from "@/components/home/FacilityOwners";
import { PageFrame } from "@/components/layout/PageFrame";
import { HERO_SLIDES } from "@/config/heroPhotos";
import { HOME_PHOTOS, HOME_WORDS } from "@/config/home";
import { siteConfig } from "@/config/site";

import { readSource } from "../helpers/source";

// The header, the main part and the footer come from the layout of the route group `app/(home)/` (R44): PageFrame with
// isHomePage, which this test renders around the page the same way that layout does.
function renderWholePage() {
  return render(
    <PageFrame isHomePage>
      <Home />
    </PageFrame>,
  );
}

describe("the facility owners part", () => {
  it("has the owner photo, the exact heading, the exact text and a List your facility button", () => {
    render(<FacilityOwners />);

    expect(screen.getByRole("heading", { level: 2, name: "Own or manage a healthcare facility?" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "List your facility on SwiftHealth Route so people nearby can find you, call you and get directions. Listing is free during our launch, and every listing is checked by our team before it goes live.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Run a hospital, clinic or pharmacy/)).not.toBeInTheDocument();
    const button = screen.getByRole("link", { name: "List your facility" });
    expect(button).toHaveAttribute("href", "/list-your-facility");
    expect(button.className).not.toMatch(/emergency/);
    const image = screen.getByAltText(HOME_PHOTOS.owner.alt);
    expect(image).toHaveAttribute("src", "/images/home/hero4-portrait.webp");
    expect(image).toHaveAttribute("width", "800");
    expect(image).toHaveAttribute("height", "1200");
    expect(image).toHaveAttribute("loading", "lazy");
  });

  it("shows the portrait photo whole: never cropped or stretched, full width on a phone, 26 rem high from 768 px (R25)", () => {
    render(<FacilityOwners />);

    const image = screen.getByAltText(HOME_PHOTOS.owner.alt);
    expect(image.className).not.toMatch(/\bobject-cover\b|(^|\s)h-full\b|\baspect-/); // nothing that cuts it
    expect(image.className).toMatch(/(^|\s)h-auto\b/);
    expect(image.className).toMatch(/(^|\s)w-full\b/); // the full width of the content on a phone
    expect(image.className).toMatch(/\bmd:h-\[26rem\]/); // smaller than the 32 rem of before
    expect(image.className).toMatch(/\bmd:w-auto\b/); // the width follows from the 2:3 shape (about 17.3 rem)
    expect(image.className).toMatch(/\bmd:shrink-0\b/);
    expect(image.className).not.toMatch(/32rem/);
  });

  it("has the text right beside the photo from 768 px: a normal gap, both vertically centred, no big empty space", () => {
    const { container } = render(<FacilityOwners />);

    const row = container.querySelector("section > div") as HTMLElement;
    expect(row.className).toMatch(/\bmax-w-6xl\b/); // the same container as the headings
    expect(row.className).toMatch(/\bmd:flex\b/);
    expect(row.className).toMatch(/\bmd:items-center\b/); // both vertically centred
    expect(row.className).toMatch(/\bmd:gap-10\b/); // 2.5 rem between the photo and the text
    expect(row.className).not.toMatch(/\bmd:grid-cols-2\b|\bmd:justify-between\b/); // two half-width columns left a big gap
    const text = screen.getByRole("heading", { level: 2 }).parentElement as HTMLElement;
    expect(text.className).toMatch(/\bmd:max-w-xl\b/); // 36 rem at most
    expect(row.contains(screen.getByAltText(HOME_PHOTOS.owner.alt))).toBe(true);
    expect(row.contains(text)).toBe(true);
  });
});

describe("the whole page", () => {
  it("has the seven parts in the owner's order: header, hero, Overview, Why SwiftHealth Route, Find by type, For facility owners, footer", () => {
    renderWholePage();

    const landmarks = [
      screen.getByRole("banner"),
      screen.getByRole("heading", { level: 1 }),
      ...["What is SwiftHealth Route?", "Why SwiftHealth Route", "Find by type"].map((name) =>
        screen.getByRole("heading", { level: 2, name }),
      ),
      screen.getByRole("heading", { level: 2, name: "Own or manage a healthcare facility?" }),
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

  it("has one h1 and four h2 (overview, why, find by type, facility owners), and no heading deeper than h3", () => {
    renderWholePage();

    const levels = screen.getAllByRole("heading").map((heading) => Number(heading.tagName.slice(1)));

    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels.filter((level) => level === 2)).toHaveLength(4);
    expect(screen.queryByRole("heading", { name: "How it works" })).not.toBeInTheDocument();
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
    const source = readSource("app/(home)/page.tsx");

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
      "app/(home)/page.tsx",
      "app/(home)/layout.tsx",
      "app/layout.tsx",
      "config/home.ts",
      "components/home/HomeHero.tsx",
      "components/home/Overview.tsx",
      "components/home/FindByType.tsx",
      "components/home/WhySwiftHealth.tsx",
      "components/home/FacilityOwners.tsx",
      "components/layout/SiteHeader.tsx",
      "components/layout/HeaderNavigation.tsx",
      "components/layout/Logo.tsx",
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
    // "24-hour services" (the owner's words of 2026-10-15) names a kind of service; it is not a statistic.
    // "112" is the national emergency number (the SwiftRescue card says "with 112 first"); it is not a statistic either.
    const text = (copy.textContent ?? "").replace(String(siteConfig.copyrightYear), "").replaceAll("24-hour", "").replaceAll("112", "");

    expect(text).not.toContain("%");
    expect(text).not.toMatch(/\d/);
  });

  it("has no testimonial and no quotation marks around words of a person", () => {
    const { container } = renderWholePage();

    expect(container.querySelectorAll("blockquote, q")).toHaveLength(0);
  });

  it("has one outside link on the page: the fixed 'Designed by Magnific' credit of the hero (owner, 2026-10-22); the Unsplash photo has none", () => {
    const { container } = renderWholePage();

    const outside = [...container.querySelectorAll('a[href^="http"], a[target="_blank"]')];

    expect(outside.map((link) => link.getAttribute("href"))).toEqual(["https://www.magnific.com"]);
    expect(container.textContent?.toLowerCase()).not.toMatch(/unsplash/);
    expect(container.textContent?.match(/magnific/gi)).toHaveLength(1);
  });

  it("has the hero's first photo and the owner photo at first, each with alt text, a width and a height (the other slides come later)", () => {
    const { container } = renderWholePage();

    const images = [...container.querySelectorAll("img")];

    expect(images.map((image) => image.getAttribute("src"))).toEqual([HERO_SLIDES[0].wideSrc, HOME_PHOTOS.owner.src]);
    for (const image of images) {
      expect(image.getAttribute("alt")?.length, image.getAttribute("src") ?? "").toBeGreaterThan(10);
      expect(Number(image.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(image.getAttribute("height"))).toBeGreaterThan(0);
    }
  });

  it("loads only the hero's first photo at once: the owner photo is lazy", () => {
    const { container } = renderWholePage();

    const eager = [...container.querySelectorAll("img")].filter((image) => image.getAttribute("loading") !== "lazy");

    expect(eager.map((image) => image.getAttribute("src"))).toEqual([HERO_SLIDES[0].wideSrc]);
  });

  it("uses the red emergency colour once: the SwiftRescue button of the header", () => {
    const { container } = renderWholePage();

    const red = [...container.querySelectorAll("a, button, div, section, span")].filter((element) =>
      /\b(bg|text|border)-emergency\b/.test(element.className),
    );

    expect(red.map((element) => element.textContent)).toEqual(["SwiftRescue"]);
  });

  it("has no Find care link in the header on the home page, because the hero button does the same", () => {
    renderWholePage();

    expect(within(screen.getByRole("banner")).queryByRole("link", { name: "Find care" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find care near me" })).toHaveAttribute("href", "/find"); // the hero button
    expect(within(screen.getByRole("banner")).getByRole("link", { name: "For facilities" })).toBeInTheDocument();
  });

  it("has the Overview right after the hero, then the part named Why SwiftHealth Route (it was Benefits)", () => {
    renderWholePage();

    const hero = screen.getByRole("heading", { level: 1 });
    const overview = screen.getByRole("heading", { level: 2, name: "What is SwiftHealth Route?" });
    const why = screen.getByRole("heading", { level: 2, name: "Why SwiftHealth Route" });
    expect(hero.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overview.compareDocumentPosition(why) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Benefits" })).not.toBeInTheDocument();
  });

  it("has its own page description: the first two sentences of the Overview, word for word, with no city (D7)", () => {
    const description = String(homeMetadata.description);

    expect(description).toBe(
      "SwiftHealth Route is a healthcare directory built for Nigeria. Find hospitals, clinics, maternity homes, pharmacies and laboratories near you.",
    );
    // It is the Overview's first sentence, and the first clause of its second one.
    expect(HOME_WORDS.overview.text.startsWith("SwiftHealth Route is a healthcare directory built for Nigeria.")).toBe(true);
    expect(HOME_WORDS.overview.text).toContain("Find hospitals, clinics, maternity homes, pharmacies and laboratories near you,");
    expect(description.toLowerCase()).not.toContain("enugu");
    expect(description.length).toBeLessThanOrEqual(160);
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
    expect(within(main).getByRole("search")).toHaveAttribute("action", "/search");
  });
});
