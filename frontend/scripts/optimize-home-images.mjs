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
// hero, which also has a smaller version for phones, and the owner photo (the Unsplash photos hero4.jpg and owner2.jpg, which
// replaced the first ones on 2026-10-12; hero3.jpg is not used). `crop` is the part of the original to keep, in the original's
// pixels, before it is resized. Both originals are portrait, so each is cut by hand to a 4:3 band: hero4 (4160 x 6240) keeps
// the head and the blister pack, owner2 (2700 x 3779) keeps the head and the hands on the counter.
const HERO_CROP = { left: 0, top: 140, width: 4160, height: 3120 };
const OWNER_CROP = { left: 0, top: 40, width: 2700, height: 2025 };
const JOBS = [
  { source: "hero4.jpg", target: "hero4.webp", width: 1280, height: 960, budgetKb: 150, crop: HERO_CROP },
  // The same photo, smaller, for phones.
  { source: "hero4.jpg", target: "hero4-phone.webp", width: 640, height: 480, budgetKb: 50, crop: HERO_CROP },
  { source: "owner2.jpg", target: "owner2.webp", width: 800, height: 600, budgetKb: 80, crop: OWNER_CROP },
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
