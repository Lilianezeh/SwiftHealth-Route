/** The photos of the home page. Requirements: US-13, NFR-01 (light for 3G), NFR-10 (alt text on every image).
 * Decisions 7, 8 and 19 in specs/2026-10-11-home-redesign/requirements.md: ten photos and a smaller hero for phones, all
 * WebP, each under its budget, at the fixed pixel size written in the code. The originals (60 MB) are never in the repository.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HOME_PHOTOS, type HomePhoto } from "@/config/home";

import { readWebpSize } from "../helpers/webp";

const FRONTEND = process.cwd();
const PHOTO_FOLDER = join(FRONTEND, "public", "images", "home");
const KILOBYTE = 1000;

// The budgets of the spec (decision 8, and decision 19 for the phone hero), in kilobytes.
const BUDGET_KB: Record<string, number> = {
  hero: 150,
  heroPhone: 50,
  hero2: 150,
  hospital: 60,
  clinic: 60,
  maternity: 60,
  pharmacy: 60,
  laboratory: 60,
  ambulance: 60,
  fire: 60,
  owner: 80,
};

const photos = Object.entries(HOME_PHOTOS) as [string, HomePhoto][];

function fileOf(photo: HomePhoto): string {
  return join(FRONTEND, "public", photo.src);
}

describe("the home page photos", () => {
  it("are the eleven files of the spec: ten photos and the small hero for phones", () => {
    expect(Object.keys(HOME_PHOTOS).sort()).toEqual(Object.keys(BUDGET_KB).sort());
  });

  it("exist as .webp files in public/images/home", () => {
    for (const [name, photo] of photos) {
      expect(photo.src, name).toMatch(/^\/images\/home\/[a-z0-9-]+\.webp$/);
      expect(existsSync(fileOf(photo)), photo.src).toBe(true);
    }
  });

  it("are the only files of the folder", () => {
    const listed = photos.map(([, photo]) => photo.src.replace("/images/home/", "")).sort();

    expect(readdirSync(PHOTO_FOLDER).sort()).toEqual(listed);
  });

  it("are each under their budget: heroes 150 kB, the phone hero 50 kB, the cards and the band 60 kB, the owner photo 80 kB", () => {
    for (const [name, photo] of photos) {
      const sizeInKilobytes = statSync(fileOf(photo)).size / KILOBYTE;

      expect(sizeInKilobytes, `${name} is ${sizeInKilobytes.toFixed(1)} kB`).toBeLessThanOrEqual(BUDGET_KB[name]);
    }
  });

  it("have the width and the height written in the code, the real pixel size of the file", () => {
    for (const [name, photo] of photos) {
      expect(readWebpSize(fileOf(photo)), name).toEqual({ width: photo.width, height: photo.height });
    }
  });

  it("have the sizes of the spec: the heroes, the cards (4:3), the band and the owner photo", () => {
    const sizeOf = (name: string) => `${HOME_PHOTOS[name as keyof typeof HOME_PHOTOS].width}x${HOME_PHOTOS[name as keyof typeof HOME_PHOTOS].height}`;

    expect(sizeOf("hero")).toBe("1280x853");
    expect(sizeOf("heroPhone")).toBe("640x427");
    expect(sizeOf("hero2")).toBe("960x640");
    for (const card of ["hospital", "clinic", "maternity", "pharmacy", "laboratory"]) expect(sizeOf(card)).toBe("640x480");
    for (const band of ["ambulance", "fire"]) expect(sizeOf(band)).toBe("640x427");
    expect(sizeOf("owner")).toBe("800x533");
  });

  it("each have alt text: short, not empty, and not starting with 'image of' or 'photo of'", () => {
    for (const [name, photo] of photos) {
      expect(photo.alt.trim().length, name).toBeGreaterThan(10);
      expect(photo.alt.length, name).toBeLessThanOrEqual(125);
      expect(photo.alt.toLowerCase(), name).not.toMatch(/^(an? )?(image|photo|picture) of/);
    }
  });

  it("make the phone hero a smaller version of the same photo (same shape as the big one)", () => {
    const { hero, heroPhone } = HOME_PHOTOS;

    expect(heroPhone.width).toBeLessThan(hero.width);
    expect(Math.abs(heroPhone.width / heroPhone.height - hero.width / hero.height)).toBeLessThan(0.01);
    expect(heroPhone.alt).toBe(hero.alt); // the same photo says the same thing to a screen reader
  });
});

describe("the photo files in the repository", () => {
  it("have no original JPG, JPEG or PNG anywhere in public/", () => {
    const found: string[] = [];
    const walk = (folder: string) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(jpe?g|png)$/i.test(entry.name)) found.push(path);
      }
    };
    walk(join(FRONTEND, "public"));

    expect(found).toEqual([]);
  });

  it("keep the full-size originals out of git: image-sources/ is ignored by frontend/.gitignore", () => {
    const ignore = readFileSync(join(FRONTEND, ".gitignore"), "utf8");

    expect(ignore).toMatch(/^image-sources\/$/m);
  });
});
