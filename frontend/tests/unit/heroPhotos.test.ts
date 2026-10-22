/** The eight photos of the home page slider. Requirements: US-13, NFR-01 (light for 3G), NFR-10 (honest alt text), NFR-13 (credit).
 * Spec: specs/2026-10-22-home-photos/requirements.md (the photos table). Every slide has a phone file (640 x 900, up to 40 kB) and a wide
 * file (1280 x 800, up to 100 kB), at the real pixel size written in the config; nothing else is in the folder; no original is served.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HERO_CREDIT, HERO_FADE_MS, HERO_SLIDE_SECONDS, HERO_SLIDES, HERO_SIZES } from "@/config/heroPhotos";

import { readWebpSize } from "../helpers/webp";

const FOLDER = join(process.cwd(), "public", "images", "hero");
const KILOBYTE = 1000;
const OWNER_ORDER = ["laboratory", "pharmacist", "stethoscope-capsules", "stethoscope", "pharmacy-counter", "consultation", "pharmacists", "nurse"];

function fileOf(source: string): string {
  return join(process.cwd(), "public", source);
}

describe("the slides", () => {
  it("are the owner's eight photos, in the owner's order (laboratory, pharmacy, hero, hero3, owner, maternity, hero2, clinic)", () => {
    expect(HERO_SLIDES.map((slide) => slide.name)).toEqual(OWNER_ORDER);
  });

  it("name every photo for the dots with a short name, and give each an honest sentence of alt text with no city", () => {
    for (const slide of HERO_SLIDES) {
      expect(slide.shortName.length, slide.name).toBeGreaterThan(3);
      expect(slide.alt.length, slide.name).toBeGreaterThan(30);
      expect(slide.alt, slide.name).not.toMatch(/^(image|photo|picture) of/i);
      expect(slide.alt, slide.name).toMatch(/\.$/);
      expect(slide.alt.toLowerCase(), slide.name).not.toMatch(/enugu|nigeria|lagos/);
    }
    expect(new Set(HERO_SLIDES.map((slide) => slide.shortName)).size).toBe(HERO_SLIDES.length);
  });

  it("keep the timing of the spec: about 6 seconds a photo, a 1.5 second fade", () => {
    expect(HERO_SLIDE_SECONDS).toBe(6);
    expect(HERO_FADE_MS).toBe(1500);
  });

  it("have one fixed credit: 'Designed by Magnific' to www.magnific.com (owner, 2026-10-22), the same for every slide", () => {
    expect(HERO_CREDIT).toEqual({ text: "Designed by Magnific", href: "https://www.magnific.com" });
    for (const slide of HERO_SLIDES) expect(Object.keys(slide), slide.name).not.toContain("credit");
  });
});

describe("the files", () => {
  const files = HERO_SLIDES.flatMap((slide) => [
    { slide: slide.name, source: slide.phoneSrc, size: HERO_SIZES.phone },
    { slide: slide.name, source: slide.wideSrc, size: HERO_SIZES.wide },
  ]);

  it("are two WebP files for each slide, named hero-<name>-640.webp and hero-<name>-1280.webp, and they exist", () => {
    expect(files).toHaveLength(16);
    for (const { slide, source } of files) expect(existsSync(fileOf(source)), source).toBe(true);
    for (const slide of HERO_SLIDES) {
      expect(slide.phoneSrc).toBe(`/images/hero/hero-${slide.name}-640.webp`);
      expect(slide.wideSrc).toBe(`/images/hero/hero-${slide.name}-1280.webp`);
    }
  });

  it("are the only files of the folder: no original JPG and no leftover", () => {
    const expected = files.map(({ source }) => source.replace("/images/hero/", "")).sort();
    expect(readdirSync(FOLDER).sort()).toEqual(expected);
  });

  it("are under their budget: 40 kB for a phone file and 100 kB for a wide file", () => {
    for (const { source, size } of files) {
      expect(statSync(fileOf(source)).size / KILOBYTE, source).toBeLessThanOrEqual(size.budgetKb);
    }
  });

  it("have the real pixel size of the config: 640 x 900 and 1280 x 800", () => {
    expect(HERO_SIZES.phone).toMatchObject({ width: 640, height: 900 });
    expect(HERO_SIZES.wide).toMatchObject({ width: 1280, height: 800 });
    for (const { source, size } of files) {
      const real = readWebpSize(fileOf(source));
      expect({ width: real.width, height: real.height }, source).toEqual({ width: size.width, height: size.height });
    }
  });
});
