/** The photos of the type banners: the config, the files and the script. Requirements: US-13, NFR-01, NFR-10, NFR-13.
 * Spec: specs/2026-10-15-find-by-type/requirements.md D6 (the owner's answers of 2026-10-15): clinic, laboratory and pharmacy are approved;
 * hospital and maternity have no approved photo yet, so they get no banner and no credit. Each file is one WebP, 960 x 320 (3:1), about 40 kB or
 * less; a replaced photo has a new file name (the photos are cached for a year, netlify.toml). The originals are never in the repository.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { bannerFor, TYPE_CHOICES, type TypePhoto } from "@/config/types";

import { readWebpSize } from "../helpers/webp";

const FRONTEND = process.cwd();
const FOLDER = join(FRONTEND, "public", "images", "types");
const KILOBYTE = 1000;
const BUDGET_KB = 40;

const approvedTypes = ["clinic", "laboratory", "pharmacy"];
const typesWithoutPhoto = ["hospital", "maternity"];

function photoOf(slug: string): TypePhoto {
  const photo = TYPE_CHOICES.find((choice) => choice.slug === slug)?.photo;
  if (!photo) throw new Error(`${slug} has no photo entry`);
  return photo;
}

describe("the banner photos in config/types.ts", () => {
  it("are approved for clinic, laboratory and pharmacy, and give a banner", () => {
    for (const slug of approvedTypes) {
      expect(photoOf(slug).approved, slug).toBe(true);
      expect(bannerFor(slug), slug).toEqual(photoOf(slug));
    }
  });

  it("are not there yet for hospital and maternity: no photo entry, so no banner (the owner's answer of 2026-10-15)", () => {
    for (const slug of typesWithoutPhoto) {
      expect(TYPE_CHOICES.find((choice) => choice.slug === slug)?.photo, slug).toBeNull();
      expect(bannerFor(slug), slug).toBeUndefined();
    }
  });

  it("give no banner for another category, for no category, or for a photo that is not approved", () => {
    expect(bannerFor("ambulance")).toBeUndefined();
    expect(bannerFor("")).toBeUndefined();
    expect(bannerFor(undefined)).toBeUndefined();
  });

  it("say which part stays when the banner is cropped to about 140 px (owner, 2026-10-17): a face-first object-position, not the middle", () => {
    for (const slug of approvedTypes) {
      const match = /^(\d+)% (\d+)%$/.exec(photoOf(slug).focus);
      expect(match, `${slug}: ${photoOf(slug).focus}`).not.toBeNull();
      expect(Number(match?.[2]), slug).toBeLessThan(50); // all three faces are in the upper half, so the crop keeps the top part
    }
  });

  it("have a new-style file name, banner-<slug>-<number>.webp, so a replaced photo gets a new name", () => {
    for (const slug of approvedTypes) expect(photoOf(slug).src, slug).toBe(`/images/types/banner-${slug}-1.webp`);
  });

  it("credit Magnific with the owner's confirmed text and link: 'Designed by Magnific', www.magnific.com", () => {
    for (const slug of approvedTypes) {
      expect(photoOf(slug).credit, slug).toEqual({ text: "Designed by Magnific", href: "https://www.magnific.com" });
    }
  });

  it("have alt text: short, factual, not empty, not starting with 'image of' or 'photo of', and no brand name or medical claim", () => {
    for (const slug of approvedTypes) {
      const alt = photoOf(slug).alt;
      expect(alt.trim().length, slug).toBeGreaterThan(10);
      expect(alt.length, slug).toBeLessThanOrEqual(125);
      expect(alt.toLowerCase(), slug).not.toMatch(/^(an? )?(image|photo|picture) of/);
      expect(alt.toLowerCase(), slug).not.toMatch(/cure|treat|diagnos|heal/);
    }
  });
});

describe("the banner files", () => {
  it("are exactly the approved photos in public/images/types: nothing else, and nothing for hospital or maternity", () => {
    const listed = approvedTypes.map((slug) => photoOf(slug).src.replace("/images/types/", "")).sort();

    expect(readdirSync(FOLDER).sort()).toEqual(listed);
  });

  it("are each under 40 kB", () => {
    for (const slug of approvedTypes) {
      const kilobytes = statSync(join(FRONTEND, "public", photoOf(slug).src)).size / KILOBYTE;
      expect(kilobytes, `${slug} is ${kilobytes.toFixed(1)} kB`).toBeLessThanOrEqual(BUDGET_KB);
    }
  });

  it("are 960 x 320 (3:1), and the width and height written in the code are the real pixel size of the file", () => {
    for (const slug of approvedTypes) {
      const photo = photoOf(slug);
      expect(readWebpSize(join(FRONTEND, "public", photo.src)), slug).toEqual({ width: photo.width, height: photo.height });
      expect(`${photo.width}x${photo.height}`, slug).toBe("960x320");
    }
  });
});

describe("the script that makes the banners", () => {
  it("makes only the three approved files, from clinic.jpg, laboratory.jpg and pharmacy.jpg, and the originals stay out of git", () => {
    const script = readFileSync(join(FRONTEND, "scripts", "optimize-type-banners.mjs"), "utf8");
    const code = script.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const targets = [...code.matchAll(/target: "([a-z0-9-]+\.webp)"/g)].map((match) => match[1]).sort();
    const sources = [...code.matchAll(/source: "([a-z0-9-]+\.jpg)"/g)].map((match) => match[1]).sort();

    expect(targets).toEqual(["banner-clinic-1.webp", "banner-laboratory-1.webp", "banner-pharmacy-1.webp"]);
    expect(sources).toEqual(["clinic.jpg", "laboratory.jpg", "pharmacy.jpg"]);
    expect(readFileSync(join(FRONTEND, ".gitignore"), "utf8")).toMatch(/^image-sources\/$/m);
    expect(existsSync(join(FRONTEND, "public", "images", "types", "hospital.jpg"))).toBe(false);
  });
});
