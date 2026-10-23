/** The photos of the "Find by type" background slideshow and of SwiftRescue, and the credit, in one file. Requirements: US-13, US-04, NFR-01, NFR-10,
 * NFR-13. Spec: specs/2026-10-22-home-photos/requirements.md (revision 4, 2026-10-23). The files are made by scripts/optimize-hero-photos.mjs from
 * the owner's Magnific originals and tested by tests/unit/backdropPhotos.test.ts (budgets, real pixel sizes, nothing else in the folders).
 * A replaced photo needs a NEW file name: /images/* is cached for a year (netlify.toml).
 *
 * The slideshow photos are decorative (faint, behind the cards), so they have no alt text. The two SwiftRescue photos have honest alt text,
 * written after looking at each converted file: one sentence, no medical claim, no city.
 */
type PhotoFile = { src: string; width: number; height: number };
/** Each slideshow photo has two files of the same crop: `src` (800 px, for phones and tablets) and `srcLarge` (1600 px, for wide screens, used
 * through srcset and sizes). `focus` is the CSS object-position that is used from 1024 px, where the photo is cropped to fill the section: the
 * point that stays in view, chosen after looking at each crop so that the face is whole. Under 1024 px the photo is shown whole (its box is 3:2),
 * so nothing is cut (revision 6, 2026-10-23). */
export type BackdropPhoto = PhotoFile & { srcLarge: string; widthLarge: number; focus: string };
export type SitePhoto = PhotoFile & { alt: string };

export const MAGNIFIC_CREDIT = { text: "Designed by Magnific", href: "https://www.magnific.com" } as const;

/** How strongly the slideshow photos show over the white section background (0 to 1): 45%, the owner's choice of 2026-10-23 from screenshots
 * of 35% and 45% (specs/2026-10-22-home-photos/, revision 5). Every text is on a white surface, so this passes WCAG AA. */
export const BACKDROP_STRENGTH = 0.45;

const BACKDROP_SMALL = { width: 800, height: 533 } as const; // 3:2
const BACKDROP_LARGE_WIDTH = 1600;

function backdrop(name: string, focus: string): BackdropPhoto {
  return {
    src: `/images/backdrop/${name}-${BACKDROP_SMALL.width}.webp`,
    ...BACKDROP_SMALL,
    srcLarge: `/images/backdrop/${name}-${BACKDROP_LARGE_WIDTH}.webp`,
    widthLarge: BACKDROP_LARGE_WIDTH,
    focus,
  };
}

/** The five photos of the slideshow, in the owner's order: clinic, hospital, maternity, laboratory, pharmacy. */
export const BACKDROP_PHOTOS: readonly BackdropPhoto[] = [
  backdrop("nurse-corridor", "50% 0%"), // clinic.jpg: the nurse's face at the left of the frame, from the top
  backdrop("doctor-and-patient", "50% 0%"), // hospital.jpg: the patient's face, high in the frame
  backdrop("consultation", "50% 0%"), // maternity.jpg: the doctor's face, room above his head
  backdrop("laboratory", "50% 0%"), // laboratory.jpg: the woman's face and the tube in her hand
  backdrop("pharmacist-customer", "50% 0%"), // pharmacy.jpg: the pharmacist's face in the middle
];

/** The two small header images of the Ambulance and the Fire service groups on /emergency (and nowhere else). */
export const EMERGENCY_PHOTOS = {
  ambulance: {
    src: "/images/emergency/ambulance.webp",
    width: 640,
    height: 240,
    alt: "A health worker in a white coat and a face mask stands in front of an ambulance with its rear doors open.",
  },
  fire: {
    src: "/images/emergency/fire.webp",
    width: 640,
    height: 240,
    alt: "A firefighter in a red helmet stands by a fire engine with hoses, with smoke in the air.",
  },
} as const satisfies Record<string, SitePhoto>;
