/** The photos of the "Find by type" background slideshow and of SwiftRescue, and the credit, in one file. Requirements: US-13, US-04, NFR-01, NFR-10,
 * NFR-13. Spec: specs/2026-10-22-home-photos/requirements.md (revision 4, 2026-10-23). The files are made by scripts/optimize-hero-photos.mjs from
 * the owner's Magnific originals and tested by tests/unit/backdropPhotos.test.ts (budgets, real pixel sizes, nothing else in the folders).
 * A replaced photo needs a NEW file name: /images/* is cached for a year (netlify.toml).
 *
 * The slideshow photos are decorative (faint, behind the cards), so they have no alt text. The two SwiftRescue photos have honest alt text,
 * written after looking at each converted file: one sentence, no medical claim, no city.
 */
type PhotoFile = { src: string; width: number; height: number };
/** `focus` is the CSS object-position of the photo on a narrow screen (under 768 px) and on a wide one: the point that stays in view when the
 * photo is cropped to fill the section, chosen after looking at each crop so that the face is whole (revision 5, 2026-10-23). */
export type BackdropPhoto = PhotoFile & { focus: { narrow: string; wide: string } };
export type SitePhoto = PhotoFile & { alt: string };

export const MAGNIFIC_CREDIT = { text: "Designed by Magnific", href: "https://www.magnific.com" } as const;

/** How strongly the slideshow photos show over the white section background (0 to 1): 45%, the owner's choice of 2026-10-23 from screenshots
 * of 35% and 45% (specs/2026-10-22-home-photos/, revision 5). Every text is on a white surface, so this passes WCAG AA. */
export const BACKDROP_STRENGTH = 0.45;

const BACKDROP_SIZE = { width: 960, height: 640 } as const; // 3:2

function backdrop(name: string, focus: BackdropPhoto["focus"]): BackdropPhoto {
  return { src: `/images/backdrop/${name}-${BACKDROP_SIZE.width}.webp`, ...BACKDROP_SIZE, focus };
}

/** The five photos of the slideshow, in the owner's order: clinic, hospital, maternity, laboratory, pharmacy. */
export const BACKDROP_PHOTOS: readonly BackdropPhoto[] = [
  backdrop("nurse-corridor", { narrow: "22% 0%", wide: "50% 10%" }), // clinic.jpg: the nurse's face at the left of the frame
  backdrop("doctor-and-patient", { narrow: "100% 50%", wide: "50% 35%" }), // hospital.jpg: the patient's face at the right
  backdrop("consultation", { narrow: "45% 30%", wide: "50% 8%" }), // maternity.jpg: the doctor's face, room above his head
  backdrop("laboratory", { narrow: "24% 30%", wide: "50% 15%" }), // laboratory.jpg: the woman's face and the tube in her hand
  backdrop("pharmacist-customer", { narrow: "54% 35%", wide: "50% 25%" }), // pharmacy.jpg: the pharmacist's face in the middle
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
