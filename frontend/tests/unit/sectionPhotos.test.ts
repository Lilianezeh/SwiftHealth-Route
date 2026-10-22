/** The photos of the home page sections and of SwiftRescue. Requirements: US-13, US-04, NFR-01 (light for 3G), NFR-10 (honest alt text),
 * NFR-13 (credit). Spec: specs/2026-10-22-home-photos/requirements.md (the photos table and the owner's answers: one 800 px file per photo).
 * Every photo has one WebP file at the real pixel size written in the config, under its budget; nothing else is in the folders; no original is served.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EMERGENCY_PHOTOS, MAGNIFIC_CREDIT, SECTION_PHOTOS, SECTION_PHOTO_SIZE, type SitePhoto } from "@/config/sectionPhotos";

import { readWebpSize } from "../helpers/webp";

const KILOBYTE = 1000;
const PUBLIC = join(process.cwd(), "public");

const sectionPhotos = Object.entries(SECTION_PHOTOS) as [string, SitePhoto][];
const emergencyPhotos = Object.entries(EMERGENCY_PHOTOS) as [string, SitePhoto][];
const everyPhoto = [...sectionPhotos, ...emergencyPhotos];

function fileOf(photo: SitePhoto): string {
  return join(PUBLIC, photo.src);
}

describe("the photos in the config", () => {
  it("are the owner's ten: eight in the home sections and ambulance and fire for SwiftRescue", () => {
    expect(sectionPhotos.map(([, photo]) => photo.src.split("/").pop())).toEqual([
      "stethoscope-capsules-800.webp", // hero: Overview
      "pharmacists-screen-800.webp", // hero2: How we verify
      "stethoscope-800.webp", // hero3, top crop: How we verify
      "nurse-corridor-800.webp", // clinic: Find by type
      "pharmacist-customer-800.webp", // pharmacy: Find by type
      "laboratory-800.webp", // laboratory: Find by type
      "consultation-800.webp", // maternity: Find by type
      "pharmacy-counter-800.webp", // owner: For facility owners
    ]);
    expect(emergencyPhotos.map(([, photo]) => photo.src)).toEqual(["/images/emergency/ambulance.webp", "/images/emergency/fire.webp"]);
  });

  it("have none of the four photos the owner left out: pharmacy6, hero4, hospital and owner2", () => {
    const text = JSON.stringify([SECTION_PHOTOS, EMERGENCY_PHOTOS]);
    for (const left of ["pharmacy6", "hero4", "hospital", "owner2", "wheelchair"]) expect(text).not.toContain(left);
  });

  it("each have a sentence of alt text written after looking at the file: no 'image of', no city, no medical claim", () => {
    for (const [name, photo] of everyPhoto) {
      expect(photo.alt.length, name).toBeGreaterThan(30);
      expect(photo.alt, name).toMatch(/\.$/);
      expect(photo.alt, name).not.toMatch(/^(an? )?(image|photo|picture) of/i);
      expect(photo.alt.toLowerCase(), name).not.toMatch(/enugu|nigeria|lagos|cure|treat|diagnos/);
    }
    expect(new Set(everyPhoto.map(([, photo]) => photo.alt)).size).toBe(everyPhoto.length);
  });

  it("say what is really in the maternity photo: two masked people in a talk, not a maternity scene", () => {
    expect(SECTION_PHOTOS.maternity.alt).toBe("A doctor in a white coat and a face mask speaks with a patient, who also wears a mask.");
    expect(SECTION_PHOTOS.maternity.alt.toLowerCase()).not.toMatch(/matern|pregnan|baby|birth/);
  });

  it("have one credit: 'Designed by Magnific' to www.magnific.com, and no credit per photo", () => {
    expect(MAGNIFIC_CREDIT).toEqual({ text: "Designed by Magnific", href: "https://www.magnific.com" });
    for (const [name, photo] of everyPhoto) expect(Object.keys(photo), name).not.toContain("credit");
  });
});

describe("the files", () => {
  it("exist as .webp files in public/images/sections and public/images/emergency", () => {
    for (const [name, photo] of sectionPhotos) {
      expect(photo.src, name).toMatch(/^\/images\/sections\/[a-z-]+-800\.webp$/);
      expect(existsSync(fileOf(photo)), photo.src).toBe(true);
    }
    for (const [name, photo] of emergencyPhotos) {
      expect(photo.src, name).toMatch(/^\/images\/emergency\/[a-z]+\.webp$/);
      expect(existsSync(fileOf(photo)), photo.src).toBe(true);
    }
  });

  it("are the only files of their folders: no original, no leftover, and the old slider folder is gone", () => {
    const listed = (folder: string) => everyPhoto.filter(([, photo]) => photo.src.startsWith(`/images/${folder}/`)).map(([, photo]) => photo.src.split("/").pop()).sort();

    expect(readdirSync(join(PUBLIC, "images", "sections")).sort()).toEqual(listed("sections"));
    expect(readdirSync(join(PUBLIC, "images", "emergency")).sort()).toEqual(listed("emergency"));
    expect(existsSync(join(PUBLIC, "images", "hero"))).toBe(false);
  });

  it("are under their budget: 50 kB for a section photo and 40 kB for a SwiftRescue photo", () => {
    for (const [name, photo] of sectionPhotos) expect(statSync(fileOf(photo)).size / KILOBYTE, name).toBeLessThanOrEqual(50);
    for (const [name, photo] of emergencyPhotos) expect(statSync(fileOf(photo)).size / KILOBYTE, name).toBeLessThanOrEqual(40);
  });

  it("have the real pixel size written in the config: 800 x 533 (3:2) and 640 x 240 (8:3)", () => {
    expect(SECTION_PHOTO_SIZE).toEqual({ width: 800, height: 533 });
    for (const [name, photo] of sectionPhotos) expect(photo, name).toMatchObject({ width: 800, height: 533 });
    for (const [name, photo] of emergencyPhotos) expect(photo, name).toMatchObject({ width: 640, height: 240 });
    for (const [name, photo] of everyPhoto) {
      expect(readWebpSize(fileOf(photo)), name).toEqual({ width: photo.width, height: photo.height });
    }
  });
});

describe("the originals", () => {
  it("stay out of the repository: source-photos/ is ignored and no JPG or PNG photo is in public/", () => {
    const ignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(ignore).toMatch(/^source-photos\/$/m);
    expect(existsSync(join(PUBLIC, "images", "sections", "hero.jpg"))).toBe(false);
  });
});
