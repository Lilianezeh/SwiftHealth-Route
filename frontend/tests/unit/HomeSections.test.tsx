// @vitest-environment jsdom
/** The four middle parts of the home page: hero, how it works, browse by type, why SwiftHealth.
 * Requirements: US-13, NFR-01, NFR-10, NFR-07, FR-02. UI spec 2.1 (the exact words are the owner's, 2026-10-11; the hero and the
 * browse tiles were simplified on 2026-10-12, revision R1 to R6 in specs/2026-10-11-home-redesign/requirements.md).
 * The whole page (all seven parts, in order) is tested in HomePage.test.tsx.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrowseByType } from "@/components/home/BrowseByType";
import { HomeHero } from "@/components/home/HomeHero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { WhySwiftHealth } from "@/components/home/WhySwiftHealth";
import { HOME_PHOTOS } from "@/config/home";

import { contrast, tokenColour } from "../helpers/contrast";
import { readSource } from "../helpers/source";

describe("the hero", () => {
  it("has one h1 with the exact heading", () => {
    render(<HomeHero />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/^Find open care near you, fast\.$/);
  });

  it("has the exact line, which names no city", () => {
    render(<HomeHero />);

    expect(screen.getByText("Hospitals, pharmacies and emergency help, open near you.")).toBeInTheDocument();
  });

  it("has the exact small line, at 16 px or more", () => {
    render(<HomeHero />);

    const note = screen.getByText("Free to use · No sign-up needed");
    expect(note.className).not.toMatch(/\btext-(xs|sm)\b/);
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

  it("has a lighter blue background (pine-100) and no photo behind the text", () => {
    const { container } = render(<HomeHero />);

    const section = container.querySelector("section");
    expect(section?.className).toMatch(/\bbg-pine-100\b/);
    expect(container.querySelector('[class*="bg-pine-dark/"]')).toBeNull(); // the dark overlay is gone
  });

  it("writes the text in dark blue, which is at least 4.5:1 on the lighter blue", () => {
    render(<HomeHero />);
    const lightBlue = tokenColour("pine-100");

    const heading = screen.getByRole("heading", { level: 1 });
    const line = screen.getByText("Hospitals, pharmacies and emergency help, open near you.");
    const note = screen.getByText("Free to use · No sign-up needed");
    expect(heading.className).toMatch(/\btext-pine-dark\b/);
    expect(line.className).toMatch(/\btext-pine-dark\b/);
    expect(note.className).toMatch(/\btext-ink-soft\b/);
    expect(contrast(tokenColour("pine-dark"), lightBlue)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenColour("ink-soft"), lightBlue)).toBeGreaterThanOrEqual(4.5);
  });

  it("does not write white text on the lighter blue, which would be unreadable there (1.2:1)", () => {
    render(<HomeHero />);

    expect(contrast("#ffffff", tokenColour("pine-100"))).toBeLessThan(3);
    for (const element of [
      screen.getByRole("heading", { level: 1 }),
      screen.getByText("Hospitals, pharmacies and emergency help, open near you."),
      screen.getByText("Free to use · No sign-up needed"),
    ]) {
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
    expect(sources[0]).toHaveAttribute("srcset", `${HOME_PHOTOS.heroPhone.src} 640w`);
    expect(sources[0]).toHaveAttribute("sizes", "100vw");
    const image = picture?.querySelector("img");
    expect(image).toHaveAttribute("src", HOME_PHOTOS.hero.src);
    expect(image).toHaveAttribute("width", "1280");
    expect(image).toHaveAttribute("height", "853");
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

  it("has one photo only: no second photo, no hero2 anywhere", () => {
    const { container } = render(<HomeHero />);

    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.innerHTML).not.toContain("hero2");
    expect(readSource("components/home/HomeHero.tsx")).not.toContain("hero2");
  });

  it("lets the photo overlap the bottom edge of the hero into the next section", () => {
    const { container } = render(<HomeHero />);

    const section = container.querySelector("section");
    const photoBox = container.querySelector("picture")?.parentElement;
    // The hero is positioned (so the photo can sit above the next section) and does not cut anything off.
    expect(section?.className).toMatch(/\brelative\b/);
    expect(section?.className).not.toMatch(/\boverflow-hidden\b|\bisolate\b/);
    // The photo is above the next section. On a phone it is the last thing of the hero and a negative bottom margin pulls the
    // hero's edge up over it. From tablet width it sits at the bottom of its column and is moved down by a third of its own
    // height: a negative margin would do nothing there when the text column is the taller one.
    expect(photoBox?.className).toMatch(/\brelative\b/);
    expect(photoBox?.className).toMatch(/\bz-10\b/);
    expect(photoBox?.className).toMatch(/(^|\s)-mb-\d+\b/);
    expect(photoBox?.className).toMatch(/\bmd:mb-0\b/);
    expect(photoBox?.className).toMatch(/\bmd:self-end\b/);
    expect(photoBox?.className).toMatch(/\bmd:translate-y-1\/3\b/);
  });

  it("puts the photo after the text (below it on a phone) and in the right column from 768 px", () => {
    const { container } = render(<HomeHero />);

    const heading = screen.getByRole("heading", { level: 1 });
    const picture = container.querySelector("picture") as Element;
    expect(heading.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('[class*="md:grid-cols-2"]')).not.toBeNull();
  });

  it("makes the photo large and rounded", () => {
    const { container } = render(<HomeHero />);

    const image = container.querySelector("picture img");
    expect(image?.className).toMatch(/\bw-full\b/);
    expect(image?.className).toMatch(/\brounded-2xl\b/);
  });

  it("says nothing about a city: no Enugu, no cities coming", () => {
    const { container } = render(<HomeHero />);

    expect(container.textContent?.toLowerCase()).not.toMatch(/enugu|more cities|now live/);
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

  it("leaves room at its top for the hero photo that overlaps into it, more on a tablet and a desktop", () => {
    const { container } = render(<HowItWorks />);

    const room = container.querySelector("section > div");
    expect(room?.className).toMatch(/\bpt-20\b/);
    expect(room?.className).toMatch(/\bmd:pt-40\b/);
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

describe("why SwiftHealth", () => {
  it("has an h2 and four items with the exact titles", () => {
    render(<WhySwiftHealth />);

    expect(screen.getByRole("heading", { level: 2, name: "Why SwiftHealth" })).toBeInTheDocument();
    const titles = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(titles).toEqual([
      "Verified listings",
      "Open now means open now",
      "Works on slow data",
      "Your location stays private",
    ]);
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

describe("the four parts together", () => {
  it("use no red at all: the page's only red is the header's SwiftRescue button", () => {
    for (const file of ["HomeHero", "HowItWorks", "BrowseByType", "WhySwiftHealth"]) {
      expect(readSource(`components/home/${file}.tsx`), file).not.toMatch(
        /bg-emergency|text-emergency|border-emergency|buttonClasses\("emergency"\)/,
      );
    }
  });
});
