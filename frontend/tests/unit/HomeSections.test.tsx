// @vitest-environment jsdom
/** The first four parts of the home page: hero, how it works, browse by type, why SwiftHealth.
 * Requirements: US-13, NFR-01, NFR-10, NFR-07, FR-02. UI spec 2.1 (the exact words are the owner's, 2026-10-11).
 * The whole page (all nine parts, in order) is tested in HomePage.test.tsx.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrowseByType } from "@/components/home/BrowseByType";
import { HomeHero } from "@/components/home/HomeHero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { WhySwiftHealth } from "@/components/home/WhySwiftHealth";
import { HOME_PHOTOS } from "@/config/home";

import { contrast, laidOver, tokenColour } from "../helpers/contrast";
import { readSource } from "../helpers/source";

describe("the hero", () => {
  it("has one h1 with the exact heading", () => {
    render(<HomeHero />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/^Find open care near you, fast\.$/);
  });

  it("has the exact line, with the first city taken from the site settings and more cities coming", () => {
    render(<HomeHero />);

    expect(
      screen.getByText(
        "Hospitals, pharmacies and emergency help, open near you. Now live in Enugu, with more cities coming.",
      ),
    ).toBeInTheDocument();
  });

  it("has the exact small line, at 16 px or more", () => {
    render(<HomeHero />);

    const note = screen.getByText("Free to use · No sign-up needed");
    expect(note.className).not.toMatch(/\btext-(xs|sm)\b/);
  });

  it("has a white Find care near me button to /find, and a red Emergency help button to /emergency", () => {
    render(<HomeHero />);

    const findCare = screen.getByRole("link", { name: "Find care near me" });
    expect(findCare).toHaveAttribute("href", "/find");
    expect(findCare.className).toMatch(/\bbg-white\b/);
    expect(findCare.className).toMatch(/\btext-forest\b/);
    const emergency = screen.getByRole("link", { name: "Emergency help" });
    expect(emergency).toHaveAttribute("href", "/emergency");
    expect(emergency.className).toMatch(/\bbg-emergency\b/);
    expect(emergency.className).toMatch(/\btext-white\b/);
  });

  it("keeps both buttons at 48 px or more", () => {
    render(<HomeHero />);

    for (const name of ["Find care near me", "Emergency help"]) {
      expect(screen.getByRole("link", { name }).className, name).toMatch(/min-h-(12|\[50px\])(\s|$)/);
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
    const source = readSource("components/home/HomeHero.tsx");

    expect(source).not.toMatch(/(^|[^A-Za-z])priority\b/);
  });

  it("has a second photo only from tablet width: lazy, inside a box that is hidden below 768 px, never in a source", () => {
    const { container } = render(<HomeHero />);

    const second = screen.getByAltText(HOME_PHOTOS.hero2.alt);
    expect(second).toHaveAttribute("src", HOME_PHOTOS.hero2.src);
    expect(second).toHaveAttribute("width", "960");
    expect(second).toHaveAttribute("height", "640");
    expect(second).toHaveAttribute("loading", "lazy");
    expect(second).not.toHaveAttribute("fetchpriority", "high");
    const box = second.closest("div");
    expect(box?.className).toMatch(/\bhidden\b/);
    expect(box?.className).toMatch(/\bmd:block\b/);
    expect(container.querySelector("picture")?.innerHTML).not.toContain("hero2");
  });

  it("covers the phone photo with a dark blue overlay of 80% or more that is gone from tablet width", () => {
    const { container } = render(<HomeHero />);

    const overlay = container.querySelector('[class*="bg-pine-dark/"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toMatch(/\bmd:hidden\b/);
    const opacity = Number(overlay?.className.match(/bg-pine-dark\/(\d+)/)?.[1]) / 100;
    expect(opacity).toBeGreaterThanOrEqual(0.8);
  });

  it("keeps white text at least 4.5:1 on the overlay even over a pure white photo", () => {
    const { container } = render(<HomeHero />);
    const overlay = container.querySelector('[class*="bg-pine-dark/"]');
    const opacity = Number(overlay?.className.match(/bg-pine-dark\/(\d+)/)?.[1]) / 100;

    const worstCase = laidOver(tokenColour("pine-dark"), "#ffffff", opacity);

    expect(contrast("#ffffff", worstCase)).toBeGreaterThanOrEqual(4.5);
  });

  it("says nothing about Enugu being the only place", () => {
    const { container } = render(<HomeHero />);

    expect(container.textContent?.toLowerCase()).not.toMatch(/enugu only|only in enugu|only enugu/);
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
});

describe("browse by type", () => {
  const CARDS = [
    ["Hospital", "hospital"],
    ["Clinic", "clinic"],
    ["Maternity", "maternity"],
    ["Pharmacy", "pharmacy"],
    ["Laboratory", "laboratory"],
  ] as const;

  it("has an h2 and five cards in the owner's order, each one link to the search for its category", () => {
    render(<BrowseByType />);

    expect(screen.getByRole("heading", { level: 2, name: "Browse by type" })).toBeInTheDocument();
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(
      CARDS.map(([label, slug]) => [label, `/search?category=${slug}`]),
    );
  });

  it("gives each card its photo, with the fixed size and the alt text of the config, loaded lazily", () => {
    render(<BrowseByType />);

    for (const [label, slug] of CARDS) {
      const photo = HOME_PHOTOS[slug];
      const card = screen.getByRole("link", { name: label });
      const image = card.querySelector("img");
      expect(image, label).toHaveAttribute("src", photo.src);
      expect(image, label).toHaveAttribute("alt", photo.alt);
      expect(image, label).toHaveAttribute("width", String(photo.width));
      expect(image, label).toHaveAttribute("height", String(photo.height));
      expect(image, label).toHaveAttribute("loading", "lazy");
    }
  });

  it("shows the label as visible text of 16 px or more, and uses no red", () => {
    const { container } = render(<BrowseByType />);

    for (const [label] of CARDS) expect(screen.getByText(label).className).not.toMatch(/\btext-(xs|sm)\b/);
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
  it("use the red emergency colour only in the hero's Emergency help button", () => {
    for (const file of ["HowItWorks", "BrowseByType", "WhySwiftHealth"]) {
      expect(readSource(`components/home/${file}.tsx`), file).not.toMatch(/emergency/);
    }
    expect(readSource("components/home/HomeHero.tsx").match(/bg-emergency|buttonClasses\("emergency"\)/g)).toHaveLength(1);
  });
});
