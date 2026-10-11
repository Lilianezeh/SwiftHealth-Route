// @vitest-environment jsdom
/** The whole home page: all nine parts, in the owner's order. Requirements: US-13, NFR-01, NFR-10, NFR-12, FR-02.
 * UI spec 2.1 (the exact words are the owner's, 2026-10-11); decisions 6, 10, 12, 13 in
 * specs/2026-10-11-home-redesign/requirements.md. Parts 1 and 9 (header and footer) come from the root layout, so the test
 * renders them around the page the same way the layout does.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";
import { metadata } from "@/app/layout";
import { AboutSwiftHealth } from "@/components/home/AboutSwiftHealth";
import { FacilityOwners } from "@/components/home/FacilityOwners";
import { RescueBand } from "@/components/home/RescueBand";
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

describe("the rescue band", () => {
  it("has the exact heading and a red Open SwiftRescue button to /emergency", () => {
    render(<RescueBand />);

    expect(
      screen.getByRole("heading", { level: 2, name: "In an emergency, every second counts." }),
    ).toBeInTheDocument();
    const button = screen.getByRole("link", { name: "Open SwiftRescue" });
    expect(button).toHaveAttribute("href", "/emergency");
    expect(button.className).toMatch(/\bbg-emergency\b/);
    expect(button.className).toMatch(/\btext-white\b/);
    expect(button.className).toMatch(/min-h-(12|\[50px\])(\s|$)/);
  });

  it("shows the ambulance and the fire photos, with their size and alt text, loaded lazily", () => {
    render(<RescueBand />);

    for (const photo of [HOME_PHOTOS.ambulance, HOME_PHOTOS.fire]) {
      const image = screen.getByAltText(photo.alt);
      expect(image).toHaveAttribute("src", photo.src);
      expect(image).toHaveAttribute("width", String(photo.width));
      expect(image).toHaveAttribute("height", String(photo.height));
      expect(image).toHaveAttribute("loading", "lazy");
    }
  });

  it("gives no medical advice and no instructions: only the heading and the button", () => {
    const { container } = render(<RescueBand />);

    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });
});

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

describe("the about part", () => {
  it("has the exact heading and text, with the first city from the site settings", () => {
    render(<AboutSwiftHealth />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Starting in Enugu. Growing across Nigeria." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "SwiftHealth makes it easier to find care that's actually open. We're starting in Enugu, checking every listing ourselves, and adding new cities one at a time so every listing stays trustworthy.",
      ),
    ).toBeInTheDocument();
    expect(siteConfig.launchCity).toBe("Enugu");
  });
});

describe("the whole page", () => {
  it("has the nine parts in the owner's order", () => {
    renderWholePage();

    const landmarks = [
      screen.getByRole("banner"),
      screen.getByRole("heading", { level: 1 }),
      ...["How it works", "Browse by type", "Why SwiftHealth"].map((name) =>
        screen.getByRole("heading", { level: 2, name }),
      ),
      screen.getByRole("heading", { level: 2, name: "In an emergency, every second counts." }),
      screen.getByRole("heading", { level: 2, name: "Run a hospital, clinic or pharmacy?" }),
      screen.getByRole("heading", { level: 2, name: "Starting in Enugu. Growing across Nigeria." }),
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

  it("has one h1 and only h2 and h3 headings after it", () => {
    renderWholePage();

    const levels = screen.getAllByRole("heading").map((heading) => Number(heading.tagName.slice(1)));

    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(Math.max(...levels)).toBeLessThanOrEqual(3);
  });

  it("makes no request and reads no API: the page is not async and does not call getHealth or fetch", () => {
    const source = readSource("app/page.tsx");

    expect(source).not.toMatch(/getHealth|fetch\(|\basync\b|\bawait\b/);
    expect(source).not.toMatch(/lib\/api/);
  });

  it("never says Enugu is the only place, in the page, the header, the footer or the page description", () => {
    const { container } = renderWholePage();
    const description = String(metadata.description);

    for (const text of [container.textContent ?? "", description]) {
      expect(text.toLowerCase()).not.toMatch(/enugu only|only in enugu|only enugu|just enugu/);
    }
    expect(description).toContain(siteConfig.launchCity);
    expect(description).toMatch(/more cities/);
  });

  it("names the first city only through siteConfig: no component writes Enugu itself", () => {
    for (const file of [
      "app/page.tsx",
      "components/home/HomeHero.tsx",
      "components/home/RescueBand.tsx",
      "components/home/FacilityOwners.tsx",
      "components/home/AboutSwiftHealth.tsx",
      "components/layout/SiteHeader.tsx",
      "components/layout/SiteFooter.tsx",
      "app/layout.tsx",
    ]) {
      expect(readSource(file), file).not.toMatch(/Enugu/);
    }
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

  it("has an alt text, a width and a height on every image", () => {
    const { container } = renderWholePage();

    const images = [...container.querySelectorAll("img")];

    expect(images).toHaveLength(10); // the hero, the second hero photo, 5 cards, 2 band photos, the owner photo
    for (const image of images) {
      expect(image.getAttribute("alt")?.length, image.getAttribute("src") ?? "").toBeGreaterThan(10);
      expect(Number(image.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(image.getAttribute("height"))).toBeGreaterThan(0);
    }
  });

  it("loads only the hero at once: every other image is lazy", () => {
    const { container } = renderWholePage();

    const eager = [...container.querySelectorAll("img")].filter((image) => image.getAttribute("loading") !== "lazy");

    expect(eager.map((image) => image.getAttribute("src"))).toEqual([HOME_PHOTOS.hero.src]);
  });

  it("uses the red emergency colour on exactly three buttons: the header's, the hero's and the band's", () => {
    const { container } = renderWholePage();

    const red = [...container.querySelectorAll("a, button, div, section, span")].filter((element) =>
      /\b(bg|text|border)-emergency\b/.test(element.className),
    );

    expect(red.map((element) => element.textContent)).toEqual(["SwiftRescue", "Emergency help", "Open SwiftRescue"]);
  });

  it("points every button of the page to the right place", () => {
    renderWholePage();

    const main = screen.getByRole("main");
    const targets = (name: string) => within(main).getByRole("link", { name }).getAttribute("href");

    expect(targets("Find care near me")).toBe("/find");
    expect(targets("Emergency help")).toBe("/emergency");
    expect(targets("Open SwiftRescue")).toBe("/emergency");
    expect(targets("List your facility")).toBe("/list-your-facility");
  });
});
