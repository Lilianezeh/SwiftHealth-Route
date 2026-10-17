/** Makes the WebP banners of the type pages (clinic, laboratory, pharmacy) from the full-size originals. Requirements: US-13, NFR-01.
 * Spec: specs/2026-10-15-find-by-type/requirements.md D6 (the owner's answers of 2026-10-15); tested by tests/unit/typeBanners.test.ts.
 *
 * Run it in the frontend container:  node scripts/optimize-type-banners.mjs
 * It reads the JPG originals from frontend/image-sources/ (not committed: the folder is in .gitignore) and writes the WebP files to
 * frontend/public/images/types/. Each photo is cut by hand to 3:1 (`crop`, in the original's pixels, after the camera's turn is applied), made
 * 960 x 320, and saved at the highest quality that keeps the file under 40 kB.
 * A NEW photo needs a NEW file name (change `target` here and `src` in src/config/types.ts): netlify.toml caches /images/* for a year
 * ("immutable"), so a file that is replaced under the same name would stay in visitors' caches. hospital.jpg and maternity.jpg are not made:
 * they have no approved photo yet (owner, 2026-10-15). `sharp` is the image library that Next.js installs for itself; it is not in
 * package.json, and this script is not part of the app.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SOURCE_FOLDER = fileURLToPath(new URL("../image-sources/", import.meta.url));
const TARGET_FOLDER = fileURLToPath(new URL("../public/images/types/", import.meta.url));
const KILOBYTE = 1000; // the same "kB" as tests/unit/typeBanners.test.ts

const WIDTH = 960;
const HEIGHT = 320;
const BUDGET_KB = 40;
const FIRST_QUALITY = 80;
const LOWEST_QUALITY = 30;
const QUALITY_STEP = 3;

// One line per file. Every crop is 3:1 and keeps the person's face (all three photos show a health worker):
// - clinic (6354 x 4539): the full width, from just above the head.
// - laboratory (6000 x 4000): the full width, from the top of the head and the microscope to the gloves and the test tube.
// - pharmacy (4608 x 2304): the full width, from just above the head to the white coat.
const JOBS = [
  { source: "clinic.jpg", target: "banner-clinic-1.webp", crop: { left: 0, top: 80, width: 6354, height: 2118 } },
  { source: "laboratory.jpg", target: "banner-laboratory-1.webp", crop: { left: 0, top: 600, width: 6000, height: 2000 } },
  { source: "pharmacy.jpg", target: "banner-pharmacy-1.webp", crop: { left: 0, top: 40, width: 4608, height: 1536 } },
];

async function makeOne({ source, target, crop }) {
  // rotate() applies the camera's orientation first, so the crop is in the upright photo's pixels.
  const upright = await sharp(`${SOURCE_FOLDER}${source}`).rotate().toBuffer();
  const resizedPixels = await sharp(upright).extract(crop).resize(WIDTH, HEIGHT, { fit: "fill" }).toBuffer();

  for (let quality = FIRST_QUALITY; quality >= LOWEST_QUALITY; quality -= QUALITY_STEP) {
    const output = await sharp(resizedPixels).webp({ quality, effort: 6 }).toBuffer();
    if (output.length <= BUDGET_KB * KILOBYTE) {
      await writeFile(`${TARGET_FOLDER}${target}`, output); // the very bytes that were measured, not encoded a second time
      return { target, quality, kilobytes: output.length / KILOBYTE };
    }
  }
  throw new Error(`${target} cannot be made smaller than ${BUDGET_KB} kB, even at quality ${LOWEST_QUALITY}`);
}

await mkdir(TARGET_FOLDER, { recursive: true });
for (const job of JOBS) await stat(`${SOURCE_FOLDER}${job.source}`); // stops with a clear error if an original is missing

for (const job of JOBS) {
  const made = await makeOne(job);
  console.log(
    `${made.target.padEnd(26)} ${WIDTH}x${HEIGHT}  quality ${made.quality}  ${made.kilobytes.toFixed(1).padStart(6)} kB  (budget ${BUDGET_KB} kB)`,
  );
}
