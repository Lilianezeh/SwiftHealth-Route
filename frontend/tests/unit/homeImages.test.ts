/** The photos of the home page. Requirements: US-13, NFR-01 (light for 3G), NFR-10 (alt text on every image).
 * Decisions 7, 8 and 19 and revision R1 (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md: two photos, the hero and
 * the owner photo, plus a smaller hero for phones, all WebP, each under its budget, at the fixed pixel size written in the
 * code. The originals (60 MB) are never in the repository, and the photos the owner dropped are deleted.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HOME_PHOTOS, type HomePhoto } from "@/config/home";

import { readWebpSize } from "../helpers/webp";

const FRONTEND = process.cwd();
const PHOTO_FOLDER = join(FRONTEND, "public", "images", "home");
const KILOBYTE = 1000;

// The budgets of the spec (decision 8 and R1; decision 19 for the phone hero), in kilobytes.
const BUDGET_KB: Record<string, number> = { hero: 150, heroPhone: 50, owner: 80 };

const photos = Object.entries(HOME_PHOTOS) as [string, HomePhoto][];

function fileOf(photo: HomePhoto): string {
  return join(FRONTEND, "public", photo.src);
}

describe("the home page photos", () => {
  it("are the three files of the spec: the hero, the small hero for phones, and the owner photo", () => {
    expect(Object.keys(HOME_PHOTOS).sort()).toEqual(["hero", "heroPhone", "owner"]);
    expect(Object.keys(HOME_PHOTOS).sort()).toEqual(Object.keys(BUDGET_KB).sort());
  });

  it("exist as .webp files in public/images/home", () => {
    for (const [name, photo] of photos) {
      expect(photo.src, name).toMatch(/^\/images\/home\/[a-z0-9-]+\.webp$/);
      expect(existsSync(fileOf(photo)), photo.src).toBe(true);
    }
  });

  it("are the only files of the folder: the eight photos the owner dropped are gone", () => {
    const listed = photos.map(([, photo]) => photo.src.replace("/images/home/", "")).sort();

    expect(readdirSync(PHOTO_FOLDER).sort()).toEqual(listed);
    for (const dropped of ["hero2", "hospital", "clinic", "maternity", "pharmacy", "laboratory", "ambulance", "fire"]) {
      expect(existsSync(join(PHOTO_FOLDER, `${dropped}.webp`)), dropped).toBe(false);
    }
  });

  it("are each under their budget: the hero 150 kB, the phone hero 50 kB, the owner photo 80 kB", () => {
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

  it("have the sizes of the spec: the hero 1280x853, the phone hero 640x427, the owner photo 800x533", () => {
    const sizeOf = (name: keyof typeof HOME_PHOTOS) => `${HOME_PHOTOS[name].width}x${HOME_PHOTOS[name].height}`;

    expect(sizeOf("hero")).toBe("1280x853");
    expect(sizeOf("heroPhone")).toBe("640x427");
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

  it("are made by a script that makes only these three files", () => {
    const script = readFileSync(join(FRONTEND, "scripts", "optimize-home-images.mjs"), "utf8");
    const targets = [...script.matchAll(/target: "([a-z0-9-]+\.webp)"/g)].map((match) => match[1]).sort();

    expect(targets).toEqual(["hero-phone.webp", "hero.webp", "owner.webp"]);
  });
});
