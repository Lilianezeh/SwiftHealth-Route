/** Makes the WebP photos of the home page from the full-size originals. Requirements: US-13, NFR-01.
 * Specs: specs/2026-10-11-home-redesign/ (decisions 7, 8 and 19, and revisions R1, R8 and R9 of 2026-10-12: three files).
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

// One line per file: the original, the WebP to make, its fixed pixel size and its budget in kB. The page has two photos: the
// hero (the Unsplash photo hero3.jpg since the third revision, 2026-10-12), which also has a smaller version for phones, and the
// owner photo (hero4.jpg). `crop` is the part of the original to keep, in the original's pixels, before it is resized.
// - hero3 (4000 x 6016, portrait) is cut by hand to a square that keeps the head of the stethoscope and the whole gauge.
// - hero4 (4160 x 6240, portrait) is not cut at all: the owner wants the whole portrait photo, so only its size is reduced.
const HERO_CROP = { left: 0, top: 400, width: 4000, height: 4000 };
const JOBS = [
  { source: "hero3.jpg", target: "hero3.webp", width: 1200, height: 1200, budgetKb: 150, crop: HERO_CROP },
  // The same photo, smaller, for phones.
  { source: "hero3.jpg", target: "hero3-phone.webp", width: 640, height: 640, budgetKb: 50, crop: HERO_CROP },
  { source: "hero4.jpg", target: "hero4-portrait.webp", width: 800, height: 1200, budgetKb: 100 },
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
