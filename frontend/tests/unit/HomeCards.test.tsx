// @vitest-environment jsdom
/** The livelier home page: three feature cards, one card style, one spacing rhythm, a gentle CSS fade-in, and only real links.
 * Requirements: US-13, NFR-01, NFR-10. Spec: specs/2026-10-22-home-photos/requirements.md part 3; ui-spec 2.1 (revision of 2026-10-22).
 */
import { render, screen, within } from "@testing-library/react";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import Home from "@/app/(home)/page";
import { FacilityOwners } from "@/components/home/FacilityOwners";
import { FeatureCards } from "@/components/home/FeatureCards";
import { FindByType } from "@/components/home/FindByType";
import { Overview } from "@/components/home/Overview";
import { WhySwiftHealth } from "@/components/home/WhySwiftHealth";
import { PageFrame } from "@/components/layout/PageFrame";

import { readSource } from "../helpers/source";

const APP_FOLDER = join(process.cwd(), "src", "app");

/** Every address that has a page.tsx, without the route groups in brackets: "/find", "/blood/donate", "/listing/[slug]". */
function routesOfTheApp(folder = APP_FOLDER, prefix = ""): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const isGroup = /^\(.+\)$/.test(entry.name);
    const path = isGroup ? prefix : `${prefix}/${entry.name}`;
    if (existsSync(join(folder, entry.name, "page.tsx"))) routes.push(path === "" ? "/" : path);
    routes.push(...routesOfTheApp(join(folder, entry.name), path));
  }
  return routes;
}

describe("the three feature cards", () => {
  it("are Find care, SwiftRescue emergency numbers and Find blood, each one link to a page that exists, in this order", () => {
    render(<FeatureCards />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/find", "/emergency", "/blood"]);
    expect(links.map((link) => link.getAttribute("aria-labelledby") && link.querySelector(`#${link.getAttribute("aria-labelledby")}`)?.textContent)).toEqual([
      "Find care",
      "SwiftRescue emergency numbers",
      "Find blood",
    ]);
  });

  it("say what the page does in plain words: the emergency card says 112 comes first; nothing is promised that the app does not do", () => {
    const { container } = render(<FeatureCards />);

    expect(screen.getByText(/112 first/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d+\s?%|guarantee|dispatch|within \d+ minutes/i);
    expect(container.textContent?.toLowerCase()).not.toMatch(/enugu|review|testimonial|rated/);
  });

  it("are plain cards with an icon: no photo, no red, no heading that would change the page's outline", () => {
    const { container } = render(<FeatureCards />);

    expect(container.querySelectorAll("img, picture")).toHaveLength(0);
    expect(container.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(3);
    expect(container.querySelectorAll('[class*="emergency"]')).toHaveLength(0);
    expect(screen.queryAllByRole("heading")).toHaveLength(0);
  });

  it("are 48 px or more high with 16 px text or more", () => {
    const { container } = render(<FeatureCards />);

    for (const link of screen.getAllByRole("link")) expect(link.className).toMatch(/\bmin-h-(24|28|32)\b/);
    expect(container.innerHTML).not.toMatch(/\btext-(xs|sm)\b/);
  });

  it("do not download another page early: prefetch is off", () => {
    expect(readSource("components/home/FeatureCards.tsx")).toMatch(/prefetch=\{false\}/);
  });
});

describe("one card style and one rhythm", () => {
  it("give the cards, the type tiles and the owner photo the same rounded-2xl corners and the white cards a 1 px line border", () => {
    const cards = render(<FeatureCards />).container;
    const tiles = render(<FindByType />).container;

    for (const link of within(cards).getAllByRole("link")) {
      expect(link.className).toMatch(/\brounded-2xl\b/);
      expect(link.className).toMatch(/\bborder border-line\b/);
      expect(link.className).toMatch(/\bbg-white\b/);
      expect(link.className).toMatch(/\bshadow-card\b/);
    }
    for (const link of within(tiles).getAllByRole("link")) {
      expect(link.className).toMatch(/\brounded-2xl\b/);
      expect(link.className).toMatch(/\bborder border-line\b/);
      expect(link.className).toMatch(/\bshadow-card\b/);
    }
  });

  it("give every part below the hero the same space: py-12 on a phone and py-16 from 768 px", () => {
    for (const part of [FeatureCards, Overview, WhySwiftHealth, FindByType, FacilityOwners]) {
      const { container } = render(<>{part()}</>);
      const inner = container.querySelector("section > div") as HTMLElement;

      expect(inner.className, part.name).toMatch(/\bpy-12\b/);
      expect(inner.className, part.name).toMatch(/\bmd:py-16\b/);
    }
  });

  it("use no colour that is not a token, and no red but the header's SwiftRescue button", () => {
    for (const file of ["FeatureCards", "Overview", "FindByType", "WhySwiftHealth", "FacilityOwners", "HeroSearch", "HeroSlider", "HomeHero"]) {
      const source = readSource(`components/home/${file}.tsx`);
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|bg-emergency|text-emergency|border-emergency/);
    }
  });
});

describe("the fade-in", () => {
  const css = readFileSync(join(process.cwd(), "src", "styles", "globals.css"), "utf8");

  it("is CSS only: the .reveal rule is inside @media (prefers-reduced-motion: no-preference) and inside @supports (animation-timeline: view())", () => {
    const noPreference = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    const supports = css.indexOf("@supports (animation-timeline: view())");
    const reveal = css.indexOf(".reveal");

    expect(noPreference).toBeGreaterThan(-1);
    expect(supports).toBeGreaterThan(noPreference);
    expect(reveal).toBeGreaterThan(supports);
    expect(css.match(/\.reveal\b/g)).not.toBeNull();
    // No .reveal anywhere before the guards, so a browser without support, or with reduce motion, never hides a section.
    expect(css.slice(0, supports)).not.toMatch(/\.reveal/);
  });

  it("only moves opacity and a 12 px rise, which the browser can draw without redoing the layout (no layout shift)", () => {
    const rule = css.slice(css.indexOf(".reveal"));

    expect(rule).toMatch(/opacity/);
    expect(rule).toMatch(/translateY\(12px\)/);
    expect(rule).not.toMatch(/\b(height|width|margin|top|left)\s*:/);
  });

  it("is on the parts below the hero and not on the hero", () => {
    for (const file of ["FeatureCards", "Overview", "WhySwiftHealth", "FindByType", "FacilityOwners"]) {
      expect(readSource(`components/home/${file}.tsx`), file).toMatch(/<section[^>]*className="[^"]*\breveal\b/);
    }
    expect(readSource("components/home/HeroSlider.tsx")).not.toMatch(/\breveal\b/);
  });

  it("sends no JavaScript: no observer, no timer and no state in the parts below the hero", () => {
    for (const file of ["FeatureCards", "Overview", "WhySwiftHealth", "FindByType", "FacilityOwners"]) {
      expect(readSource(`components/home/${file}.tsx`), file).not.toMatch(/IntersectionObserver|useEffect|useState|use client/);
    }
  });
});

describe("every link and button of the page goes to a page that exists", () => {
  it("has only addresses with a page.tsx in the app, and a search form to /search", () => {
    const { container } = render(
      <PageFrame isHomePage>
        <Home />
      </PageFrame>,
    );
    const routes = routesOfTheApp();
    const addresses = [...container.querySelectorAll("a[href]")]
      .map((link) => link.getAttribute("href") as string)
      .filter((href) => href.startsWith("/"))
      .map((href) => href.split("?")[0].split("#")[0]);

    expect(addresses.length).toBeGreaterThan(10);
    for (const address of new Set(addresses)) {
      const exists = routes.some((route) => route === address || new RegExp(`^${route.replace(/\[[^\]]+\]/g, "[^/]+")}$`).test(address));
      expect(exists, `${address} has no page`).toBe(true);
    }
    expect(routes).toContain("/search");
    for (const form of container.querySelectorAll("form")) expect(routes).toContain(form.getAttribute("action"));
  });
});

describe("no invented figures", () => {
  it("has no number on the page besides what the owner's words and the controls say, no percent sign, no review or rating", () => {
    const { container } = render(
      <PageFrame isHomePage>
        <Home />
      </PageFrame>,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/%/);
    expect(text.toLowerCase()).not.toMatch(/testimonial|reviews?\b|rated|stars?\b|customers|users trust/);
    // The only digits: the year in the footer, 112, "24-hour", and the dots "Show photo N of 8".
    const withoutKnown = text.replace(/20\d\d/g, "").replace(/\b112\b/g, "").replace(/24-hour/g, "").replace(/Show photo \d of 8/g, "");
    expect(withoutKnown).not.toMatch(/\d/);
  });
});
