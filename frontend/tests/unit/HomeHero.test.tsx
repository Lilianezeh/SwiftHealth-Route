// @vitest-environment jsdom
/** The hero of the home page around its photo slider. Requirements: US-13, NFR-01, NFR-10. Spec: specs/2026-10-22-home-photos/requirements.md
 * part 2 (owner's answers: a plain search form to /search, SwiftRescue in the header only, one fixed Magnific credit); ui-spec 2.1.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeHero } from "@/components/home/HomeHero";
import { HERO_SLIDES } from "@/config/heroPhotos";

import { contrast, laidOver, tokenColour } from "../helpers/contrast";
import { readSource } from "../helpers/source";

const WHITE = "#ffffff";
const PINE_DARK = tokenColour("pine-dark");

/** The percent in a class like `lg:from-pine-dark/85` of the slider's source, as a number from 0 to 1. */
function opacityOf(classPattern: string): number {
  const found = new RegExp(`${classPattern}/(\\d+)`).exec(readSource("components/home/HeroSlider.tsx"));
  if (!found) throw new Error(`no class ${classPattern}/<percent> in HeroSlider.tsx`);
  return Number(found[1]) / 100;
}

describe("the search form", () => {
  it("is a plain GET form to /search with one field named q, a visible label and a Search button: it works before any script", () => {
    const { container } = render(<HomeHero />);

    const form = container.querySelector("form") as HTMLFormElement;
    expect(form).toHaveAttribute("action", "/search");
    expect(form.getAttribute("method")?.toLowerCase()).toBe("get");
    expect(form).toHaveAttribute("role", "search");
    const field = within(form).getByRole("searchbox", { name: /search/i });
    expect(field).toHaveAttribute("name", "q");
    expect(field.getAttribute("type")).toBe("search");
    expect(within(form).getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
    expect(container.querySelectorAll("form")).toHaveLength(1);
  });

  it("has a label you can see (16 px or more) tied to the field, and a 48 px field and button", () => {
    const { container } = render(<HomeHero />);

    const field = screen.getByRole("searchbox");
    const label = container.querySelector(`label[for="${field.id}"]`) as HTMLElement;
    expect(label).not.toBeNull();
    expect(label.className).not.toMatch(/sr-only|\btext-(xs|sm)\b/);
    expect(field.className).toMatch(/\bmin-h-12\b/);
    expect(field.className).toMatch(/\btext-base\b/); // 16 px: no zoom on a phone
    expect(screen.getByRole("button", { name: "Search" }).className).toMatch(/min-h-\[50px\]/);
  });

  it("has the white on-dark Search button, like the other button of the hero, and nothing red", () => {
    const { container } = render(<HomeHero />);

    const button = screen.getByRole("button", { name: "Search" });
    expect(button.className).toMatch(/\bbg-white\b/);
    expect(button.className).toMatch(/\btext-pine-dark\b/);
    expect(container.querySelectorAll('[class*="emergency"]')).toHaveLength(0);
    expect(readSource("components/home/HomeHero.tsx")).not.toMatch(/bg-emergency|text-emergency|buttonClasses\("emergency"\)/);
    expect(readSource("components/home/HeroSearch.tsx")).not.toMatch(/bg-emergency|text-emergency|buttonClasses\("emergency"\)/);
  });
});

describe("the links of the hero", () => {
  it("are 'Find care near me' to /find and the credit: no SwiftRescue and no Emergency help button in the hero (owner, 2026-10-22)", () => {
    render(<HomeHero />);

    const names = screen.getAllByRole("link").map((link) => link.textContent);
    expect(names).toEqual(["Find care near me", "Designed by Magnific (opens in a new tab)"]);
    expect(screen.getByRole("link", { name: "Find care near me" })).toHaveAttribute("href", "/find");
    expect(screen.queryByRole("link", { name: /swiftrescue|emergency/i })).toBeNull();
  });

  it("do not download another page early: prefetch is off for the Find care link", () => {
    expect(readSource("components/home/HomeHero.tsx")).toMatch(/prefetch=\{false\}/);
  });
});

describe("the text stays readable on every photo", () => {
  it("has white text on at least 4.5:1 under the overlay from 1024 px, even on a pure white photo: 80% on the left", () => {
    const overlayOnText = opacityOf("lg:from-pine-dark");
    expect(opacityOf("lg:via-pine-dark")).toBe(overlayOnText);
    expect(overlayOnText).toBeGreaterThanOrEqual(0.8);

    const worstCase = laidOver(PINE_DARK, WHITE, overlayOnText);
    expect(contrast(WHITE, worstCase)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(WHITE, worstCase)).toBeCloseTo(5.26, 1);
  });

  it("is lighter on the right, away from the text: 30% there, so the photo shows", () => {
    expect(opacityOf("lg:to-pine-dark")).toBeLessThan(opacityOf("lg:from-pine-dark"));
    expect(opacityOf("lg:to-pine-dark")).toBeCloseTo(0.3, 2);
  });

  it("has the header's white links on a veil of 80% over the top 6 rem, at least 4.5:1 on a pure white photo", () => {
    const veil = opacityOf("(?<![:\\w-])from-pine-dark");
    expect(veil).toBe(0.8);
    expect(contrast(WHITE, laidOver(PINE_DARK, WHITE, veil))).toBeGreaterThanOrEqual(4.5);
  });

  it("has a credit chip dark enough for its white 16 px text on a pure white photo", () => {
    render(<HomeHero />);

    const chip = Number(/\bbg-pine-dark\/(\d+)/.exec(screen.getByRole("link", { name: /Designed by Magnific/ }).className)?.[1]) / 100;
    expect(contrast(WHITE, laidOver(PINE_DARK, WHITE, chip))).toBeGreaterThanOrEqual(4.5);
  });

  it("has no text on a phone or tablet over a photo: the photo is a band above the text, which sits on the blue gradient", () => {
    const { container } = render(<HomeHero />);

    const band = container.querySelector("[data-slide]")?.parentElement as HTMLElement;
    const heading = screen.getByRole("heading", { level: 1 });
    expect(band.contains(heading)).toBe(false);
    expect(band.className).toMatch(/(^|\s)relative\b/);
    expect(band.className).toMatch(/\blg:absolute\b/); // only from 1024 px does the photo go behind the text
    expect(band.className).toMatch(/(^|\s)h-72\b/);
    // The band is drawn first (order-first) but comes last in the page order, so a keyboard user reaches the heading, the search box and the
    // controls before the credit link, and a screen reader reads the heading first.
    expect(band.className).toMatch(/(^|\s)order-first\b/);
    expect(band.className).toMatch(/\blg:order-none\b/);
    expect(heading.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(contrast(WHITE, tokenColour("sky"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(WHITE, PINE_DARK)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the page around the slider", () => {
  it("is still one h1, the line and the note, and the first photo with the honest alt text of the config", () => {
    const { container } = render(<HomeHero />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelector("img")).toHaveAttribute("alt", HERO_SLIDES[0].alt);
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("has the old hero photo gone from the code and the config (hero3 became a slide)", () => {
    expect(readSource("components/home/HomeHero.tsx")).not.toMatch(/hero3|HOME_PHOTOS/);
    expect(readSource("config/home.ts")).not.toMatch(/hero3|heroPhone/);
  });

  it("names no city and shows no figure the owner did not give", () => {
    const { container } = render(<HomeHero />);

    expect(container.textContent?.toLowerCase()).not.toMatch(/enugu|more cities|now live/);
    expect(container.textContent).not.toMatch(/\d+\s?%|\d{2,}\+?\s(places|listings|users)/);
  });
});
