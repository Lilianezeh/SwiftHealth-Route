/** Makes the PNG icons of the web app from the logo pin. Requirements: NFR-03 (installable). Tested by tests/unit/appIcons.test.ts.
 * Spec: specs/2026-10-17-swiftrescue/requirements.md, decision A9; specs/2026-11-02-installable-pwa/ (maskable and Apple icons).
 *
 * Run it in the frontend container:  node scripts/make-app-icons.mjs
 * It writes, in public/icons/: icon-192.png and icon-512.png (ordinary icons, the pin 60% of the height), icon-maskable-192.png and
 * icon-maskable-512.png (maskable icons: Android draws them in the shape of the phone's own icons and may cut the outer 10% on
 * every side, so the pin is only 50% of the height and keeps well inside the middle 80%), and, in src/app/, apple-icon.png (180 px,
 * the one iPhone uses for "Add to Home Screen"; a solid square with no transparency, because iPhone fills transparency with black
 * and rounds the corners itself).
 * The pin is the one of src/app/icon.svg (white pin with a sky line, as on the dark header), on the `forest` blue, centred. `sharp`
 * is the image library that Next.js installs for itself; it is not in package.json, and this script is not part of the app.
 */
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ICONS_FOLDER = fileURLToPath(new URL("../public/icons/", import.meta.url));
const APP_FOLDER = fileURLToPath(new URL("../src/app/", import.meta.url));
const FOREST = "#1b6f93"; // the `forest` token of src/styles/globals.css
const SKY = "#1a7cad"; // the `sky` token: the heartbeat line inside the white pin

function iconSvg(size, pinShare) {
  const pinHeight = size * pinShare;
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

async function write(file, size, pinShare, options = {}) {
  let image = sharp(Buffer.from(iconSvg(size, pinShare)));
  if (options.solid) image = image.flatten({ background: FOREST }).removeAlpha();
  await image.png({ compressionLevel: 9 }).toFile(file);
  console.log(`${file.split("/").slice(-2).join("/")} written`);
}

await mkdir(ICONS_FOLDER, { recursive: true });
for (const size of [192, 512]) {
  await write(`${ICONS_FOLDER}icon-${size}.png`, size, 0.6);
  await write(`${ICONS_FOLDER}icon-maskable-${size}.png`, size, 0.5);
}
await write(`${APP_FOLDER}apple-icon.png`, 180, 0.6, { solid: true });
