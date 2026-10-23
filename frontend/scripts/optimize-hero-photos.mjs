/** Makes the WebP photos of the "Find by type" background slideshow and of SwiftRescue from the owner's full-size Magnific originals.
 * Requirements: US-13, US-04, NFR-01 (light for 3G), NFR-13 (credits). Spec: specs/2026-10-22-home-photos/requirements.md (revision 4);
 * tested by tests/unit/backdropPhotos.test.ts (sizes in kilobytes and in pixels, one file per config entry, nothing else in the folders).
 *
 * Run it in the frontend folder:   node scripts/optimize-hero-photos.mjs             (everything)
 *                                  node scripts/optimize-hero-photos.mjs backdrop    (only the slideshow)
 *                                  node scripts/optimize-hero-photos.mjs emergency   (only the SwiftRescue photos)
 * It reads the JPG originals from frontend/source-photos/ (not committed: the folder is in .gitignore, and nothing in it is served) and
 * writes the WebP files to frontend/public/images/backdrop/ and frontend/public/images/emergency/. (The hero and the owners' photos are made by
 * scripts/optimize-home-images.mjs and are not touched by this one.)
 * Every crop is written by hand below, in the pixels of the upright photo (rotate() applies the camera's turn first), after looking at the
 * photo: faces and the main object stay in the crop. Each file is saved at the highest quality that keeps it under its budget.
 * A NEW photo needs a NEW file name (change it here and in src/config/sitePhotos.ts): netlify.toml caches /images/* for a year
 * ("immutable"), so a file replaced under the same name would stay in visitors' caches. `sharp` is the image library that Next.js
 * installs for itself; it is not in package.json, and this script is not part of the app.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SOURCE_FOLDER = fileURLToPath(new URL("../source-photos/", import.meta.url));
const BACKDROP_FOLDER = fileURLToPath(new URL("../public/images/backdrop/", import.meta.url));
const EMERGENCY_FOLDER = fileURLToPath(new URL("../public/images/emergency/", import.meta.url));
const KILOBYTE = 1000; // the same "kB" as tests/unit/backdropPhotos.test.ts

// 3:2, two sizes of each slideshow photo (revision 6): 800 px for phones and tablets, 1600 px for wide screens (srcset/sizes in BackdropSlideshow).
const BACKDROP_SMALL = { width: 800, height: 533, budgetKb: 45 };
const BACKDROP_LARGE = { width: 1600, height: 1067, budgetKb: 130 };
const GROUP = { width: 640, height: 240, budgetKb: 40 }; // the small header image of a SwiftRescue group: 8:3
const FIRST_QUALITY = 78;
const LOWEST_QUALITY = 30;
const QUALITY_STEP = 3;

// The five photos of the slideshow, in the owner's order. `crop` is [left, top, width, height] in the upright original, 3:2.
const BACKDROP_PHOTOS = [
  // clinic (6354 x 4539): the nurse at the left, from above her head.
  { source: "clinic.jpg", name: "nurse-corridor", crop: [0, 100, 6354, 4236] },
  // hospital (2160 x 3840, a portrait): the patient's face and the doctor's coat; from y = 1000 (just below the doctor's chin) so that only the
  // patient's face is in the frame, high in it, with room under it (the doctor's face cannot fit a 3:2 frame together with the patient's).
  { source: "hospital.jpg", name: "doctor-and-patient", crop: [0, 1000, 2160, 1440] },
  // maternity (6144 x 3456, 16:9): the doctor and the patient's shoulder.
  { source: "maternity.jpg", name: "consultation", crop: [500, 0, 5184, 3456] },
  // laboratory (6000 x 4000): already 3:2; the woman at the left and the microscope.
  { source: "laboratory.jpg", name: "laboratory", crop: [0, 0, 6000, 4000] },
  // pharmacy (4608 x 2304, 2:1): the pharmacist's face and coat, the customer's shoulder at the left, centred on her face (x about 2490).
  { source: "pharmacy.jpg", name: "pharmacist-customer", crop: [760, 0, 3456, 2304] },
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

if (which === "all" || which === "backdrop") {
  await mkdir(BACKDROP_FOLDER, { recursive: true });
  for (const photo of BACKDROP_PHOTOS) {
    const photoPixels = await upright(photo.source);
    for (const size of [BACKDROP_SMALL, BACKDROP_LARGE]) {
      made.push(await makeOne(photoPixels, photo.crop, size, BACKDROP_FOLDER, `${photo.name}-${size.width}.webp`));
    }
  }
}
if (which === "all" || which === "emergency") {
  await mkdir(EMERGENCY_FOLDER, { recursive: true });
  for (const group of GROUPS) {
    made.push(await makeOne(await upright(group.source), group.crop, GROUP, EMERGENCY_FOLDER, `${group.name}.webp`));
  }
}
for (const item of made) console.log(`${item.target}  quality ${item.quality}  ${item.kilobytes} kB`);
