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

import { contrast, darkTokenColour, tokenColour } from "../helpers/contrast";
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

  it("has one button, Find care near me to /find, white with dark blue text (the on-dark button): no Emergency help, nothing red", () => {
    const { container } = render(<HomeHero />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Find care near me");
    expect(links[0]).toHaveAttribute("href", "/find");
    expect(links[0].className).toMatch(/\bbg-snow\b/); // white, also in the dark mode: the pine button would vanish on the dark gradient
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
    expect(section?.className).toMatch(/\bfrom-hero-from\b/); // bottom left, where the text is (pine-dark in the light mode, a deep navy in the dark)
    expect(section?.className).toMatch(/\bto-hero-to\b/); // top right (sky in the light mode)
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

  /** The band of the photos (`HeroSlideshow`): its size and place. Since 2026-10-28 the slanted edge is on the frame inside it (frameOf). */
  function photoBoxOf(container: HTMLElement) {
    const photoBox = container.querySelector("[data-hero-band]") as HTMLElement;
    // The box is a child of the section itself, not of the page-width container, so it can reach the edge of the screen.
    expect(photoBox.parentElement).toBe(container.querySelector("section"));
    return photoBox;
  }

  function frameOf(container: HTMLElement) {
    return photoBoxOf(container).querySelector("[data-hero-frame]") as HTMLElement;
  }

  /** The veil under the header: the one child of the frame that is not a slide. */
  function veilOf(container: HTMLElement) {
    return frameOf(container).querySelector(':scope > [aria-hidden="true"]:not([data-hero-slide])') as HTMLElement;
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

    const frame = frameOf(container);
    expect(frame.className).toMatch(/lg:\[clip-path:polygon\(15%_0,100%_0,100%_100%,0_100%\)\]/);
    expect(frame.className).not.toMatch(/md:\[clip-path/); // a tablet keeps the band with the slanted bottom edge
    expect(frame.className).not.toMatch(/\brounded/);
    expect(photoBoxOf(container).className).not.toMatch(/\brounded/);
    expect(frame.querySelector("img")?.className).not.toMatch(/\brounded/);
  });

  it("is a band at the top of the hero on a phone and a tablet (up to 1023 px), the full width, with a slanted bottom edge, above the text", () => {
    const { container } = render(<HomeHero />);

    const photoBox = photoBoxOf(container);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(photoBox.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // the text is below
    expect(photoBox.className).toMatch(/(^|\s)relative\b/);
    expect(photoBox.className).toMatch(/(^|\s)h-64\b/); // 16 rem on a phone: a band, not the whole screen (R33)
    expect(photoBox.className).toMatch(/\bmd:h-72\b/); // 18 rem from 768 px: the heading and the button stay on the first screen
    expect(photoBox.className).not.toMatch(/\bh-96\b|(^|\s)h-72\b/); // the old 18 rem phone band and 24 rem tablet band
    expect(photoBox.className).toMatch(/\blg:h-auto\b/); // from 1024 px the box follows the height of the hero
    expect(frameOf(container).className).toMatch(/(^|\s)\[clip-path:polygon\(0_0,100%_0,100%_85%,0_100%\)\]/); // the slanted bottom edge
    expect(photoBox.className).not.toMatch(/(^|\s)(px|mx)-/); // the full width: no side margin
    expect(photoBox.querySelector("img")?.className).not.toMatch(/(^|\s)(px|mx)-/);
  });

  it("has a short, soft dark veil over the top of the photo: 6 rem, 85%, solid for 4.5 rem, then a fade (R21, R27; measured again on 2026-10-28)", () => {
    const { container } = render(<HomeHero />);

    const veil = veilOf(container);
    expect(veil).not.toBeNull();
    // the veil is the only thing laid over the photos: the frame holds the slides (the photos) and the veil, nothing else (the controls are beside it)
    expect([...frameOf(container).children].filter((child) => !child.hasAttribute("data-hero-slide"))).toEqual([veil]);
    expect(photoBoxOf(container).querySelector("img")?.className).toBe("h-full w-full object-cover"); // the photo itself: no filter, in either mode
    expect(veil.className).toMatch(/\babsolute\b/);
    expect(veil.className).toMatch(/\btop-0\b/);
    expect(veil.className).toMatch(/\bh-24\b/); // 6 rem (it was 8 rem)
    expect(veil.className).toMatch(/\bfrom-veil\/85\b/); // the veil token: pine-dark in the light mode, a deep navy in the dark
    expect(veil.className).toMatch(/\bvia-veil\/85\b/);
    expect(veil.className).toMatch(/\bvia-75%/); // solid to 4.5 rem, then 1.5 rem of fade
    expect(veil.className).toMatch(/\bto-transparent\b/);
    expect(veil.className).not.toMatch(/\bh-32\b|\bvia-60%|pine-dark/); // the old, heavier veil, and the old colour token
    expect(veil.className).toMatch(/\bpointer-events-none\b/);
    expect(veil.textContent).toBe(""); // decoration only
  });

  it("keeps everything the header draws inside the solid part of the veil (the first 4.5 rem), so the white links stay readable", () => {
    const { container } = render(<HomeHero />);

    const veilClasses = veilOf(container).className;
    const heightRem = Number(/\bh-(\d+)\b/.exec(veilClasses)?.[1]) / 4; // Tailwind: h-24 = 6 rem
    const solidRem = (Number(/\bvia-(\d+)%/.exec(veilClasses)?.[1]) / 100) * heightRem;
    // The header: 0.5 rem of padding, then a 3 rem (48 px) link box: its items end at 3.5 rem. (A veil that was solid only to 3 rem left
    // the lower part of the items on a fading veil: 3.8:1 to 4.3:1 over a white sheet of the photo, measured on the real pixels.)
    const headerItemsEndRem = 0.5 + 3;

    expect(solidRem).toBeGreaterThanOrEqual(headerItemsEndRem);
    // White over a pure white photo under the veil at 85%, in the light mode and in the dark mode: at least 4.5:1.
    for (const token of [tokenColour("veil"), darkTokenColour("veil")]) {
      const [red, green, blue] = [1, 3, 5].map((start) => parseInt(token.slice(start, start + 2), 16));
      const overWhite = [red, green, blue].map((channel) => Math.round(0.85 * channel + 0.15 * 255));
      const blended = `#${overWhite.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
      expect(contrast("#ffffff", blended), token).toBeGreaterThanOrEqual(4.5);
    }
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
    // Each tile is named by its label (aria-labelledby); the line under it (16 px) is its description.
    expect(links.map((link) => [link.getAttribute("aria-labelledby") && document.getElementById(link.getAttribute("aria-labelledby") as string)?.textContent, link.getAttribute("href")])).toEqual(
      TILES.map(([label, slug]) => [label, `/search?category=${slug}`]),
    );
    expect(links.map((link) => link.textContent)).toEqual([
      "HospitalAdmission, surgery and emergency care",
      "ClinicCheck-ups and everyday treatment",
      "MaternityAntenatal care and childbirth",
      "PharmacyMedicines and advice",
      "LaboratoryTests and results",
    ]);
  });

  it("is a plain section again (owner, 2026-10-28): no photo, no slideshow behind it, no Pause button, no credit, a plain heading, on the light-blue band", () => {
    const { container } = render(<FindByType />);

    expect(container.querySelectorAll("img, picture, [data-backdrop], [data-backdrop-slide]")).toHaveLength(0);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.textContent).not.toMatch(/Magnific|Pause|Play/);
    const section = container.querySelector("section") as HTMLElement;
    expect(section.className).toMatch(/\bbg-pine-50\b/);
    expect(section.className).not.toMatch(/section-lazy|isolate|overflow-hidden|lg:min-h-\[760px\]/);
    const heading = screen.getByRole("heading", { level: 2, name: "Find by type" });
    expect(heading.className).toMatch(/\btext-forest\b/);
    expect(heading.className).not.toMatch(/\bbg-/); // no white backing: nothing is behind it any more
    const source = readSource("components/home/FindByType.tsx");
    expect(source).not.toMatch(/BackdropSlideshow|section-lazy|data-backdrop/);
  });

  it("gives each tile a decorative icon over its label, and no photo in a tile", () => {
    const { container } = render(<FindByType />);

    expect(container.querySelectorAll("img")).toHaveLength(0);
    for (const [label] of TILES) {
      const tile = screen.getByRole("link", { name: label });
      expect(tile.querySelector("svg"), label).toHaveAttribute("aria-hidden", "true");
      expect(tile.querySelector("img"), label).toBeNull();
    }
  });

  it("keeps each tile at 48 px or more, with the label at 16 px or more, and uses no red", () => {
    const { container } = render(<FindByType />);

    for (const [label] of TILES) {
      expect(screen.getByRole("link", { name: label }).className, label).toMatch(/\bh-\[190px\]/); // 190 px high, far over 48 px
      expect(screen.getByText(label).className).not.toMatch(/\btext-(xs|sm)\b/);
    }
    // No red: the word "emergency" is in the Hospital line ("Admission, surgery and emergency care"), so the colour classes are what is checked.
    expect(container.innerHTML).not.toMatch(/\b(bg|text|border|ring)-emergency\b/);
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
    expect(section?.className).toMatch(/\bbg-bar\b/); // the same blue as the header (the bar token: navy in the dark mode; forest is a text colour)
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
    expect(container.innerHTML).not.toMatch(/text-forest|text-ink|bg-white\b|bg-surface\b/); // no dark text and no card left on the blue
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
