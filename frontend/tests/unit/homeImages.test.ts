/** The photos of the home page. Requirements: US-13, NFR-01 (light for 3G), NFR-10 (alt text on every image).
 * Decisions 7, 8 and 19 and revisions R1, R8, R9 and R11 (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md: two photos,
 * the hero (hero3, with a smaller version for phones) and the whole portrait photo of the owners part (hero4), all WebP, each under
 * its budget, at the fixed pixel size written in the code. The originals are never in the repository, and the photos that were
 * dropped or replaced are deleted.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { HOME_PHOTOS, type HomePhoto } from "@/config/home";

import { readWebpSize } from "../helpers/webp";

const FRONTEND = process.cwd();
const PHOTO_FOLDER = join(FRONTEND, "public", "images", "home");
const KILOBYTE = 1000;

// The budgets of the spec (R11), in kilobytes. The portrait photo is whole, so it has more pixels: 100 kB, and it is lazy.
const BUDGET_KB: Record<string, number> = { owner: 100 };

const photos = Object.entries(HOME_PHOTOS) as [string, HomePhoto][];

function fileOf(photo: HomePhoto): string {
  return join(FRONTEND, "public", photo.src);
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the home page photos", () => {
  it("are one file: the portrait photo of the owners part (the hero's photos are the slider's, see heroPhotos.test.ts)", () => {
    expect(Object.keys(HOME_PHOTOS).sort()).toEqual(["owner"]);
    expect(Object.keys(HOME_PHOTOS).sort()).toEqual(Object.keys(BUDGET_KB).sort());
  });

  it("are hero4-portrait (the Unsplash photo of 2026-10-12); hero3 and hero3-phone were replaced by the slider on 2026-10-22", () => {
    expect(HOME_PHOTOS.owner.src).toBe("/images/home/hero4-portrait.webp");
  });

  it("exist as .webp files in public/images/home", () => {
    for (const [name, photo] of photos) {
      expect(photo.src, name).toMatch(/^\/images\/home\/[a-z0-9-]+\.webp$/);
      expect(existsSync(fileOf(photo)), photo.src).toBe(true);
    }
  });

  it("are the only files of the folder: every photo that was dropped or replaced is gone", () => {
    const listed = photos.map(([, photo]) => photo.src.replace("/images/home/", "")).sort();

    expect(readdirSync(PHOTO_FOLDER).sort()).toEqual(listed);
    const dropped = [
      "hero", "hero-phone", "owner", // the first photos
      "hero4", "hero4-phone", "owner2", // the second set, replaced on 2026-10-12
      "hero2", "hospital", "clinic", "maternity", "pharmacy", "laboratory", "ambulance", "fire", // dropped earlier
      "hero3", "hero3-phone", // the old hero photo, replaced by the slider on 2026-10-22
    ];
    for (const name of dropped) expect(existsSync(join(PHOTO_FOLDER, `${name}.webp`)), name).toBe(false);
  });

  it("are under their budget: the portrait photo 100 kB", () => {
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

  it("have the size of the spec (R11): the portrait photo 800x1200 (2:3)", () => {
    const sizeOf = (name: keyof typeof HOME_PHOTOS) => `${HOME_PHOTOS[name].width}x${HOME_PHOTOS[name].height}`;

    expect(sizeOf("owner")).toBe("800x1200");
  });

  it("each have alt text: short, not empty, and not starting with 'image of' or 'photo of'", () => {
    for (const [name, photo] of photos) {
      expect(photo.alt.trim().length, name).toBeGreaterThan(10);
      expect(photo.alt.length, name).toBeLessThanOrEqual(125);
      expect(photo.alt.toLowerCase(), name).not.toMatch(/^(an? )?(image|photo|picture) of/);
    }
  });

  it("describe what is in them: a health worker with a blister pack in the owners part", () => {
    expect(HOME_PHOTOS.owner.alt.toLowerCase()).toMatch(/blister pack|pills/);
  });
});

describe("the photo files in the repository", () => {
  it("have no original JPG, JPEG or PNG anywhere in public/, except the one small WhatsApp glyph (a brand file, not a photo)", () => {
    const found: string[] = [];
    const walk = (folder: string) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(jpe?g|png)$/i.test(entry.name)) found.push(path.replace(`${FRONTEND}${sep}`, ""));
      }
    };
    walk(join(FRONTEND, "public"));

    // The listing page's WhatsApp button uses the owner's WhatsApp glyph, only scaled to 72 x 72 (whatsappGlyph.test.ts): a PNG with
    // transparency, a few kilobytes. The two app icons of the manifest (public/icons/, made from the logo pin by
    // scripts/make-app-icons.mjs, tests/unit/appIcons.test.ts) are the other exception: Chrome needs PNG icons to offer "Install".
    // Any other PNG or JPG, such as a photo original, is still refused.
    expect(found.sort()).toEqual([
      join("public", "icons", "icon-192.png"),
      join("public", "icons", "icon-512.png"),
      join("public", "images", "brand", "whatsapp-glyph-72.png"),
    ]);
  });

  it("keep the full-size originals out of git: image-sources/ is ignored by frontend/.gitignore", () => {
    const ignore = readFileSync(join(FRONTEND, ".gitignore"), "utf8");

    expect(ignore).toMatch(/^image-sources\/$/m);
  });

  it("are made by a script that makes only this file, from hero4.jpg", () => {
    const script = readFileSync(join(FRONTEND, "scripts", "optimize-home-images.mjs"), "utf8");
    const code = withoutComments(script);
    const targets = [...code.matchAll(/target: "([a-z0-9-]+\.webp)"/g)].map((match) => match[1]).sort();
    const sources = [...code.matchAll(/source: "([a-z0-9-]+\.jpg)"/g)].map((match) => match[1]).sort();

    expect(targets).toEqual(["hero4-portrait.webp"]);
    expect(sources).toEqual(["hero4.jpg"]);
    expect(code).not.toContain("owner2"); // no longer used
  });

  it("keep the hero's originals out of git too: source-photos/ is ignored, and nothing of it is in public/", () => {
    const ignore = readFileSync(join(FRONTEND, ".gitignore"), "utf8");

    expect(ignore).toMatch(/^source-photos\/$/m);
    expect(existsSync(join(FRONTEND, "public", "images", "hero", "hero.jpg"))).toBe(false);
  });

  it("do not crop the portrait photo of the owners part: its job has no crop and keeps the 2:3 shape", () => {
    const code = withoutComments(readFileSync(join(FRONTEND, "scripts", "optimize-home-images.mjs"), "utf8"));
    const ownerJob = code.match(/\{[^{}]*target: "hero4-portrait\.webp"[^{}]*\}/)?.[0] ?? "";

    expect(ownerJob).not.toContain("crop");
    expect(HOME_PHOTOS.owner.width / HOME_PHOTOS.owner.height).toBeCloseTo(2 / 3, 2);
  });
});
