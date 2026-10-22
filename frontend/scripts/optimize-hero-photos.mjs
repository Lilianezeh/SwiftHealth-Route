/** Makes the WebP photos of the home page slider and of SwiftRescue from the owner's full-size Magnific originals.
 * Requirements: US-13, NFR-01 (light for 3G), NFR-13 (credits). Spec: specs/2026-10-22-home-photos/requirements.md (the photos table);
 * tested by tests/unit/heroPhotos.test.ts (sizes in kilobytes and in pixels, one file per config entry, nothing else in the folders).
 *
 * Run it in the frontend folder:   node scripts/optimize-hero-photos.mjs            (everything)
 *                                  node scripts/optimize-hero-photos.mjs hero       (only the home slider)
 *                                  node scripts/optimize-hero-photos.mjs emergency  (only the SwiftRescue photos)
 * It reads the JPG originals from frontend/source-photos/ (not committed: the folder is in .gitignore, and nothing in it is served) and
 * writes the WebP files to frontend/public/images/hero/ (two sizes of each slide) and frontend/public/images/emergency/.
 * Every crop is written by hand below, in the pixels of the upright photo (rotate() applies the camera's turn first), after looking at
 * the photo: faces and the main object stay in the crop, and the crop of `hero3` stops above the blood pressure gauge, whose dial
 * carries a logo. Each file is saved at the highest quality that keeps it under its budget.
 * A NEW photo needs a NEW file name (change it here and in src/config/heroPhotos.ts): netlify.toml caches /images/* for a year
 * ("immutable"), so a file replaced under the same name would stay in visitors' caches. `sharp` is the image library that Next.js
 * installs for itself; it is not in package.json, and this script is not part of the app.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SOURCE_FOLDER = fileURLToPath(new URL("../source-photos/", import.meta.url));
const HERO_FOLDER = fileURLToPath(new URL("../public/images/hero/", import.meta.url));
const EMERGENCY_FOLDER = fileURLToPath(new URL("../public/images/emergency/", import.meta.url));
const KILOBYTE = 1000; // the same "kB" as tests/unit/heroPhotos.test.ts

const PHONE = { width: 640, height: 900, budgetKb: 40 }; // a tall hero band on a phone: portrait crops, so nothing is stretched
const WIDE = { width: 1280, height: 800, budgetKb: 100 }; // tablets and laptops: 16:10
const GROUP = { width: 640, height: 240, budgetKb: 40 }; // the small header image of a SwiftRescue group: 8:3
const FIRST_QUALITY = 78;
const LOWEST_QUALITY = 30;
const QUALITY_STEP = 3;

// One entry per slide, in the order of the slider. `wide` and `phone` are crops in the upright original (left, top, width, height);
// wide crops are 16:10 and phone crops 32:45 (640:900). Notes say what each crop keeps.
const SLIDES = [
  // laboratory (6000 x 4000): the woman at the left and the microscope; the phone crop is centred on her face.
  { source: "laboratory.jpg", name: "hero-laboratory", wide: [0, 125, 6000, 3750], phone: [1098, 0, 2844, 4000] },
  // pharmacy (4608 x 2304, 2:1): the pharmacist's face and coat, the customer's shoulder at the left; the phone crop is centred on her face.
  { source: "pharmacy.jpg", name: "hero-pharmacist", wide: [461, 0, 3686, 2304], phone: [1976, 0, 1024, 2304] },
  // hero (5616 x 3744): the blue capsules at the left and the stethoscope at the right; the phone crop keeps the capsules and the chest piece.
  { source: "hero.jpg", name: "hero-stethoscope-capsules", wide: [0, 117, 5616, 3510], phone: [1196, 0, 2662, 3744] },
  // hero3 (4000 x 6016, a portrait): ONLY the top, the steel stethoscope on linen. Both crops end above y = 2830, where the gauge starts.
  { source: "hero3.jpg", name: "hero-stethoscope", wide: [0, 0, 4000, 2500], phone: [0, 0, 1950, 2742] },
  // owner (4256 x 2832): the smiling pharmacist at the right of the picture and the shelves; the phone crop is centred on her.
  { source: "owner.jpg", name: "hero-pharmacy-counter", wide: [0, 60, 4256, 2660], phone: [1802, 0, 2014, 2832] },
  // maternity (6144 x 3456): the doctor and the patient's shoulder.
  { source: "maternity.jpg", name: "hero-consultation", wide: [307, 0, 5530, 3456], phone: [1659, 0, 2458, 3456] },
  // hero2 (4256 x 2832): the two pharmacists; the phone crop keeps both faces.
  { source: "hero2.jpg", name: "hero-pharmacists", wide: [0, 86, 4256, 2660], phone: [1334, 0, 2014, 2832] },
  // clinic (6354 x 4539): the nurse at the left, from above her head; the phone crop starts at the left edge.
  { source: "clinic.jpg", name: "hero-nurse", wide: [0, 100, 6354, 3971], phone: [0, 0, 3228, 4539] },
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

if (which === "all" || which === "hero") {
  await mkdir(HERO_FOLDER, { recursive: true });
  for (const slide of SLIDES) {
    const photo = await upright(slide.source);
    made.push(await makeOne(photo, slide.phone, PHONE, HERO_FOLDER, `${slide.name}-640.webp`));
    made.push(await makeOne(photo, slide.wide, WIDE, HERO_FOLDER, `${slide.name}-1280.webp`));
  }
}
if (which === "all" || which === "emergency") {
  await mkdir(EMERGENCY_FOLDER, { recursive: true });
  for (const group of GROUPS) {
    made.push(await makeOne(await upright(group.source), group.crop, GROUP, EMERGENCY_FOLDER, `${group.name}.webp`));
  }
}
for (const item of made) console.log(`${item.target}  quality ${item.quality}  ${item.kilobytes} kB`);
