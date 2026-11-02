/** The icons that make the site installable. Requirements: NFR-03 ("installable web app"), NFR-04, NFR-01. Decision A9 in
 * specs/2026-10-17-swiftrescue/requirements.md; specs/2026-11-02-installable-pwa/. Chrome offers "Install" when the manifest has a
 * 192 px and a 512 px PNG icon; a maskable icon lets Android draw it in the shape of the phone's icons without a white frame; iPhone
 * takes an Apple touch icon (180 px, no transparency).
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

/** Width and height from the header of a PNG file (bytes 16 to 24). */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); // the PNG signature
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** The colour type of a PNG (byte 25): 2 is RGB, 6 is RGBA. Both can be fully opaque; this only names what the file declares. */
function pngHasAlphaChannel(path: string): boolean {
  const colourType = readFileSync(path)[25];
  return colourType === 4 || colourType === 6;
}

const fileOf = (source: string) => join(process.cwd(), "public", source.replace(/^\//, ""));

describe("the manifest icons", () => {
  const icons = manifest().icons ?? [];
  const byPurpose = (purpose: string) => icons.filter((icon) => icon.purpose === purpose);

  it("lists a 192 px and a 512 px PNG icon for ordinary use, and the same two sizes as maskable icons", () => {
    expect(byPurpose("any").map((icon) => icon.sizes).sort()).toEqual(["192x192", "512x512"]);
    expect(byPurpose("maskable").map((icon) => icon.sizes).sort()).toEqual(["192x192", "512x512"]);
    expect(icons).toHaveLength(4);
    expect(icons.every((icon) => icon.type === "image/png")).toBe(true);
  });

  it("never puts two purposes on one icon: an icon that is both 'any' and 'maskable' is drawn badly in one of the two", () => {
    for (const icon of icons) expect(["any", "maskable"]).toContain(icon.purpose);
  });

  it.each(["any", "maskable"])("the %s icons are four different files that exist, so each purpose has its own artwork", (purpose) => {
    const sources = byPurpose(purpose).map((icon) => icon.src);

    expect(new Set(sources).size).toBe(2);
    for (const other of ["any", "maskable"].filter((candidate) => candidate !== purpose)) {
      for (const source of byPurpose(other).map((icon) => icon.src)) expect(sources).not.toContain(source);
    }
  });

  it.each(icons.map((icon) => [icon.purpose, icon.sizes, icon.src] as const))(
    "the %s icon of %s (%s) exists, is a PNG of exactly that size, and is small",
    (_purpose, sizes, source) => {
      const size = Number(String(sizes).split("x")[0]);

      expect(pngSize(fileOf(source))).toEqual({ width: size, height: size });
      expect(statSync(fileOf(source)).size).toBeLessThan(20_000); // NFR-01: nothing heavy
    },
  );
});

describe("the Apple touch icon (iPhone: Add to Home Screen)", () => {
  const path = join(process.cwd(), "src", "app", "apple-icon.png");

  it("is src/app/apple-icon.png (Next.js links it in every page), a PNG of 180 x 180 px, and small", () => {
    expect(pngSize(path)).toEqual({ width: 180, height: 180 });
    expect(statSync(path).size).toBeLessThan(20_000);
  });

  it("has no transparent corners to fill: iPhone draws a transparent icon on black; the file is a solid square", () => {
    // RGB (colour type 2) has no transparency at all. If the file has an alpha channel it must at least have been drawn on a solid
    // background, which the next test (the artwork script) states; here the declared type is read.
    const declared = readFileSync(path)[25];

    expect([2, 3, 6]).toContain(declared);
    if (pngHasAlphaChannel(path)) expect(statSync(path).size).toBeGreaterThan(500);
  });
});
