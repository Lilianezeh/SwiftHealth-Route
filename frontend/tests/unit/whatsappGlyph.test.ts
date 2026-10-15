/** The WhatsApp glyph file of the listing page's WhatsApp button. Requirements: FR-47, NFR-10. Spec: specs/2026-10-13-listing-page/requirements.md D2.
 * WhatsApp's brand rules (Meta Brand Resource Center, https://www.whatsappbrand.com/): only the official files, "you may not modify the WhatsApp
 * Brand Resources in any way", but they "may scale the size". The file is the owner's download (whatsapp.png, 2880 x 2880) made smaller with
 * `scripts/make-whatsapp-glyph.mjs`: a resize and nothing else. These tests check the result is still #25D366 (up to the tiny anti-aliasing at the
 * edges that any scaling gives) with its transparency, so it was not recoloured or flattened, and that the script does nothing but resize.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// sharp is the image library that Next.js installs for itself; it is not in package.json (the same as scripts/optimize-home-images.mjs).
type RawImage = { data: Buffer; info: { width: number; height: number; channels: number } };
type Sharp = (file: string) => { ensureAlpha(): { raw(): { toBuffer(options: { resolveWithObject: true }): Promise<RawImage> } } };
const sharp = createRequire(import.meta.url)("sharp") as Sharp;

const GLYPH = join(process.cwd(), "public", "images", "brand", "whatsapp-glyph-72.png");

const WHATSAPP_GREEN = [0x25, 0xd3, 0x66]; // #25D366, the one colour of the owner's file

async function pixels(): Promise<{
  width: number;
  height: number;
  exactGreen: number;
  farFromGreen: number;
  transparent: number;
  opaque: number;
}> {
  const { data, info } = await sharp(GLYPH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let exactGreen = 0;
  let farFromGreen = 0;
  let transparent = 0;
  let opaque = 0;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha === 0) transparent += 1;
    if (alpha === 255) {
      opaque += 1;
      const differences = WHATSAPP_GREEN.map((channel, offset) => Math.abs(data[index + offset] - channel));
      if (differences.every((difference) => difference === 0)) exactGreen += 1;
      // A normal high-quality resize (Lanczos) leaves tiny anti-aliasing differences along the edges: they are allowed.
      if (differences.some((difference) => difference > 24)) farFromGreen += 1;
    }
  }
  return { width: info.width, height: info.height, exactGreen, farFromGreen, transparent, opaque };
}

describe("public/images/brand/whatsapp-glyph-72.png", () => {
  it("is 72 x 72 px, shown at 24 px (so it is sharp on a 3x phone)", async () => {
    const { width, height } = await pixels();

    expect([width, height]).toEqual([72, 72]);
  });

  it("is still WhatsApp's own green, #25D366: most solid pixels are exactly that, and none is far from it (not recoloured)", async () => {
    const { exactGreen, farFromGreen, opaque } = await pixels();

    expect(opaque).toBeGreaterThan(500);
    expect(exactGreen / opaque).toBeGreaterThan(0.5); // the flat inside of the shape
    expect(farFromGreen / opaque).toBeLessThan(0.02); // only edge anti-aliasing may differ (a recoloured file would differ everywhere)
  });

  it("keeps its transparency: the handset and the corners are cut out, not painted white", async () => {
    const { transparent, opaque, width, height } = await pixels();

    expect(transparent).toBeGreaterThan(500);
    expect(transparent + opaque).toBeLessThanOrEqual(width * height);
  });

  it("is small: a few kilobytes", () => {
    expect(readFileSync(GLYPH).length).toBeLessThan(8_000);
  });
});

describe("scripts/make-whatsapp-glyph.mjs", () => {
  const script = readFileSync(join(process.cwd(), "scripts", "make-whatsapp-glyph.mjs"), "utf8");
  const code = script.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("only resizes: no recolouring, no sharpening, no flattening, no cropping, no other change", () => {
    expect(code).toMatch(/\.resize\(\s*72\s*,\s*72/);
    expect(code).not.toMatch(/tint|modulate|negate|greyscale|grayscale|recomb|sharpen|blur|flatten|extract|trim|composite|linear|gamma|threshold|removeAlpha|ensureAlpha/);
  });

  it("says where the original comes from and that a different file needs a different name (the files are cached for a year)", () => {
    expect(script).toMatch(/Meta/);
    expect(script).toMatch(/new file name/i);
  });
});
