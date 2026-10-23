/** The photos of the "Find by type" background slideshow and of SwiftRescue, and the credit, in one file. Requirements: US-13, US-04, NFR-01, NFR-10,
 * NFR-13. Spec: specs/2026-10-22-home-photos/requirements.md (revision 4, 2026-10-23). The files are made by scripts/optimize-hero-photos.mjs from
 * the owner's Magnific originals and tested by tests/unit/backdropPhotos.test.ts (budgets, real pixel sizes, nothing else in the folders).
 * A replaced photo needs a NEW file name: /images/* is cached for a year (netlify.toml).
 *
 * The slideshow photos are decorative (faint, behind the cards), so they have no alt text. The two SwiftRescue photos have honest alt text,
 * written after looking at each converted file: one sentence, no medical claim, no city.
 */
export type BackdropPhoto = { src: string; width: number; height: number };
export type SitePhoto = BackdropPhoto & { alt: string };

export const MAGNIFIC_CREDIT = { text: "Designed by Magnific", href: "https://www.magnific.com" } as const;

const BACKDROP_SIZE = { width: 960, height: 640 } as const; // 3:2

function backdrop(name: string): BackdropPhoto {
  return { src: `/images/backdrop/${name}-${BACKDROP_SIZE.width}.webp`, ...BACKDROP_SIZE };
}

/** The five photos of the slideshow, in the owner's order: clinic, hospital, maternity, laboratory, pharmacy. */
export const BACKDROP_PHOTOS: readonly BackdropPhoto[] = [
  backdrop("nurse-corridor"), // clinic.jpg
  backdrop("doctor-and-patient"), // hospital.jpg
  backdrop("consultation"), // maternity.jpg
  backdrop("laboratory"), // laboratory.jpg
  backdrop("pharmacist-customer"), // pharmacy.jpg
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
