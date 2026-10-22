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

// The budgets of the spec (R11), in kilobytes. (The owners' portrait photo, hero4-portrait, was replaced by the `owner` photo of the sections on
// 2026-10-22: specs/2026-10-22-home-photos/; the section photos are tested in sectionPhotos.test.ts.)
const BUDGET_KB: Record<string, number> = { hero: 150, heroPhone: 50 };

const photos = Object.entries(HOME_PHOTOS) as [string, HomePhoto][];

function fileOf(photo: HomePhoto): string {
  return join(FRONTEND, "public", photo.src);
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the home page photos", () => {
  it("are two files: the hero and the small hero for phones (the hero does not change: owner, 2026-10-22)", () => {
    expect(Object.keys(HOME_PHOTOS).sort()).toEqual(["hero", "heroPhone"]);
    expect(Object.keys(HOME_PHOTOS).sort()).toEqual(Object.keys(BUDGET_KB).sort());
  });

  it("are hero3 (the hero) and hero3-phone (the Unsplash photo of 2026-10-12)", () => {
    expect(HOME_PHOTOS.hero.src).toBe("/images/home/hero3.webp");
    expect(HOME_PHOTOS.heroPhone.src).toBe("/images/home/hero3-phone.webp");
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
    ];
    expect(existsSync(join(PHOTO_FOLDER, "hero4-portrait.webp")), "hero4-portrait (replaced by `owner`, 2026-10-22)").toBe(false);
    for (const name of dropped) expect(existsSync(join(PHOTO_FOLDER, `${name}.webp`)), name).toBe(false);
  });

  it("are each under their budget: the hero 150 kB, the phone hero 50 kB", () => {
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

  it("have the sizes of the spec (R11): the hero 1200x1200 and the phone hero 640x640", () => {
    const sizeOf = (name: keyof typeof HOME_PHOTOS) => `${HOME_PHOTOS[name].width}x${HOME_PHOTOS[name].height}`;

    expect(sizeOf("hero")).toBe("1200x1200");
    expect(sizeOf("heroPhone")).toBe("640x640");
  });

  it("each have alt text: short, not empty, and not starting with 'image of' or 'photo of'", () => {
    for (const [name, photo] of photos) {
      expect(photo.alt.trim().length, name).toBeGreaterThan(10);
      expect(photo.alt.length, name).toBeLessThanOrEqual(125);
      expect(photo.alt.toLowerCase(), name).not.toMatch(/^(an? )?(image|photo|picture) of/);
    }
  });

  it("describe what is in them: a stethoscope and a gauge in the hero", () => {
    expect(HOME_PHOTOS.hero.alt.toLowerCase()).toMatch(/stethoscope/);
    expect(HOME_PHOTOS.hero.alt.toLowerCase()).toMatch(/gauge|blood pressure/);
  });

  it("make the phone hero a smaller version of the same photo (same shape as the big one)", () => {
    const { hero, heroPhone } = HOME_PHOTOS;

    expect(heroPhone.width).toBeLessThan(hero.width);
    expect(Math.abs(heroPhone.width / heroPhone.height - hero.width / hero.height)).toBeLessThan(0.01);
    expect(heroPhone.alt).toBe(hero.alt); // the same photo says the same thing to a screen reader
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

  it("are made by a script that makes only these two files, from hero3.jpg", () => {
    const script = readFileSync(join(FRONTEND, "scripts", "optimize-home-images.mjs"), "utf8");
    const code = withoutComments(script);
    const targets = [...code.matchAll(/target: "([a-z0-9-]+\.webp)"/g)].map((match) => match[1]).sort();
    const sources = [...code.matchAll(/source: "([a-z0-9-]+\.jpg)"/g)].map((match) => match[1]).sort();

    expect(targets).toEqual(["hero3-phone.webp", "hero3.webp"]);
    expect(sources).toEqual(["hero3.jpg", "hero3.jpg"]);
    expect(code).not.toMatch(/owner2|hero4/); // no longer used
  });
});
