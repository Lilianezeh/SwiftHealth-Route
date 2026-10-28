/** The photos of the hero slideshow and of SwiftRescue, and the credit, in one file. Requirements: US-13, US-04, NFR-01, NFR-10, NFR-13.
 * Spec: specs/2026-10-28-hero-slideshow/requirements.md (before it: specs/2026-10-22-home-photos/, revision 4). The files are made by
 * scripts/optimize-hero-photos.mjs from the owner's Magnific originals and tested by tests/unit/heroSlides.test.ts (budgets, real pixel sizes,
 * nothing else in the folders, the focus points). A replaced photo needs a NEW file name: /images/* is cached for a year (netlify.toml).
 *
 * The first slide of the hero, the stethoscope, is in config/home.ts. Every photo has honest alt text, written after looking at each converted
 * file: one sentence, no medical claim, no city. The one credit for the Magnific photos is in the site footer (MAGNIFIC_CREDIT).
 */
type PhotoFile = { src: string; width: number; height: number };
/** Each hero slide has two files of the same crop: `src` (800 px, for phones up to 767 px) and `srcLarge` (1600 px, for wider screens, used through
 * srcset and sizes). The hero's band is cropped to fill (object-fit: cover), so each photo has two focus points, as CSS object-position values: `focus`
 * for the band under 1024 px (as wide as the screen and 256 or 288 px high: the sides are cropped on a phone, the top and bottom on a tablet) and
 * `focusWide` from 1024 px (the right half of the screen, as high as the section: the sides are cropped). They were worked out by
 * tests/unit/heroSlides.test.ts's maths for each face, so no face is cut at 320, 360, 768 and 1280 px, and none is under the controls. */
export type HeroSlide = PhotoFile & { srcLarge: string; widthLarge: number; alt: string; focus: string; focusWide: string };
export type SitePhoto = PhotoFile & { alt: string };

export const MAGNIFIC_CREDIT = { text: "Designed by Magnific", href: "https://www.magnific.com" } as const;

const SLIDE_SMALL = { width: 800, height: 533 } as const; // 3:2
const SLIDE_LARGE_WIDTH = 1600;

function slide(name: string, alt: string, focus: string, focusWide: string): HeroSlide {
  return {
    src: `/images/backdrop/${name}-${SLIDE_SMALL.width}.webp`,
    ...SLIDE_SMALL,
    srcLarge: `/images/backdrop/${name}-${SLIDE_LARGE_WIDTH}.webp`,
    widthLarge: SLIDE_LARGE_WIDTH,
    alt,
    focus,
    focusWide,
  };
}

/** The five photos that follow the stethoscope in the hero, in the owner's order: clinic, hospital, maternity, laboratory, pharmacy. The alt texts were
 * written after looking at each photo: one sentence, factual, no medical claim. */
export const HERO_SLIDES: readonly HeroSlide[] = [
  slide("nurse-corridor", "A nurse in light blue scrubs and gloves holds a clipboard in a hospital corridor.", "25% 7%", "10% 50%"),
  slide("doctor-and-patient", "A doctor in a white coat talks with a patient who is sitting up in a hospital bed.", "100% 17%", "98% 50%"),
  slide("consultation", "A doctor in a white coat and a face mask talks with a patient across a desk.", "50% 13%", "32% 50%"),
  slide("laboratory", "A laboratory worker in a white coat and blue gloves holds a test tube next to a microscope.", "50% 30%", "16% 50%"),
  slide("pharmacist-customer", "A pharmacist in a white coat serves a customer in front of shelves of medicines.", "50% 29%", "50% 50%"),
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
