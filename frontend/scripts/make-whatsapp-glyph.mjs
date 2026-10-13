/** Makes the small copy of the WhatsApp glyph for the WhatsApp button of the listing page. Requirements: FR-47, NFR-10.
 * Spec: specs/2026-10-13-listing-page/requirements.md D2; tests/unit/whatsappGlyph.test.ts.
 *
 * The original is the owner's file `whatsapp.png` (2880 x 2880, one colour #25D366, transparent), which the owner downloaded from Meta's
 * brand resources site. WhatsApp's brand rules allow the official file to be scaled and nothing else: "you may not modify the WhatsApp Brand
 * Resources in any way" (https://www.whatsappbrand.com/). So this script does one thing, a resize; it does not recolour, sharpen, crop or flatten.
 * The original is not committed (it is 2880 px).
 *
 * Run it in the frontend container:  node scripts/make-whatsapp-glyph.mjs /path/to/whatsapp.png
 * It writes frontend/public/images/brand/whatsapp-glyph-72.png (72 x 72, shown at 24 px so it is sharp on a 3x phone). The files of
 * /images/* are cached for a year (netlify.toml): a different glyph needs a new file name, here and in the WhatsApp button.
 */
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const original = process.argv[2];
if (!original) {
  console.error("Usage: node scripts/make-whatsapp-glyph.mjs /path/to/whatsapp.png");
  process.exit(1);
}

const targetFolder = fileURLToPath(new URL("../public/images/brand/", import.meta.url));
await mkdir(targetFolder, { recursive: true });
const info = await sharp(original).resize(72, 72).png().toFile(`${targetFolder}whatsapp-glyph-72.png`);
console.log(`whatsapp-glyph-72.png  ${info.width}x${info.height}  ${(info.size / 1000).toFixed(1)} kB`);
