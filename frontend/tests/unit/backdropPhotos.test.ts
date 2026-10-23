/** The photos of the "Find by type" background slideshow and of SwiftRescue. Requirements: US-13, US-04, NFR-01 (light for 3G), NFR-13 (credit).
 * Spec: specs/2026-10-22-home-photos/requirements.md (revision 4, 2026-10-23). The slideshow has exactly five Magnific photos, in the owner's order
 * (clinic, hospital, maternity, laboratory, pharmacy), one 960 x 640 WebP each under 50 kB; the two SwiftRescue photos are 640 x 240 under 40 kB.
 * The hero and the owners' photos are exactly the files of `main`, in the same places.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BACKDROP_PHOTOS, BACKDROP_STRENGTH, EMERGENCY_PHOTOS, MAGNIFIC_CREDIT, type BackdropPhoto } from "@/config/sitePhotos";

import { readWebpSize } from "../helpers/webp";

const KILOBYTE = 1000;
const PUBLIC = join(process.cwd(), "public");

const fileOf = (photo: { src: string }) => join(PUBLIC, photo.src);
const emergency = Object.values(EMERGENCY_PHOTOS);

describe("the slideshow photos in the config", () => {
  it("are the owner's five, in the owner's order: clinic, hospital, maternity, laboratory, pharmacy", () => {
    expect(BACKDROP_PHOTOS.map((photo) => photo.src)).toEqual([
      "/images/backdrop/nurse-corridor-800.webp", // clinic
      "/images/backdrop/doctor-and-patient-800.webp", // hospital
      "/images/backdrop/consultation-800.webp", // maternity
      "/images/backdrop/laboratory-800.webp", // laboratory
      "/images/backdrop/pharmacist-customer-800.webp", // pharmacy
    ]);
    expect(BACKDROP_PHOTOS.map((photo) => photo.srcLarge)).toEqual(BACKDROP_PHOTOS.map((photo) => photo.src.replace("-800.webp", "-1600.webp")));
  });

  it("have none of the photos the owner did not choose, and none of ambulance, fire, hero3 or hero4", () => {
    const text = JSON.stringify(BACKDROP_PHOTOS);
    for (const left of ["stethoscope", "pharmacists-screen", "pharmacy-counter", "owner", "pharmacy6", "hero", "ambulance", "fire"]) {
      expect(text, left).not.toContain(left);
    }
  });

  it("have a focus point for the wide screens, where a photo is cropped, chosen after looking at each crop so a face is whole (revision 6)", () => {
    // Under 1024 px each photo is shown whole in a 3:2 band, so nothing is cropped there. From 1024 px the photo fills the section (cover) and
    // is cut at the bottom: the point is 0% from the top, so that the faces, which are in the upper part of every photo, stay above the cards.
    expect(BACKDROP_PHOTOS.map((photo) => photo.focus)).toEqual(["50% 0%", "50% 0%", "50% 0%", "50% 0%", "50% 0%"]);
    for (const photo of BACKDROP_PHOTOS) expect(photo.focus, photo.src).toMatch(/^\d{1,3}% \d{1,3}%$/);
  });

  it("are shown at 45%: the owner's choice of 2026-10-23, from screenshots of 35% and 45%", () => {
    expect(BACKDROP_STRENGTH).toBe(0.45);
  });

  it("are decorative: no alt text in the config, nothing to read out", () => {
    for (const photo of BACKDROP_PHOTOS) expect(Object.keys(photo), photo.src).not.toContain("alt");
  });

  it("have one credit for the whole slideshow: 'Designed by Magnific' to www.magnific.com", () => {
    expect(MAGNIFIC_CREDIT).toEqual({ text: "Designed by Magnific", href: "https://www.magnific.com" });
  });
});

describe("the files", () => {
  it("exist: 800 x 533 under 45 kB and 1600 x 1067 under 130 kB (the slideshow), 640 x 240 under 40 kB (SwiftRescue), at the size written in the config", () => {
    for (const photo of BACKDROP_PHOTOS) {
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

  it("are the only files of their folders: no leftover, and the folders #44 first added are gone (sections, hero)", () => {
    const expected = BACKDROP_PHOTOS.flatMap((photo) => [photo.src, photo.srcLarge]).map((src) => src.split("/").pop() ?? "");
    expect(readdirSync(join(PUBLIC, "images", "backdrop")).sort()).toEqual(expected.sort());
    expect(readdirSync(join(PUBLIC, "images", "emergency")).sort()).toEqual(["ambulance.webp", "fire.webp"]);
    expect(existsSync(join(PUBLIC, "images", "sections"))).toBe(false);
    expect(existsSync(join(PUBLIC, "images", "hero"))).toBe(false);
  });

  it("leave the hero and the owners' photos exactly as they are on main: the same bytes, in the same folder", () => {
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
      expect(photo.alt).toMatch(/\.$/);
      expect(photo.alt.toLowerCase()).not.toMatch(/^(an? )?(image|photo|picture) of|cross|cure|treat|diagnos/);
    }
  });
});

describe("the originals", () => {
  it("stay out of the repository: source-photos/ is ignored and no JPG or PNG photo is in public/", () => {
    expect(readFileSync(join(process.cwd(), ".gitignore"), "utf8")).toMatch(/^source-photos\/$/m);
    expect(existsSync(join(PUBLIC, "images", "backdrop", "clinic.jpg"))).toBe(false);
  });
});
