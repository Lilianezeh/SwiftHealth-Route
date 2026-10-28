/** The photos of the hero slideshow and of SwiftRescue. Requirements: US-13, US-04, NFR-01 (light for 3G), NFR-10, NFR-13 (credit).
 * Spec: specs/2026-10-28-hero-slideshow/requirements.md. The hero shows the stethoscope first, then the five Magnific photos the
 * "Find by type" slideshow used (clinic, hospital, maternity, laboratory, pharmacy), each in two sizes (800 and 1600 px); the two SwiftRescue
 * photos are 640 x 240 under 40 kB. The stethoscope and the owners' photos are exactly the files of `main`, in the same places.
 * The focus points are checked here by maths: where each photo's face lands when the photo fills the band of the hero at a given screen width.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HOME_PHOTOS } from "@/config/home";
import { EMERGENCY_PHOTOS, HERO_SLIDES, MAGNIFIC_CREDIT } from "@/config/sitePhotos";

import { readWebpSize } from "../helpers/webp";

const KILOBYTE = 1000;
const PUBLIC = join(process.cwd(), "public");

const fileOf = (photo: { src: string }) => join(PUBLIC, photo.src);
const emergency = Object.values(EMERGENCY_PHOTOS);

describe("the slides in the config", () => {
  it("are the owner's five, in the owner's order: clinic, hospital, maternity, laboratory, pharmacy (the stethoscope is the first slide, from HOME_PHOTOS)", () => {
    expect(HERO_SLIDES.map((photo) => photo.src)).toEqual([
      "/images/backdrop/nurse-corridor-800.webp", // clinic
      "/images/backdrop/doctor-and-patient-800.webp", // hospital
      "/images/backdrop/consultation-800.webp", // maternity
      "/images/backdrop/laboratory-800.webp", // laboratory
      "/images/backdrop/pharmacist-customer-800.webp", // pharmacy
    ]);
    expect(HERO_SLIDES.map((photo) => photo.srcLarge)).toEqual(HERO_SLIDES.map((photo) => photo.src.replace("-800.webp", "-1600.webp")));
    expect(HOME_PHOTOS.hero.src).toBe("/images/home/hero3.webp"); // the first slide, as on main
  });

  it("have none of the photos the owner did not choose, and none of ambulance, fire, hero3 or hero4", () => {
    const text = JSON.stringify(HERO_SLIDES.map(({ src, srcLarge }) => ({ src, srcLarge })));
    for (const left of ["stethoscope", "pharmacists-screen", "pharmacy-counter", "owner", "pharmacy6", "hero", "ambulance", "fire"]) {
      expect(text, left).not.toContain(left);
    }
  });

  it("each have an honest alt text: one sentence, written after looking at the photo, no medical claim, no city", () => {
    for (const photo of HERO_SLIDES) {
      expect(photo.alt.length, photo.src).toBeGreaterThan(30);
      expect(photo.alt, photo.src).toMatch(/\.$/);
      expect(photo.alt.toLowerCase(), photo.src).not.toMatch(/enugu|\bcure|treat|diagnos|\bheal|\bcross\b/);
    }
    expect(new Set(HERO_SLIDES.map((photo) => photo.alt)).size).toBe(HERO_SLIDES.length);
  });

  it("have no brightness, wash, tint or filter in the config (a photo is shown as it is, in both modes)", () => {
    for (const photo of HERO_SLIDES) {
      expect(Object.keys(photo).sort(), photo.src).toEqual(["alt", "focus", "focusWide", "height", "src", "srcLarge", "width", "widthLarge"]);
    }
  });

  it("have one credit for all the photos of the site: 'Designed by Magnific' to www.magnific.com (it is shown in the footer)", () => {
    expect(MAGNIFIC_CREDIT).toEqual({ text: "Designed by Magnific", href: "https://www.magnific.com" });
  });
});

describe("the focus points: no face is cut at 320, 360, 768 and 1280 px (and at the widths around them)", () => {
  // A face box in the 800 x 533 photo: left, top, right, bottom (from forehead to chin, ear to ear), written after looking at each photo.
  const FACES: Record<string, readonly [number, number, number, number]> = {
    "nurse-corridor": [140, 40, 270, 215],
    "doctor-and-patient": [565, 55, 775, 300],
    consultation: [295, 55, 420, 230],
    laboratory: [175, 90, 345, 285],
    "pharmacist-customer": [345, 85, 510, 285],
  };
  const PHOTO = { width: 800, height: 533 };

  /** The hero's band: under 1024 px it is as wide as the screen and 16 rem (256 px) high, 18 rem (288 px) from 768 px, with the controls at its
   * bottom; from 1024 px it is the right half of the screen and as high as the section (85% of the screen's height). */
  function bandAt(viewport: number, screenHeight: number) {
    if (viewport >= 1024) return { width: viewport / 2, height: Math.round(0.85 * screenHeight), wide: true };
    return { width: viewport, height: viewport < 768 ? 256 : 288, wide: false };
  }

  /** Where the controls are, in the band: up to 479 px two rows (the dots, then the buttons), hanging 16 px below the band; from 480 px one
   * row of 464 px at the bottom left. From 1024 px they are low in a tall band, clear of the faces. */
  function controlsAt(viewport: number, band: ReturnType<typeof bandAt>) {
    if (band.wide) return null;
    if (viewport < 480) return { left: 0, top: band.height + 16 - 104, right: band.width, bottom: band.height + 16 };
    return { left: 16, top: band.height - 48, right: 16 + 464, bottom: band.height };
  }

  /** The face in the band's own pixels, when the photo is scaled to fill the band (object-fit: cover) and placed by `focus` ("x% y%"). */
  function faceInBand(name: string, band: ReturnType<typeof bandAt>, focus: string) {
    const [focusX, focusY] = focus.split(" ").map((part) => parseFloat(part) / 100);
    const scale = Math.max(band.width / PHOTO.width, band.height / PHOTO.height);
    const offsetX = (PHOTO.width * scale - band.width) * focusX;
    const offsetY = (PHOTO.height * scale - band.height) * focusY;
    const [left, top, right, bottom] = FACES[name];
    return { left: left * scale - offsetX, top: top * scale - offsetY, right: right * scale - offsetX, bottom: bottom * scale - offsetY };
  }

  const NARROW = [[320, 568], [360, 740], [375, 667], [390, 844], [414, 896], [430, 932], [600, 900], [767, 1024], [768, 1024]] as const;
  const WIDE = [[1024, 768], [1100, 800], [1280, 800], [1440, 900], [1600, 900], [1920, 1080]] as const;

  for (const photo of HERO_SLIDES) {
    const name = photo.src.split("/").pop()!.replace("-800.webp", "");

    it(`${name}: the whole face is inside the band and clear of the controls, from 320 to 768 px`, () => {
      for (const [viewport, screenHeight] of NARROW) {
        const band = bandAt(viewport, screenHeight);
        const face = faceInBand(name, band, photo.focus);
        const label = `${name} at ${viewport} px: face ${JSON.stringify(face)} in a band of ${band.width} x ${band.height}`;
        expect(face.left, label).toBeGreaterThanOrEqual(4);
        expect(face.top, label).toBeGreaterThanOrEqual(4);
        expect(face.right, label).toBeLessThanOrEqual(band.width - 4);
        expect(face.bottom, label).toBeLessThanOrEqual(band.height - 4);
        const controls = controlsAt(viewport, band)!;
        const overlaps = face.left < controls.right && face.right > controls.left && face.bottom > controls.top - 4 && face.top < controls.bottom;
        expect(overlaps, `${label}: the controls are at ${JSON.stringify(controls)}`).toBe(false);
      }
    });

    it(`${name}: the whole face is inside the band and right of its slanted edge, from 1024 to 1920 px`, () => {
      for (const [viewport, screenHeight] of WIDE) {
        const band = bandAt(viewport, screenHeight);
        const face = faceInBand(name, band, photo.focusWide);
        const label = `${name} at ${viewport} px: face ${JSON.stringify(face)} in a band of ${band.width} x ${band.height}`;
        expect(face.left, label).toBeGreaterThanOrEqual(0.15 * band.width * (1 - face.top / band.height) + 4); // the cut-out edge is slanted
        expect(face.top, label).toBeGreaterThanOrEqual(4);
        expect(face.right, label).toBeLessThanOrEqual(band.width - 4);
        expect(face.bottom, label).toBeLessThanOrEqual(band.height - 4);
      }
    });

    it(`${name}: the focus points are percentages, "x% y%"`, () => {
      expect(photo.focus).toMatch(/^\d{1,3}% \d{1,3}%$/);
      expect(photo.focusWide).toMatch(/^\d{1,3}% \d{1,3}%$/);
    });
  }
});

describe("the files", () => {
  it("exist: 800 x 533 under 45 kB and 1600 x 1067 under 130 kB (the hero slides), 640 x 240 under 40 kB (SwiftRescue), at the size written in the config", () => {
    for (const photo of HERO_SLIDES) {
      expect(existsSync(fileOf(photo)), photo.src).toBe(true);
      expect(statSync(fileOf(photo)).size / KILOBYTE, photo.src).toBeLessThanOrEqual(45);
      expect(readWebpSize(fileOf(photo)), photo.src).toEqual({ width: 800, height: 533 });
      expect(photo).toMatchObject({ width: 800, height: 533, widthLarge: 1600 });
      const large = { src: photo.srcLarge };
      expect(existsSync(fileOf(large)), photo.srcLarge).toBe(true);
      expect(statSync(fileOf(large)).size / KILOBYTE, photo.srcLarge).toBeLessThanOrEqual(130);
      expect(readWebpSize(fileOf(large)), photo.srcLarge).toEqual({ width: 1600, height: 1067 });
    }
    for (const photo of emergency) {
      expect(existsSync(fileOf(photo)), photo.src).toBe(true);
      expect(statSync(fileOf(photo)).size / KILOBYTE, photo.src).toBeLessThanOrEqual(40);
      expect(readWebpSize(fileOf(photo)), photo.src).toEqual({ width: 640, height: 240 });
    }
  });

  it("are the only files of their folders: no leftover", () => {
    const expected = HERO_SLIDES.flatMap((photo) => [photo.src, photo.srcLarge]).map((src) => src.split("/").pop() ?? "");
    expect(readdirSync(join(PUBLIC, "images", "backdrop")).sort()).toEqual(expected.sort());
    expect(readdirSync(join(PUBLIC, "images", "emergency")).sort()).toEqual(["ambulance.webp", "fire.webp"]);
  });

  it("leave the stethoscope (hero3) and the owners' photo (hero4) exactly as they are on main: the same bytes, in the same folder", () => {
    const hashOf = (name: string) => createHash("sha256").update(readFileSync(join(PUBLIC, "images", "home", name))).digest("hex");

    expect(readdirSync(join(PUBLIC, "images", "home")).sort()).toEqual(["hero3-phone.webp", "hero3.webp", "hero4-portrait.webp"]);
    expect(hashOf("hero3.webp")).toBe("40dc4e72c84c1b9d9665bb6a2a10bd45220f1498971c80f945225cb520dc029b");
    expect(hashOf("hero3-phone.webp")).toBe("32de783f66adceb7b1681c224e6bafe7fc116e4cd2ae694e0ddd3ad765d81d0c");
    expect(hashOf("hero4-portrait.webp")).toBe("a275eac83d30d0f4c5f7b76e938be8b6d94933dfe5ccc6c48fd20bea58eece6f");
  });
});

describe("SwiftRescue photos", () => {
  it("each have honest alt text, a sentence, no medical claim and no cross", () => {
    for (const photo of emergency) {
      expect(photo.alt.length).toBeGreaterThan(30);
      expect(photo.alt.toLowerCase()).not.toMatch(/cross|cure|treat|diagnos/);
      expect(photo.alt).toMatch(/\.$/);
    }
  });
});
