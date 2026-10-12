// @vitest-environment jsdom
/** The middle parts of the home page: hero, Overview, how it works, browse by type, Benefits.
 * Requirements: US-13, NFR-01, NFR-10, NFR-07, FR-02. UI spec 2.1 (the exact words are the owner's, 2026-10-11; the hero, the
 * Overview and the name "Benefits" were changed on 2026-10-12, revisions R4 to R6 and R11 to R15 in
 * specs/2026-10-11-home-redesign/requirements.md). The whole page (all eight parts, in order) is tested in HomePage.test.tsx.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrowseByType } from "@/components/home/BrowseByType";
import { HomeHero } from "@/components/home/HomeHero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Overview } from "@/components/home/Overview";
import { WhySwiftHealth } from "@/components/home/WhySwiftHealth";
import { HOME_PHOTOS } from "@/config/home";

import { contrast, tokenColour } from "../helpers/contrast";
import { readSource } from "../helpers/source";

const HERO_LINE = "Hospitals, pharmacies and emergency help, open near you.";
const HERO_NOTE = "Free to use · No sign-up needed";

describe("the hero", () => {
  it("has one h1 with the exact heading", () => {
    render(<HomeHero />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/^Find open care near you, fast\.$/);
  });

  it("has the exact line, which names no city, and the exact small line at 16 px or more", () => {
    render(<HomeHero />);

    expect(screen.getByText(HERO_LINE)).toBeInTheDocument();
    expect(screen.getByText(HERO_NOTE).className).not.toMatch(/\btext-(xs|sm)\b/);
  });

  it("has one button, Find care near me to /find, in the primary blue: no Emergency help, nothing red", () => {
    const { container } = render(<HomeHero />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Find care near me");
    expect(links[0]).toHaveAttribute("href", "/find");
    expect(links[0].className).toMatch(/\bbg-pine\b/);
    expect(links[0].className).toMatch(/\btext-white\b/);
    expect(screen.queryByRole("link", { name: "Emergency help" })).not.toBeInTheDocument();
    // The hero line says "emergency help" in words (the owner's text); what must not be there is the red colour.
    expect(container.querySelectorAll('[class*="emergency"]')).toHaveLength(0);
    expect(readSource("components/home/HomeHero.tsx")).not.toMatch(/bg-emergency|text-emergency|buttonClasses\("emergency"\)/);
  });

  it("keeps the button at 48 px or more", () => {
    render(<HomeHero />);

    expect(screen.getByRole("link", { name: "Find care near me" }).className).toMatch(/min-h-(12|\[50px\])(\s|$)/);
  });

  it("has the light sky blue background (the sky token), not pine-100, and no photo behind the text", () => {
    const { container } = render(<HomeHero />);

    const section = container.querySelector("section");
    expect(section?.className).toMatch(/\bbg-sky\b/);
    expect(section?.className).not.toMatch(/\bbg-pine-100\b/);
    expect(container.querySelector('[class*="bg-pine-dark/"]')).toBeNull();
  });

  it("writes all its text in dark blue (pine-dark), which is at least 4.5:1 on the sky blue", () => {
    render(<HomeHero />);

    for (const element of [screen.getByRole("heading", { level: 1 }), screen.getByText(HERO_LINE), screen.getByText(HERO_NOTE)]) {
      expect(element.className, element.textContent ?? "").toMatch(/\btext-pine-dark\b/);
    }
    expect(contrast(tokenColour("pine-dark"), tokenColour("sky"))).toBeGreaterThanOrEqual(4.5);
  });

  it("does not write white text on the sky blue, where it would be 1.5:1", () => {
    render(<HomeHero />);

    expect(contrast("#ffffff", tokenColour("sky"))).toBeLessThan(3);
    for (const element of [screen.getByRole("heading", { level: 1 }), screen.getByText(HERO_LINE), screen.getByText(HERO_NOTE)]) {
      expect(element.className).not.toMatch(/\btext-white\b/);
    }
  });

  it("is one picture: phones up to 767 px take the small hero (640w, sizes 100vw), everyone else the big one", () => {
    const { container } = render(<HomeHero />);

    const picture = container.querySelector("picture");
    expect(picture).not.toBeNull();
    const sources = picture?.querySelectorAll("source") ?? [];
    expect(sources).toHaveLength(1);
    expect(sources[0]).toHaveAttribute("media", "(max-width: 767px)");
    expect(sources[0]).toHaveAttribute("srcset", "/images/home/hero3-phone.webp 640w");
    expect(sources[0]).toHaveAttribute("sizes", "100vw");
    const image = picture?.querySelector("img");
    expect(image).toHaveAttribute("src", "/images/home/hero3.webp");
    expect(image).toHaveAttribute("width", "1200");
    expect(image).toHaveAttribute("height", "1200");
    expect(image).toHaveAttribute("alt", HOME_PHOTOS.hero.alt);
  });

  it("loads the hero at once and with high priority, with no srcset of its own that could pick another file", () => {
    const { container } = render(<HomeHero />);

    const image = container.querySelector("picture img");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(image).not.toHaveAttribute("srcset");
  });

  it("does not use the priority prop, which would also preload the big file on a phone", () => {
    expect(readSource("components/home/HomeHero.tsx")).not.toMatch(/(^|[^A-Za-z])priority\b/);
  });

  it("has one photo only", () => {
    const { container } = render(<HomeHero />);

    expect(container.querySelectorAll("img")).toHaveLength(1);
    const source = readSource("components/home/HomeHero.tsx");
    expect(source).not.toMatch(/hero2|hero4|owner2/);
  });

  it("covers the right half of the hero on a tablet and desktop: from the top, to the right edge, below the bottom edge", () => {
    const { container } = render(<HomeHero />);

    const section = container.querySelector("section") as HTMLElement;
    const photoBox = container.querySelector("picture")?.parentElement as HTMLElement;
    // The box is a child of the section itself, not of the page-width container, so it can reach the edge of the screen.
    expect(photoBox.parentElement).toBe(section);
    expect(photoBox.className).toMatch(/\bmd:absolute\b/);
    expect(photoBox.className).toMatch(/\bmd:right-0\b/);
    expect(photoBox.className).toMatch(/\bmd:top-0\b/);
    expect(photoBox.className).toMatch(/\bmd:w-1\/2\b/);
    expect(photoBox.className).toMatch(/\bmd:-bottom-24\b/); // 6 rem below the hero's bottom edge
    expect(photoBox.className).toMatch(/\bz-10\b/); // above the next section
    const image = photoBox.querySelector("img");
    expect(image?.className).toMatch(/\bmd:h-full\b/);
    expect(image?.className).toMatch(/\bmd:object-cover\b/);
    expect(image?.className).toMatch(/\bmd:rounded-l-3xl\b/);
  });

  it("puts the photo below the text on a phone, the full width of the screen, pulled over by the hero's edge", () => {
    const { container } = render(<HomeHero />);

    const heading = screen.getByRole("heading", { level: 1 });
    const photoBox = container.querySelector("picture")?.parentElement as HTMLElement;
    expect(heading.compareDocumentPosition(photoBox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(photoBox.className).toMatch(/\brelative\b/);
    expect(photoBox.className).toMatch(/(^|\s)-mb-\d+\b/);
    const image = photoBox.querySelector("img");
    expect(image?.className).toMatch(/(^|\s)w-full\b/);
    expect(image?.className).toMatch(/(^|\s)h-auto\b/);
    expect(image?.className).not.toMatch(/(^|\s)(px|mx)-/); // no side margin
  });

  it("keeps the text on the left half from a tablet up, so the photo is never under it", () => {
    const { container } = render(<HomeHero />);

    const textColumn = screen.getByRole("heading", { level: 1 }).parentElement as HTMLElement;
    expect(textColumn.className).toMatch(/\bmd:w-1\/2\b/);
    expect(container.querySelector('[class*="max-w-6xl"]')).toContainElement(textColumn);
  });

  it("does not cut anything off or isolate the hero, so the photo can sit above the next section", () => {
    const { container } = render(<HomeHero />);

    const section = container.querySelector("section");
    expect(section?.className).toMatch(/\brelative\b/);
    expect(section?.className).not.toMatch(/\boverflow-hidden\b|\bisolate\b|\boverflow-x-/);
  });

  it("says nothing about a city: no Enugu, no cities coming", () => {
    const { container } = render(<HomeHero />);

    expect(container.textContent?.toLowerCase()).not.toMatch(/enugu|more cities|now live/);
  });
});

describe("the Overview", () => {
  it("has an h2 and the owner's exact text", () => {
    render(<Overview />);

    expect(screen.getByRole("heading", { level: 2, name: "Overview" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "SwiftHealth helps you find hospitals, clinics, pharmacies, labs and emergency contacts that are open right now. Every listing is checked by our team, so the number you call and the hours you see are ones you can trust.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves room at its top for the hero photo that overlaps into it, more on a tablet and a desktop", () => {
    const { container } = render(<Overview />);

    const room = container.querySelector("section > div");
    expect(room?.className).toMatch(/\bpt-20\b/);
    expect(room?.className).toMatch(/\bmd:pt-32\b/); // 8 rem: more than the 6 rem that the photo goes below the hero
  });

  it("is plain text: no red, no link, no image, a text size of 16 px or more", () => {
    const { container } = render(<Overview />);

    expect(container.querySelectorAll("a, img, svg")).toHaveLength(0);
    // The owner's text says "emergency contacts" in words; what must not be there is the red colour.
    expect(container.querySelectorAll('[class*="emergency"]')).toHaveLength(0);
    expect(container.querySelector("p")?.className).not.toMatch(/\btext-(xs|sm)\b/);
  });
});

describe("how it works", () => {
  it("has an h2 and three steps in order, with the exact words", () => {
    render(<HowItWorks />);

    expect(screen.getByRole("heading", { level: 2, name: "How it works" })).toBeInTheDocument();
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent?.replace(/^\d/, ""))).toEqual([
      "Search or share your location",
      "See who's open now",
      "Call, WhatsApp or get directions",
    ]);
  });

  it("numbers the steps and gives each a decorative icon", () => {
    render(<HowItWorks />);

    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent?.charAt(0))).toEqual(["1", "2", "3"]);
    for (const step of steps) expect(step.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("no longer holds the room for the hero photo: that moved to the Overview", () => {
    const { container } = render(<HowItWorks />);

    const room = container.querySelector("section > div");
    expect(room?.className).not.toMatch(/\bpt-20\b|\bmd:pt-(32|40)\b/);
    expect(room?.className).toMatch(/\bpy-12\b/);
  });
});

describe("browse by type", () => {
  const TILES = [
    ["Hospital", "hospital"],
    ["Clinic", "clinic"],
    ["Maternity", "maternity"],
    ["Pharmacy", "pharmacy"],
    ["Laboratory", "laboratory"],
  ] as const;

  it("has an h2 and five tiles in the owner's order, each one link to the search for its category", () => {
    render(<BrowseByType />);

    expect(screen.getByRole("heading", { level: 2, name: "Browse by type" })).toBeInTheDocument();
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(
      TILES.map(([label, slug]) => [label, `/search?category=${slug}`]),
    );
  });

  it("gives each tile a decorative icon over its label, and no photo", () => {
    const { container } = render(<BrowseByType />);

    expect(container.querySelectorAll("img")).toHaveLength(0);
    for (const [label] of TILES) {
      const tile = screen.getByRole("link", { name: label });
      expect(tile.querySelector("svg"), label).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("keeps each tile at 48 px or more, with the label at 16 px or more, and uses no red", () => {
    const { container } = render(<BrowseByType />);

    for (const [label] of TILES) {
      expect(screen.getByRole("link", { name: label }).className, label).toMatch(/min-h-(12|14|16|20|24)\b/);
      expect(screen.getByText(label).className).not.toMatch(/\btext-(xs|sm)\b/);
    }
    expect(container.innerHTML).not.toMatch(/emergency/);
  });
});

describe("Benefits (was Why SwiftHealth)", () => {
  it("has the h2 Benefits and four items with the exact titles", () => {
    render(<WhySwiftHealth />);

    expect(screen.getByRole("heading", { level: 2, name: "Benefits" })).toBeInTheDocument();
    const titles = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(titles).toEqual([
      "Verified listings",
      "Open now means open now",
      "Works on slow data",
      "Your location stays private",
    ]);
  });

  it("does not say Why SwiftHealth any more, in the page or in the source", () => {
    const { container } = render(<WhySwiftHealth />);

    expect(container.textContent).not.toContain("Why SwiftHealth");
    expect(readSource("config/home.ts")).not.toContain("Why SwiftHealth");
  });

  it("gives each item a decorative icon and a line of text", () => {
    render(<WhySwiftHealth />);

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(item.querySelector("p")?.textContent?.length).toBeGreaterThan(20);
    }
  });

  it("says hours follow local time, including late-night places", () => {
    render(<WhySwiftHealth />);

    expect(screen.getByText(/local time, including late-night places/)).toBeInTheDocument();
  });
});

describe("the parts together", () => {
  it("use no red at all: the page's only red is the header's SwiftRescue button", () => {
    for (const file of ["HomeHero", "Overview", "HowItWorks", "BrowseByType", "WhySwiftHealth"]) {
      expect(readSource(`components/home/${file}.tsx`), file).not.toMatch(
        /bg-emergency|text-emergency|border-emergency|buttonClasses\("emergency"\)/,
      );
    }
  });
});
