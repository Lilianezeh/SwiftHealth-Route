// @vitest-environment jsdom
/** The middle parts of the home page: hero, Overview, Benefits, browse by type.
 * Requirements: US-13, NFR-01, NFR-10, NFR-07, FR-02. UI spec 2.1 (the exact words are the owner's, 2026-10-11; the hero, the
 * Overview, Benefits and the removal of How it works were changed on 2026-10-12, revisions R4 to R6 and R11 to R24 in
 * specs/2026-10-11-home-redesign/requirements.md). The whole page (all seven parts, in order) is tested in HomePage.test.tsx.
 */
import { render, screen, within } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BrowseByType } from "@/components/home/BrowseByType";
import { HomeHero } from "@/components/home/HomeHero";
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

  it("has one button, Find care near me to /find, white with dark blue text (the on-dark button): no Emergency help, nothing red", () => {
    const { container } = render(<HomeHero />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Find care near me");
    expect(links[0]).toHaveAttribute("href", "/find");
    expect(links[0].className).toMatch(/\bbg-white\b/); // the pine button would vanish on the dark gradient
    expect(links[0].className).toMatch(/\btext-pine-dark\b/);
    expect(links[0].className).not.toMatch(/(^|\s)bg-pine(\s|$)/); // the plain pine background (hover tints are fine)
    expect(contrast(tokenColour("pine-dark"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(screen.queryByRole("link", { name: "Emergency help" })).not.toBeInTheDocument();
    // The hero line says "emergency help" in words (the owner's text); what must not be there is the red colour.
    expect(container.querySelectorAll('[class*="emergency"]')).toHaveLength(0);
    expect(readSource("components/home/HomeHero.tsx")).not.toMatch(/bg-emergency|text-emergency|buttonClasses\("emergency"\)/);
  });

  it("keeps the button at 48 px or more", () => {
    render(<HomeHero />);

    expect(screen.getByRole("link", { name: "Find care near me" }).className).toMatch(/min-h-(12|\[50px\])(\s|$)/);
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

  it("puts the text in the lower left: at the bottom of the hero, in the left half from 768 px", () => {
    const { container } = render(<HomeHero />);

    const textColumn = screen.getByRole("heading", { level: 1 }).parentElement as HTMLElement;
    const textRow = textColumn.parentElement as HTMLElement;
    expect(textRow.className).toMatch(/\bflex-1\b/);
    expect(textRow.className).toMatch(/\bitems-end\b/); // at the bottom
    expect(textColumn.className).toMatch(/\blg:w-1\/2\b/); // the left half from 1024 px; the full width below
    expect(textColumn.className).not.toMatch(/\bmd:w-1\/2\b/);
    expect(container.querySelector('[class*="max-w-6xl"]')).toContainElement(textColumn);
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

  function photoBoxOf(container: HTMLElement) {
    const photoBox = container.querySelector("picture")?.parentElement as HTMLElement;
    // The box is a child of the section itself, not of the page-width container, so it can reach the edge of the screen.
    expect(photoBox.parentElement).toBe(container.querySelector("section"));
    return photoBox;
  }

  it("fills the whole right half of the hero on a tablet and desktop: top to bottom, to the right edge, nothing below it", () => {
    const { container } = render(<HomeHero />);

    const photoBox = photoBoxOf(container);
    expect(photoBox.className).toMatch(/\blg:absolute\b/); // from 1024 px (R28), not 768 px
    expect(photoBox.className).toMatch(/\blg:inset-y-0\b/); // from the top to the bottom of the hero
    expect(photoBox.className).toMatch(/\blg:right-0\b/); // to the right edge of the screen
    expect(photoBox.className).toMatch(/\blg:w-1\/2\b/); // the whole right half
    expect(photoBox.className).not.toMatch(/\bmd:(absolute|inset-y-0|right-0|w-1\/2)\b/);
    expect(photoBox.className).not.toMatch(/-bottom-|-mb-|translate-y|\b(md|lg):-?bottom-[1-9]/); // no overlap below the hero (R20)
    const image = photoBox.querySelector("img");
    expect(image?.className).toMatch(/\bh-full\b/);
    expect(image?.className).toMatch(/\bw-full\b/);
    expect(image?.className).toMatch(/\bobject-cover\b/);
  });

  it("has a slanted left edge on a tablet and desktop (clip-path) and no rounded corners", () => {
    const { container } = render(<HomeHero />);

    const photoBox = photoBoxOf(container);
    expect(photoBox.className).toMatch(/lg:\[clip-path:polygon\(15%_0,100%_0,100%_100%,0_100%\)\]/);
    expect(photoBox.className).not.toMatch(/md:\[clip-path/); // a tablet keeps the band with the slanted bottom edge
    expect(photoBox.className).not.toMatch(/\brounded/);
    expect(photoBox.querySelector("img")?.className).not.toMatch(/\brounded/);
  });

  it("is a band at the top of the hero on a phone and a tablet (up to 1023 px), the full width, with a slanted bottom edge, above the text", () => {
    const { container } = render(<HomeHero />);

    const photoBox = photoBoxOf(container);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(photoBox.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // the text is below
    expect(photoBox.className).toMatch(/(^|\s)relative\b/);
    expect(photoBox.className).toMatch(/(^|\s)h-72\b/); // 18 rem on a phone: a band, not the whole screen
    expect(photoBox.className).toMatch(/\bmd:h-96\b/); // 24 rem from 768 px, so the band is not a thin strip on a tablet (R28)
    expect(photoBox.className).toMatch(/\blg:h-auto\b/); // from 1024 px the box follows the height of the hero
    expect(photoBox.className).toMatch(/(^|\s)\[clip-path:polygon\(0_0,100%_0,100%_85%,0_100%\)\]/); // the slanted bottom edge
    expect(photoBox.className).not.toMatch(/(^|\s)(px|mx)-/); // the full width: no side margin
    expect(photoBox.querySelector("img")?.className).not.toMatch(/(^|\s)(px|mx)-/);
  });

  it("has a short, soft dark veil over the top of the photo: 6 rem, 80%, solid for 3 rem, then a fade (R21, R27)", () => {
    const { container } = render(<HomeHero />);

    const veil = photoBoxOf(container).querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(veil).not.toBeNull();
    expect(veil.className).toMatch(/\babsolute\b/);
    expect(veil.className).toMatch(/\btop-0\b/);
    expect(veil.className).toMatch(/\bh-24\b/); // 6 rem (it was 8 rem)
    expect(veil.className).toMatch(/\bfrom-pine-dark\/80\b/);
    expect(veil.className).toMatch(/\bvia-pine-dark\/80\b/);
    expect(veil.className).toMatch(/\bvia-50%/); // solid to 3 rem, then 3 rem of fade
    expect(veil.className).toMatch(/\bto-transparent\b/);
    expect(veil.className).not.toMatch(/\b(from|via)-pine-dark\/85\b|\bh-32\b|\bvia-60%/); // the old, heavier veil
    expect(veil.className).toMatch(/\bpointer-events-none\b/);
    expect(veil.textContent).toBe(""); // decoration only
  });

  it("keeps the header's text inside the solid part of the veil (the first 3 rem), so the white links stay readable", () => {
    const { container } = render(<HomeHero />);

    const veilClasses = (photoBoxOf(container).querySelector('[aria-hidden="true"]') as HTMLElement).className;
    const heightRem = Number(/\bh-(\d+)\b/.exec(veilClasses)?.[1]) / 4; // Tailwind: h-24 = 6 rem
    const solidRem = (Number(/\bvia-(\d+)%/.exec(veilClasses)?.[1]) / 100) * heightRem;
    // The header: 0.5 rem of padding, then a 3 rem (48 px) link box with one 1.5 rem line of text, centred: it ends at 2.75 rem.
    const headerTextEndsRem = 0.5 + 3 / 2 + 1.5 / 2;

    expect(solidRem).toBeGreaterThanOrEqual(headerTextEndsRem);
    // The veil is darker than 4.5:1 for white over a pure white photo (pine-dark at 80%): 5.26:1.
    const [red, green, blue] = [1, 3, 5].map((start) => parseInt(tokenColour("pine-dark").slice(start, start + 2), 16));
    const overWhite = [red, green, blue].map((channel) => Math.round(0.8 * channel + 0.2 * 255));
    const blended = `#${overWhite.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
    expect(contrast("#ffffff", blended)).toBeGreaterThanOrEqual(4.5);
  });

  it("does not overlap the next part: no negative margin, no z-index above the header, nothing cut off by overflow", () => {
    const { container } = render(<HomeHero />);

    const section = container.querySelector("section");
    expect(section?.className).toMatch(/\brelative\b/);
    expect(section?.className).not.toMatch(/-mb-|\bz-/);
    expect(photoBoxOf(container).className).not.toMatch(/\bz-/); // the header (z-20) is above the photo
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
    for (const file of ["config/home.ts", "app/page.tsx", "components/home/Overview.tsx"]) {
      expect(readSource(file), file).not.toMatch(/HowItWorks|howItWorks|How it works|Search or share your location/);
    }
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

  it("says hours follow local time, including late-night places", () => {
    render(<WhySwiftHealth />);

    expect(screen.getByText(/local time, including late-night places/)).toBeInTheDocument();
  });
});

describe("the parts together", () => {
  it("use no red at all: the page's only red is the header's SwiftRescue button", () => {
    for (const file of ["HomeHero", "Overview", "BrowseByType", "WhySwiftHealth"]) {
      expect(readSource(`components/home/${file}.tsx`), file).not.toMatch(
        /bg-emergency|text-emergency|border-emergency|buttonClasses\("emergency"\)/,
      );
    }
  });
});
