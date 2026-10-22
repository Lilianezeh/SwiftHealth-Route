// @vitest-environment jsdom
/** The middle parts of the home page: hero, Overview, "Why SwiftHealth Route", find by type.
 * Requirements: US-13, NFR-01, NFR-10, NFR-07, FR-02. UI spec 2.1 (the exact words are the owner's: 2026-10-11, changed on 2026-10-12, revisions
 * R4 to R6 and R11 to R24 in specs/2026-10-11-home-redesign/requirements.md, and again on 2026-10-15: D1 and D7 of
 * specs/2026-10-15-find-by-type/requirements.md). The whole page (all seven parts, in order) is tested in HomePage.test.tsx.
 */
import { render, screen, within } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FindByType } from "@/components/home/FindByType";
import { HomeHero } from "@/components/home/HomeHero";
import { Overview } from "@/components/home/Overview";
import { WhySwiftHealth } from "@/components/home/WhySwiftHealth";
import { brand } from "@/config/brand";
import { HOME_PHOTOS, HOME_WORDS } from "@/config/home";

import { contrast, tokenColour } from "../helpers/contrast";
import { readSource } from "../helpers/source";

const HERO_LINE = "Verified hospitals, clinics, pharmacies and labs, with phone numbers, opening hours and directions.";
const HERO_NOTE = "Free to use · No sign-up needed";

describe("the hero", () => {
  it("has one h1 with the exact heading", () => {
    render(<HomeHero />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/^Find care that's open now, near you\.$/);
    expect(document.body.textContent).not.toContain("Find open care near you, fast.");
  });

  it("has the exact line, which names no city, and the exact small line at 16 px or more", () => {
    render(<HomeHero />);

    expect(screen.getByText(HERO_LINE)).toBeInTheDocument();
    expect(screen.getByText(HERO_NOTE).className).not.toMatch(/\btext-(xs|sm)\b/);
  });

  it("keeps the Find care near me link at 48 px or more", () => {
    render(<HomeHero />);

    expect(screen.getByRole("link", { name: "Find care near me" }).className).toMatch(/min-h-12(\s|$)/);
  });

  it("has a sky blue gradient, lighter at the top right (sky) and deeper at the bottom left (pine-dark), not a flat colour", () => {
    const { container } = render(<HomeHero />);

    const section = container.querySelector("section");
    expect(section?.className).toMatch(/\bbg-linear-to-tr\b|\bbg-gradient-to-tr\b/);
    expect(section?.className).toMatch(/\bfrom-pine-dark\b/); // bottom left, where the text is
    expect(section?.className).toMatch(/\bto-sky\b/); // top right
    expect(section?.className).not.toMatch(/\bbg-(sky|pine-100|pine|white)\b/);
  });

  it("is tall only in the side-by-side layout: at least 85% of the screen height from 1024 px, no forced height below (R30)", () => {
    const { container } = render(<HomeHero />);

    const classes = container.querySelector("section")?.className ?? "";
    expect(classes).toMatch(/\blg:min-h-\[85svh\]/);
    expect(classes).not.toMatch(/(^|\s)min-h-/); // no minimum height without a breakpoint ...
    expect(classes).not.toMatch(/\bmd:min-h-/); // ... and none on a tablet: it left a large empty blue gap
  });

  it("writes all its text in white, large, which is at least 4.5:1 on both ends of the gradient", () => {
    render(<HomeHero />);

    const heading = screen.getByRole("heading", { level: 1 });
    for (const element of [heading, screen.getByText(HERO_LINE), screen.getByText(HERO_NOTE)]) {
      expect(element.className, element.textContent ?? "").toMatch(/\btext-white\b/);
      expect(element.className).not.toMatch(/\btext-(xs|sm|base)\b/);
    }
    expect(heading.className).toMatch(/\btext-4xl\b/); // large on a phone (36 px) ...
    expect(heading.className).toMatch(/\bmd:text-5xl\b/); // ... 48 px from 768 px ...
    expect(heading.className).toMatch(/\blg:text-6xl\b/); // ... 60 px from 1024 px (R29)
    expect(heading.className).toMatch(/\btext-balance\b/); // no single word left alone on the last line of a tablet
    expect(contrast("#ffffff", tokenColour("sky"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", tokenColour("pine-dark"))).toBeGreaterThanOrEqual(4.5);
  });

  it("has the light focus ring on its dark background (on-dark), because the forest ring is under 3:1 on sky", () => {
    const { container } = render(<HomeHero />);

    expect(container.querySelector("section")?.className).toMatch(/\bon-dark\b/);
  });

  it("puts the text in the lower left from 1024 px: at the bottom of the hero, in the left half", () => {
    const { container } = render(<HomeHero />);

    const textColumn = screen.getByRole("heading", { level: 1 }).parentElement as HTMLElement;
    const textRow = textColumn.parentElement as HTMLElement;
    expect(textRow.className).toMatch(/\bflex-1\b/);
    expect(textRow.className).toMatch(/\blg:flex\b/);
    expect(textRow.className).toMatch(/\blg:items-end\b/); // at the bottom
    expect(textColumn.className).toMatch(/\blg:w-1\/2\b/); // the left half from 1024 px
    expect(textColumn.className).not.toMatch(/\bmd:w-1\/2\b/);
    expect(container.querySelector('[class*="max-w-6xl"]')).toContainElement(textColumn);
  });

  it("gives the text column the full width below 1024 px and lets the heading break, so nothing is cut off at 320 to 1023 px (R31)", () => {
    render(<HomeHero />);

    const heading = screen.getByRole("heading", { level: 1 });
    const textColumn = heading.parentElement as HTMLElement;
    const textRow = textColumn.parentElement as HTMLElement;
    // Below 1024 px the row is a plain block and the column is as wide as the row, so the width of the single-line text cannot
    // size the column (a flex item sized by its content is what could push the heading past the edge of the screen).
    expect(textRow.className).not.toMatch(/(^|\s)(flex|inline-flex|grid)(\s|$)/);
    expect(textColumn.className).toMatch(/(^|\s)w-full\b/);
    expect(textColumn.className).toMatch(/\bmin-w-0\b/);
    expect(heading.className).toMatch(/\bbreak-words\b/);
    expect(heading.className).not.toMatch(/\bwhitespace-nowrap\b|\btruncate\b|\boverflow-hidden\b/);
  });

  // The photos, the veil, the overlay, the slider and the credit are tested in HeroSlider.test.tsx, heroPhotos.test.ts and HomeHero.test.tsx.

  it("does not overlap the next part: no negative margin, no z-index above the header", () => {
    const { container } = render(<HomeHero />);

    const section = container.querySelector("section");
    expect(section?.className).toMatch(/\brelative\b/);
    expect(section?.className).not.toMatch(/-mb-|\bz-/);
  });

  it("says nothing about a city: no Enugu, no cities coming", () => {
    const { container } = render(<HomeHero />);

    expect(container.textContent?.toLowerCase()).not.toMatch(/enugu|more cities|now live/);
  });
});

describe("the Overview", () => {
  it("has an h2 and the owner's exact text", () => {
    render(<Overview />);

    expect(screen.getByRole("heading", { level: 2, name: "What is SwiftHealth Route?" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "SwiftHealth Route is a healthcare directory built for Nigeria. Find hospitals, clinics, maternity homes, pharmacies and laboratories near you, see which are open right now, and call or get directions in one tap. Our team checks every listing before it goes live and re-checks it regularly.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps 'call or get directions in one tap' (no WhatsApp wording until real listings have WhatsApp numbers) and the report sentence stays out", () => {
    render(<Overview />);

    expect(document.body.textContent).toContain("call or get directions in one tap");
    expect(document.body.textContent?.toLowerCase()).not.toContain("whatsapp");
    expect(document.body.textContent).not.toContain("tell us so we can fix it");
  });

  it("has the normal space, not extra room at its top: the hero photo no longer overlaps into it (R22)", () => {
    const { container } = render(<Overview />);

    const room = container.querySelector("section > div");
    expect(room?.className).toMatch(/\bpy-12\b/);
    expect(room?.className).not.toMatch(/\bpt-20\b|\bmd:pt-(32|40)\b/);
  });

  it("is plain text: no red, no link, no image, a text size of 16 px or more", () => {
    const { container } = render(<Overview />);

    expect(container.querySelectorAll("a, img, svg")).toHaveLength(0);
    // The owner's text says "emergency contacts" in words; what must not be there is the red colour.
    expect(container.querySelectorAll('[class*="emergency"]')).toHaveLength(0);
    expect(container.querySelector("p")?.className).not.toMatch(/\btext-(xs|sm)\b/);
  });
});

describe("how it works (removed on 2026-10-12, R22)", () => {
  it("is gone: no component, no words in the config, nothing in the sources of the page", () => {
    expect(existsSync(join(process.cwd(), "src", "components", "home", "HowItWorks.tsx"))).toBe(false);
    for (const file of ["config/home.ts", "app/(home)/page.tsx", "components/home/Overview.tsx"]) {
      expect(readSource(file), file).not.toMatch(/HowItWorks|howItWorks|How it works|Search or share your location/);
    }
  });
});

describe("find by type", () => {
  const TILES = [
    ["Hospital", "hospital"],
    ["Clinic", "clinic"],
    ["Maternity", "maternity"],
    ["Pharmacy", "pharmacy"],
    ["Laboratory", "laboratory"],
  ] as const;

  it("has an h2 and five tiles in the owner's order, each one link to the search for its category", () => {
    render(<FindByType />);

    expect(screen.getByRole("heading", { level: 2, name: "Find by type" })).toBeInTheDocument();
    expect(screen.queryByText("Browse by type")).not.toBeInTheDocument();
    expect(readSource("config/home.ts")).not.toContain("Browse by type");
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(
      TILES.map(([label, slug]) => [label, `/search?category=${slug}`]),
    );
  });

  it("gives each tile a decorative icon over its label, and no photo", () => {
    const { container } = render(<FindByType />);

    expect(container.querySelectorAll("img")).toHaveLength(0);
    for (const [label] of TILES) {
      const tile = screen.getByRole("link", { name: label });
      expect(tile.querySelector("svg"), label).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("keeps each tile at 48 px or more, with the label at 16 px or more, and uses no red", () => {
    const { container } = render(<FindByType />);

    for (const [label] of TILES) {
      expect(screen.getByRole("link", { name: label }).className, label).toMatch(/min-h-(12|14|16|20|24)\b/);
      expect(screen.getByText(label).className).not.toMatch(/\btext-(xs|sm)\b/);
    }
    expect(container.innerHTML).not.toMatch(/emergency/);
  });
});

describe("Why SwiftHealth Route (was Benefits)", () => {
  it("has the h2 'Why SwiftHealth Route' and four items with the exact titles and texts", () => {
    render(<WhySwiftHealth />);

    expect(screen.getByRole("heading", { level: 2, name: "Why SwiftHealth Route" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Benefits" })).not.toBeInTheDocument();
    const titles = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(titles).toEqual([
      "Verified information",
      "See what's open now",
      "Built for mobile data",
      "Your location stays private",
    ]);
    for (const text of [
      "Our team checks each listing before it goes live and re-checks it regularly.",
      "Find places open right now, including late-night and 24-hour services.",
      "Light pages built for a weak connection.",
      "Your location is used only to show places near you. We don't store it.",
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("takes the app's name from the brand file, so the heading follows a rename", () => {
    expect(HOME_WORDS.why.heading).toBe(`Why ${brand.name}`);
    expect(readSource("config/home.ts")).not.toContain("Why SwiftHealth Route");
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

  it("is a full-width band in the header blue (forest) with the light focus ring", () => {
    const { container } = render(<WhySwiftHealth />);

    const section = container.querySelector("section");
    expect(section?.className).toMatch(/\bbg-forest\b/); // the section itself is full width: no max-w on it
    expect(section?.className).toMatch(/\bon-dark\b/);
    expect(section?.className).not.toMatch(/\bmax-w-/);
    expect(container.querySelector("section > div")?.className).toMatch(/\bmax-w-6xl\b/); // the content keeps the page width
  });

  it("writes everything in white and draws every icon in white, which is at least 4.5:1 on forest and on pine-dark", () => {
    const { container } = render(<WhySwiftHealth />);

    const texts = [
      screen.getByRole("heading", { level: 2 }),
      ...screen.getAllByRole("heading", { level: 3 }),
      ...container.querySelectorAll("li p"),
    ];
    for (const text of texts) expect(text.className, text.textContent ?? "").toMatch(/\btext-white\b/);
    for (const icon of container.querySelectorAll("li svg")) {
      expect(icon.parentElement?.className).toMatch(/\btext-white\b/);
      expect(icon.parentElement?.className).toMatch(/\bbg-pine-dark\b/); // the circle behind the icon
    }
    expect(container.querySelectorAll("li")).toHaveLength(4);
    expect(contrast("#ffffff", tokenColour("forest"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", tokenColour("pine-dark"))).toBeGreaterThanOrEqual(4.5);
    expect(container.innerHTML).not.toMatch(/text-forest|text-ink|bg-white\b/); // no dark text left on the blue
  });

  it("says the places are open right now, including late-night and 24-hour services", () => {
    render(<WhySwiftHealth />);

    expect(screen.getByText(/open right now, including late-night and 24-hour services/)).toBeInTheDocument();
  });
});

describe("the parts together", () => {
  it("use no red at all: the page's only red is the header's SwiftRescue button", () => {
    for (const file of ["HomeHero", "Overview", "FindByType", "WhySwiftHealth"]) {
      expect(readSource(`components/home/${file}.tsx`), file).not.toMatch(
        /bg-emergency|text-emergency|border-emergency|buttonClasses\("emergency"\)/,
      );
    }
  });
});
