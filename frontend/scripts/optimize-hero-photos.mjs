/** Makes the WebP photos of the home page sections and of SwiftRescue from the owner's full-size Magnific originals.
 * Requirements: US-13, US-04, NFR-01 (light for 3G), NFR-13 (credits). Spec: specs/2026-10-22-home-photos/requirements.md (the photos table);
 * tested by tests/unit/sectionPhotos.test.ts (sizes in kilobytes and in pixels, one file per config entry, nothing else in the folders).
 *
 * Run it in the frontend folder:   node scripts/optimize-hero-photos.mjs             (everything)
 *                                  node scripts/optimize-hero-photos.mjs sections    (only the home page sections)
 *                                  node scripts/optimize-hero-photos.mjs emergency   (only the SwiftRescue photos)
 * It reads the JPG originals from frontend/source-photos/ (not committed: the folder is in .gitignore, and nothing in it is served) and
 * writes the WebP files to frontend/public/images/sections/ (one 800 px file of each photo, the owner's answer 5) and
 * frontend/public/images/emergency/.
 * Every crop is written by hand below, in the pixels of the upright photo (rotate() applies the camera's turn first), after looking at the
 * photo: faces and the main object stay in the crop, and the crop of `hero3` stops above the blood pressure gauge, whose dial carries a
 * logo. Each file is saved at the highest quality that keeps it under its budget.
 * A NEW photo needs a NEW file name (change it here and in src/config/sectionPhotos.ts): netlify.toml caches /images/* for a year
 * ("immutable"), so a file replaced under the same name would stay in visitors' caches. `sharp` is the image library that Next.js
 * installs for itself; it is not in package.json, and this script is not part of the app.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SOURCE_FOLDER = fileURLToPath(new URL("../source-photos/", import.meta.url));
const SECTIONS_FOLDER = fileURLToPath(new URL("../public/images/sections/", import.meta.url));
const EMERGENCY_FOLDER = fileURLToPath(new URL("../public/images/emergency/", import.meta.url));
const KILOBYTE = 1000; // the same "kB" as tests/unit/sectionPhotos.test.ts

const SECTION = { width: 800, height: 533, budgetKb: 50 }; // 3:2 (533 = 800 / 1.5, rounded)
const GROUP = { width: 640, height: 240, budgetKb: 40 }; // the small header image of a SwiftRescue group: 8:3
const FIRST_QUALITY = 78;
const LOWEST_QUALITY = 30;
const QUALITY_STEP = 3;

// One entry per photo of the home page sections. `crop` is [left, top, width, height] in the upright original, 3:2. Notes say what it keeps.
const SECTION_PHOTOS = [
  // hero (5616 x 3744): already 3:2; the blue capsules at the left and the stethoscope at the right.
  { source: "hero.jpg", name: "stethoscope-capsules", crop: [0, 0, 5616, 3744] },
  // hero2 (4256 x 2832): already 3:2; the two pharmacists at the screen.
  { source: "hero2.jpg", name: "pharmacists-screen", crop: [0, 0, 4256, 2832] },
  // hero3 (4000 x 6016, a portrait): ONLY the top, the steel stethoscope on linen. The crop ends at y = 2667, above y = 2830 where the gauge starts.
  { source: "hero3.jpg", name: "stethoscope", crop: [0, 0, 4000, 2667] },
  // clinic (6354 x 4539): the nurse at the left, from above her head.
  { source: "clinic.jpg", name: "nurse-corridor", crop: [0, 100, 6354, 4236] },
  // pharmacy (4608 x 2304, 2:1): the pharmacist's face and coat, the customer's shoulder at the left, centred on her face (x about 2490).
  { source: "pharmacy.jpg", name: "pharmacist-customer", crop: [760, 0, 3456, 2304] },
  // laboratory (6000 x 4000): already 3:2; the woman at the left and the microscope.
  { source: "laboratory.jpg", name: "laboratory", crop: [0, 0, 6000, 4000] },
  // maternity (6144 x 3456, 16:9): the doctor and the patient's shoulder.
  { source: "maternity.jpg", name: "consultation", crop: [500, 0, 5184, 3456] },
  // owner (4256 x 2832): already 3:2; the smiling pharmacist at the right of the picture and the shelves.
  { source: "owner.jpg", name: "pharmacy-counter", crop: [0, 0, 4256, 2832] },
];

// The two SwiftRescue photos, 8:3 crops. ambulance (4256 x 2832): the health worker and the open ambulance. fire (5637 x 3758): the helmet and the hoses.
const GROUPS = [
  { source: "ambulance.jpg", name: "ambulance", crop: [0, 330, 4256, 1596] },
  { source: "fire.jpg", name: "fire", crop: [1500, 400, 4137, 1551] },
];

async function makeOne(upright, crop, size, folder, target) {
  const [left, top, width, height] = crop;
  const pixels = await sharp(upright).extract({ left, top, width, height }).resize(size.width, size.height, { fit: "fill" }).toBuffer();
  for (let quality = FIRST_QUALITY; quality >= LOWEST_QUALITY; quality -= QUALITY_STEP) {
    const output = await sharp(pixels).webp({ quality, effort: 6 }).toBuffer();
    if (output.length <= size.budgetKb * KILOBYTE) {
      await writeFile(`${folder}${target}`, output); // the very bytes that were measured, not encoded a second time
      return { target, quality, kilobytes: Number((output.length / KILOBYTE).toFixed(1)) };
    }
  }
  throw new Error(`${target} cannot be made smaller than ${size.budgetKb} kB, even at quality ${LOWEST_QUALITY}`);
}

async function upright(source) {
  return sharp(`${SOURCE_FOLDER}${source}`).rotate().toBuffer();
}

const which = process.argv[2] ?? "all";
const made = [];

if (which === "all" || which === "sections") {
  await mkdir(SECTIONS_FOLDER, { recursive: true });
  for (const photo of SECTION_PHOTOS) {
    made.push(await makeOne(await upright(photo.source), photo.crop, SECTION, SECTIONS_FOLDER, `${photo.name}-${SECTION.width}.webp`));
  }
}
if (which === "all" || which === "emergency") {
  await mkdir(EMERGENCY_FOLDER, { recursive: true });
  for (const group of GROUPS) {
    made.push(await makeOne(await upright(group.source), group.crop, GROUP, EMERGENCY_FOLDER, `${group.name}.webp`));
  }
}
for (const item of made) console.log(`${item.target}  quality ${item.quality}  ${item.kilobytes} kB`);
