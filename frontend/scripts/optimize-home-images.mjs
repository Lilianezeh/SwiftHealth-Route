/** Makes the WebP photos of the home page from the full-size originals. Requirements: US-13, NFR-01.
 * Specs: specs/2026-10-11-home-redesign/ (decisions 7, 8 and 19).
 *
 * Run it in the frontend container:  node scripts/optimize-home-images.mjs
 * It reads the JPG originals from frontend/image-sources/ (not committed, about 60 MB) and writes the WebP files to
 * frontend/public/images/home/. Each photo is cut to its fixed size ("cover": the whole frame is filled, the rest is cropped),
 * then saved at the highest quality that keeps the file under its budget. `sharp` is the image library that Next.js installs
 * for itself; it is not in package.json, and this script is not part of the app.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SOURCE_FOLDER = fileURLToPath(new URL("../image-sources/", import.meta.url));
const TARGET_FOLDER = fileURLToPath(new URL("../public/images/home/", import.meta.url));
const KILOBYTE = 1000; // the same "kB" as tests/unit/homeImages.test.ts

const FIRST_QUALITY = 80;
const LOWEST_QUALITY = 30;
const QUALITY_STEP = 3;

// One line per file: the original, the WebP to make, its fixed pixel size and its budget in kB. `crop` (optional) is the part
// of the original to keep, in the original's pixels, before it is resized: the automatic crop cut a face off the portrait
// photo of the hospital card, so that one is cut by hand (a 4:3 band holding both faces).
const JOBS = [
  { source: "hero.jpg", target: "hero.webp", width: 1280, height: 853, budgetKb: 150 },
  { source: "hero.jpg", target: "hero-phone.webp", width: 640, height: 427, budgetKb: 50 }, // the same photo, for phones
  { source: "hero2.jpg", target: "hero2.webp", width: 960, height: 640, budgetKb: 150 },
  {
    source: "hospital.jpg",
    target: "hospital.webp",
    width: 640,
    height: 480,
    budgetKb: 60,
    crop: { left: 0, top: 225, width: 2160, height: 1620 },
  },
  { source: "clinic.jpg", target: "clinic.webp", width: 640, height: 480, budgetKb: 60 },
  { source: "maternity.jpg", target: "maternity.webp", width: 640, height: 480, budgetKb: 60 },
  { source: "pharmacy.jpg", target: "pharmacy.webp", width: 640, height: 480, budgetKb: 60 },
  { source: "laboratory.jpg", target: "laboratory.webp", width: 640, height: 480, budgetKb: 60 },
  { source: "ambulance.jpg", target: "ambulance.webp", width: 640, height: 427, budgetKb: 60 },
  { source: "fire.jpg", target: "fire.webp", width: 640, height: 427, budgetKb: 60 },
  { source: "owner.jpg", target: "owner.webp", width: 800, height: 533, budgetKb: 80 },
];

async function makeOne({ source, target, width, height, budgetKb, crop }) {
  // rotate() applies the camera's orientation. A hand-made crop, if there is one, is cut first (from the rotated photo);
  // attention keeps the most interesting part when the shape still has to be cropped.
  const upright = await sharp(`${SOURCE_FOLDER}${source}`).rotate().toBuffer();
  const part = crop ? await sharp(upright).extract(crop).toBuffer() : upright;
  const resizedPixels = await sharp(part)
    .resize(width, height, { fit: "cover", position: sharp.strategy.attention })
    .toBuffer();

  for (let quality = FIRST_QUALITY; quality >= LOWEST_QUALITY; quality -= QUALITY_STEP) {
    const output = await sharp(resizedPixels).webp({ quality, effort: 6 }).toBuffer();
    if (output.length <= budgetKb * KILOBYTE) {
      await writeFile(`${TARGET_FOLDER}${target}`, output); // the very bytes that were measured, not encoded a second time
      return { target, width, height, quality, kilobytes: output.length / KILOBYTE, budgetKb };
    }
  }
  throw new Error(`${target} cannot be made smaller than ${budgetKb} kB, even at quality ${LOWEST_QUALITY}`);
}

await mkdir(TARGET_FOLDER, { recursive: true });
for (const job of JOBS) await stat(`${SOURCE_FOLDER}${job.source}`); // stops with a clear error if an original is missing

for (const job of JOBS) {
  const made = await makeOne(job);
  console.log(
    `${made.target.padEnd(18)} ${made.width}x${made.height}  quality ${made.quality}  ` +
      `${made.kilobytes.toFixed(1).padStart(6)} kB  (budget ${made.budgetKb} kB)`,
  );
}
