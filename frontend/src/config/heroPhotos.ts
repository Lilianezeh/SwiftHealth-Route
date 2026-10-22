/** The eight photos of the home page slider, the timing and the credit, in one file. Requirements: US-13, NFR-01, NFR-10, NFR-13.
 * Spec: specs/2026-10-22-home-photos/requirements.md (the photos table, in the owner's order). The files are made by
 * scripts/optimize-hero-photos.mjs from the owner's Magnific originals and tested by tests/unit/heroPhotos.test.ts (budgets and real
 * pixel sizes). A phone gets the 640 px file, everyone else the 1280 px file. A replaced photo needs a NEW file name: /images/* is
 * cached for a year (netlify.toml).
 *
 * Alt text was written after looking at each converted photo: one honest sentence, no medical claim, no city. The short name is the
 * name of the slide's dot. The credit is one fixed link for the whole slider (owner, 2026-10-22), never one per slide.
 */
export type HeroSlide = {
  name: string; // the file name is hero-<name>-640.webp and hero-<name>-1280.webp
  shortName: string; // the dot's name: "Show photo 3 of 8: Stethoscope and capsules"
  alt: string;
  phoneSrc: string;
  wideSrc: string;
};

export const HERO_SIZES = {
  phone: { width: 640, height: 900, budgetKb: 40 },
  wide: { width: 1280, height: 800, budgetKb: 100 },
} as const;

export const HERO_SLIDE_SECONDS = 6; // how long each photo stays
export const HERO_FADE_MS = 1500; // the crossfade between two photos (the same number is in the class duration-[1500ms] of HeroSlider)

export const HERO_CREDIT = { text: "Designed by Magnific", href: "https://www.magnific.com" } as const;

function slide(name: string, shortName: string, alt: string): HeroSlide {
  return {
    name,
    shortName,
    alt,
    phoneSrc: `/images/hero/hero-${name}-${HERO_SIZES.phone.width}.webp`,
    wideSrc: `/images/hero/hero-${name}-${HERO_SIZES.wide.width}.webp`,
  };
}

export const HERO_SLIDES: readonly HeroSlide[] = [
  slide("laboratory", "Laboratory", "A scientist in a white coat and blue gloves holds a small sample tube beside a microscope in a bright laboratory."),
  slide("pharmacist", "Pharmacist", "A pharmacist in a white coat serves a customer at a counter in front of shelves of medicines."),
  slide("stethoscope-capsules", "Stethoscope and capsules", "A blue stethoscope and a blister pack of blue and white capsules on a clipboard."),
  slide("stethoscope", "Stethoscope", "A steel stethoscope lying on white linen."),
  slide(
    "pharmacy-counter",
    "Pharmacy counter",
    "A smiling pharmacist in a white coat and a stethoscope sits at a pharmacy counter with a computer, with shelves of medicines behind.",
  ),
  slide("consultation", "Consultation", "A doctor in a white coat and a face mask speaks with a patient, who also wears a mask."),
  slide("pharmacists", "Pharmacists", "Two pharmacists in front of shelves of medicines look at a computer screen, seen through a glass panel."),
  slide("nurse", "Nurse", "A nurse in light blue scrubs, with a stethoscope and gloves, holds a clipboard in a bright clinic corridor."),
];
