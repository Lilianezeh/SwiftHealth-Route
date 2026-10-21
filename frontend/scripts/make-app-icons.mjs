/** Makes the PNG icons of the web app manifest from the logo pin. Requirements: NFR-03 (installable). Tested by tests/unit/appIcons.test.ts.
 * Spec: specs/2026-10-17-swiftrescue/requirements.md, decision A9.
 *
 * Run it in the frontend container:  node scripts/make-app-icons.mjs
 * The pin is the one of src/app/icon.svg (white pin with a sky line, as on the dark header), on the `forest` blue, centred and
 * 60% of the height, so it also fits inside a maskable icon's safe zone (the middle 80%). `sharp` is the image library that
 * Next.js installs for itself; it is not in package.json, and this script is not part of the app.
 */
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const TARGET_FOLDER = fileURLToPath(new URL("../public/icons/", import.meta.url));
const FOREST = "#1b6f93"; // the `forest` token of src/styles/globals.css
const SKY = "#1a7cad"; // the `sky` token: the heartbeat line inside the white pin
const SIZES = [192, 512];

function iconSvg(size) {
  const pinHeight = size * 0.6;
  const pinWidth = (pinHeight * 36) / 46; // the pin's viewBox is 36 x 46
  const left = (size - pinWidth) / 2;
  const top = (size - pinHeight) / 2;
  const scale = pinHeight / 46;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${FOREST}"/>
  <g transform="translate(${left} ${top}) scale(${scale})">
    <path fill="#ffffff" d="M18 45C10 35 2 26 2 17a16 16 0 0 1 32 0c0 9-8 18-16 28z"/>
    <path d="M7 18H12.5L15.2 11L19.4 25L22.3 18H29" fill="none" stroke="${SKY}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

await mkdir(TARGET_FOLDER, { recursive: true });
for (const size of SIZES) {
  const file = `${TARGET_FOLDER}icon-${size}.png`;
  await sharp(Buffer.from(iconSvg(size))).png({ compressionLevel: 9 }).toFile(file);
  console.log(`icon-${size}.png written`);
}
