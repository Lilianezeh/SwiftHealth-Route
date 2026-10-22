/** The photos of the home page sections and of SwiftRescue, and the credit, in one file. Requirements: US-13, US-04, NFR-01, NFR-10, NFR-13.
 * Spec: specs/2026-10-22-home-photos/requirements.md (the photos table, in the owner's words and answers). The files are made by
 * scripts/optimize-hero-photos.mjs from the owner's Magnific originals and tested by tests/unit/sectionPhotos.test.ts (budgets and real pixel
 * sizes). One file per photo (owner, 2026-10-22). A replaced photo needs a NEW file name: /images/* is cached for a year (netlify.toml).
 *
 * Alt text was written after looking at each converted file: one honest sentence, no medical claim, no city. The credit is one link, used once
 * in each section that shows Magnific photos (never over a photo, and never under `hero3`, which is from Unsplash).
 */
export type SitePhoto = {
  src: string; // a WebP of public/images/sections or public/images/emergency
  width: number; // pixels, fixed: the browser keeps the room for the photo before it has loaded
  height: number;
  alt: string;
};

export const SECTION_PHOTO_SIZE = { width: 800, height: 533 } as const; // 3:2
const EMERGENCY_PHOTO_SIZE = { width: 640, height: 240 } as const; // 8:3

export const MAGNIFIC_CREDIT = { text: "Designed by Magnific", href: "https://www.magnific.com" } as const;

function sectionPhoto(name: string, alt: string): SitePhoto {
  return { src: `/images/sections/${name}-${SECTION_PHOTO_SIZE.width}.webp`, ...SECTION_PHOTO_SIZE, alt };
}

function emergencyPhoto(name: string, alt: string): SitePhoto {
  return { src: `/images/emergency/${name}.webp`, ...EMERGENCY_PHOTO_SIZE, alt };
}

/** In the order of the home page. */
export const SECTION_PHOTOS = {
  overview: sectionPhoto("stethoscope-capsules", "A blue stethoscope and a blister pack of blue and white capsules on a clipboard."),
  verifyPharmacists: sectionPhoto(
    "pharmacists-screen",
    "Two pharmacists in front of shelves of medicines look at a computer screen, seen through a glass panel.",
  ),
  verifyStethoscope: sectionPhoto("stethoscope", "A steel stethoscope lying on white linen."),
  clinic: sectionPhoto("nurse-corridor", "A nurse in light blue scrubs, with a stethoscope and gloves, holds a clipboard in a bright clinic corridor."),
  pharmacy: sectionPhoto("pharmacist-customer", "A pharmacist in a white coat serves a customer at a counter in front of shelves of medicines."),
  laboratory: sectionPhoto(
    "laboratory",
    "A scientist in a white coat and blue gloves holds a small sample tube beside a microscope in a bright laboratory.",
  ),
  maternity: sectionPhoto("consultation", "A doctor in a white coat and a face mask speaks with a patient, who also wears a mask."),
  owners: sectionPhoto(
    "pharmacy-counter",
    "A smiling pharmacist in a white coat and a stethoscope sits at a pharmacy counter with a computer, with shelves of medicines behind.",
  ),
} as const satisfies Record<string, SitePhoto>;

/** The two small header images of the Ambulance and the Fire service groups (the same two files on the home page's SwiftRescue section). */
export const EMERGENCY_PHOTOS = {
  ambulance: emergencyPhoto("ambulance", "A health worker in a white coat and a face mask stands in front of an ambulance with its rear doors open."),
  fire: emergencyPhoto("fire", "A firefighter in a red helmet stands by a fire engine with hoses, with smoke in the air."),
} as const satisfies Record<string, SitePhoto>;
