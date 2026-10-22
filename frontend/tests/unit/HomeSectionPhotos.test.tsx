// @vitest-environment jsdom
/** The photos in the sections of the home page. Requirements: US-13, NFR-01, NFR-10, NFR-13. Spec: specs/2026-10-22-home-photos/requirements.md
 * parts 2 and 5 (the owner's answers of 2026-10-22: both new sections, maternity kept in the Find by type row, the Magnific credit directly
 * under hero2 only, no strip, one 800 px file per photo, hero4 deleted). The hero is not changed: no photo of the sections is in it.
 */
import { render, screen, within } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import Home from "@/app/(home)/page";
import { PageFrame } from "@/components/layout/PageFrame";
import { EMERGENCY_PHOTOS, MAGNIFIC_CREDIT, SECTION_PHOTOS } from "@/config/sectionPhotos";

import { readSource } from "../helpers/source";

function renderPage() {
  return render(
    <PageFrame isHomePage>
      <Home />
    </PageFrame>,
  );
}

function sectionOf(name: string): HTMLElement {
  return screen.getByRole("heading", { level: 2, name }).closest("section") as HTMLElement;
}

const SECTION_HEADINGS = [
  "What is SwiftHealth Route?",
  "Why SwiftHealth Route",
  "How we verify",
  "Find by type",
  "SwiftRescue",
  "Own or manage a healthcare facility?",
];

function sources(root: HTMLElement): string[] {
  return [...root.querySelectorAll("img")].map((image) => image.getAttribute("src") ?? "");
}

describe("the order of the parts", () => {
  it("is: hero, Overview, Why, How we verify, Find by type, SwiftRescue, For facility owners, footer", () => {
    renderPage();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(SECTION_HEADINGS);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("which photo is in which section", () => {
  it("puts hero in the Overview, hero2 and hero3 in How we verify, the four type photos in Find by type, ambulance and fire in SwiftRescue, owner in the owners part", () => {
    renderPage();

    expect(sources(sectionOf("What is SwiftHealth Route?"))).toEqual([SECTION_PHOTOS.overview.src]);
    expect(sources(sectionOf("Why SwiftHealth Route"))).toEqual([]);
    expect(sources(sectionOf("How we verify"))).toEqual([SECTION_PHOTOS.verifyPharmacists.src, SECTION_PHOTOS.verifyStethoscope.src]);
    expect(sources(sectionOf("Find by type"))).toEqual([
      SECTION_PHOTOS.clinic.src, SECTION_PHOTOS.pharmacy.src, SECTION_PHOTOS.laboratory.src, SECTION_PHOTOS.maternity.src,
    ]);
    expect(sources(sectionOf("SwiftRescue"))).toEqual([EMERGENCY_PHOTOS.ambulance.src, EMERGENCY_PHOTOS.fire.src]);
    expect(sources(sectionOf("Own or manage a healthcare facility?"))).toEqual([SECTION_PHOTOS.owners.src]);
  });

  it("has the hero as it is: its own photo only, no photo of the sections, no slider, no search box, no credit", () => {
    const { container } = renderPage();

    const hero = container.querySelector("main section") as HTMLElement;
    expect(hero.querySelector("h1")).not.toBeNull();
    expect(sources(hero)).toEqual(["/images/home/hero3.webp"]);
    expect(hero.querySelector("form, [role='search'], input")).toBeNull();
    expect(within(hero).queryAllByRole("button")).toHaveLength(0);
    expect(within(hero).getAllByRole("link")).toHaveLength(1); // Find care near me
    const source = readSource("components/home/HomeHero.tsx");
    expect(source).not.toMatch(/Reveal|SectionPhoto|sections\/|use client/);
  });

  it("has no photo before the first section: the hero is the only image above it, so nothing delays the first paint", () => {
    const { container } = renderPage();

    const images = [...container.querySelectorAll("main img")];
    const overviewImage = images.find((image) => image.getAttribute("src") === SECTION_PHOTOS.overview.src) as HTMLElement;
    const hero = container.querySelector("main section") as HTMLElement;
    expect(images.filter((image) => hero.contains(image))).toHaveLength(1);
    expect(hero.compareDocumentPosition(overviewImage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has ten photos below the hero and none of the four left out: pharmacy6, hero4, hospital, owner2", () => {
    const { container } = renderPage();

    const all = sources(container as HTMLElement);
    expect(all).toHaveLength(11); // the hero and ten
    expect(all.join(" ")).not.toMatch(/pharmacy6|hero4|hospital|owner2/);
    expect(existsSync(join(process.cwd(), "public", "images", "home", "hero4-portrait.webp"))).toBe(false);
  });
});

describe("every photo", () => {
  it("is lazy, async, with a fixed width, height and aspect ratio, and its honest alt text from the config", () => {
    const { container } = renderPage();

    const images = [...container.querySelectorAll("main img")].slice(1); // after the hero
    const photos = [...Object.values(SECTION_PHOTOS), ...Object.values(EMERGENCY_PHOTOS)];
    expect(images).toHaveLength(10);
    for (const image of images) {
      const photo = photos.find((entry) => entry.src === image.getAttribute("src"));
      expect(photo, image.getAttribute("src") ?? "").toBeDefined();
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("decoding", "async");
      expect(image).toHaveAttribute("width", String(photo?.width));
      expect(image).toHaveAttribute("height", String(photo?.height));
      expect(image).toHaveAttribute("alt", photo?.alt);
      expect(image.className).toMatch(/\baspect-\[(3\/2|8\/3)\]/); // the room is kept before the file arrives: CLS 0
      expect(image.className).toMatch(/\bw-full\b/);
      expect(image.getAttribute("fetchpriority")).not.toBe("high");
    }
  });

  it("is wrapped for the fade-and-slide, and is not a background image or a next/image component", () => {
    const { container } = renderPage();

    const images = [...container.querySelectorAll("main img")].slice(1);
    for (const image of images) expect(image.closest(".photo-reveal"), image.getAttribute("src") ?? "").not.toBeNull();
    expect(container.innerHTML).not.toMatch(/background-image/);
    for (const file of ["SectionPhoto", "Overview", "HowWeVerify", "FindByType", "HomeSwiftRescue", "FacilityOwners"]) {
      expect(readSource(`components/home/${file}.tsx`), file).not.toMatch(/from "next\/image"/);
    }
  });
});

describe("the credit", () => {
  const creditsIn = (section: HTMLElement) => within(section).queryAllByRole("link", { name: /^Designed by Magnific/ });

  it("is one 'Designed by Magnific' link in each section that shows Magnific photos: Overview, How we verify, Find by type, SwiftRescue, owners", () => {
    renderPage();

    for (const name of ["What is SwiftHealth Route?", "How we verify", "Find by type", "SwiftRescue", "Own or manage a healthcare facility?"]) {
      expect(creditsIn(sectionOf(name)), name).toHaveLength(1);
    }
    expect(creditsIn(sectionOf("Why SwiftHealth Route"))).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: /^Designed by Magnific/ })).toHaveLength(5);
  });

  it("is a safe link to www.magnific.com: new tab, rel noopener noreferrer, 16 px text, a 48 px tap area", () => {
    renderPage();

    for (const credit of screen.getAllByRole("link", { name: /^Designed by Magnific/ })) {
      expect(credit).toHaveAttribute("href", MAGNIFIC_CREDIT.href);
      expect(credit).toHaveAttribute("target", "_blank");
      expect(credit.getAttribute("rel")).toContain("noopener");
      expect(credit.getAttribute("rel")).toContain("noreferrer");
      expect(credit.className).toMatch(/\btext-base\b/);
      expect(credit.className).toMatch(/\bmin-h-12\b/);
    }
  });

  it("is directly under hero2 in How we verify and nowhere near hero3 (an Unsplash photo): nothing under hero3 (owner, 2026-10-22)", () => {
    renderPage();

    const section = sectionOf("How we verify");
    const [hero2, hero3] = [...section.querySelectorAll("img")];
    const credit = creditsIn(section)[0];
    const hero2Column = hero2.closest("[data-photo]") as HTMLElement;
    const hero3Column = hero3.closest("[data-photo]") as HTMLElement;

    expect(hero2Column).not.toBe(hero3Column);
    expect(hero2Column.contains(credit)).toBe(true);
    expect(hero3Column.contains(credit)).toBe(false);
    expect(hero2.compareDocumentPosition(credit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // under it
    expect(within(hero3Column).queryAllByRole("link")).toHaveLength(0);
    expect(section.textContent?.toLowerCase()).not.toContain("unsplash");
  });

  it("is under the photos, never over a photo or over text, and the hero and the facility photos of other parts have none", () => {
    const { container } = renderPage();

    for (const credit of screen.getAllByRole("link", { name: /^Designed by Magnific/ })) {
      expect(credit.className).not.toMatch(/\babsolute\b|\bfixed\b/);
      expect(credit.closest(".photo-reveal")).toBeNull(); // not inside the photo's wrapper
    }
    const hero = container.querySelector("main section") as HTMLElement;
    expect(creditsIn(hero)).toHaveLength(0);
  });
});

describe("the new sections", () => {
  it("How we verify has the two sentences from the information page and a link to it", () => {
    renderPage();

    const section = sectionOf("How we verify");
    expect(
      within(section).getByText(
        "Every listing starts as a draft. Our team checks it with a call and a visit before it goes live, and checks it again on a regular cycle.",
      ),
    ).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "How we verify" })).toHaveAttribute("href", "/how-we-verify");
  });

  it("SwiftRescue has the line 'with 112 first', and a blue button to /emergency that is never red", () => {
    renderPage();

    const section = sectionOf("SwiftRescue");
    expect(within(section).getByText("Emergency contacts for ambulance and fire, with 112 first. In danger, call 112.")).toBeInTheDocument();
    const button = within(section).getByRole("link", { name: "Open SwiftRescue" });
    expect(button).toHaveAttribute("href", "/emergency");
    expect(button.className).toMatch(/\bbg-pine\b/);
    expect(button.className).not.toMatch(/emergency/);
    expect(section.innerHTML).not.toMatch(/bg-emergency|text-emergency|border-emergency/);
    expect(button.className).toMatch(/min-h-\[50px\]/);
  });

  it("make no promise about help and say no number but 112", () => {
    renderPage();

    for (const name of ["How we verify", "SwiftRescue"]) {
      const text = sectionOf(name).textContent ?? "";
      expect(text).not.toMatch(/guarantee|within \d|minutes|\d+\s?%/i);
      expect(text.replace(/112/g, "")).not.toMatch(/\d/);
    }
  });

  it("have a heading, text and every link of the page go to a page that exists", () => {
    renderPage();

    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      if (!href.startsWith("/")) continue;
      expect(["/", "/find", "/blood", "/emergency", "/how-we-verify", "/list-your-facility", "/about", "/privacy", "/terms", "/contact"].concat(
        href.startsWith("/search?") ? [href] : [],
      ), href).toContain(href);
    }
  });
});

describe("the photos stay out of the red", () => {
  it("shows no red cross: no cross symbol in a section and no 'red cross' word", () => {
    const { container } = renderPage();

    expect(container.textContent).not.toMatch(/red cross|✚|✝/i);
    for (const photo of [...Object.values(SECTION_PHOTOS), ...Object.values(EMERGENCY_PHOTOS)]) {
      expect(photo.alt.toLowerCase()).not.toContain("cross");
    }
  });
});
