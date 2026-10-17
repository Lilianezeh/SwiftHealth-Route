/** The five types of place the visitor can choose, in one file: the category slug, the chip label, the plural for the heading, and the
 * photo of the banner. Requirements: US-01, FR-05, NFR-10, NFR-13. Spec: specs/2026-10-15-find-by-type/requirements.md D2, D3 and D6.
 * The slugs are the category slugs of the seed, the same as the home tiles (config/home.ts) and the Find shortcuts (config/search.ts);
 * tests/unit/typeConfig.test.ts fails if they drift apart.
 *
 * The photos are the owner's Magnific downloads (owner's answers of 2026-10-15): clinic, laboratory and pharmacy are approved; hospital and
 * maternity have `photo: null` for now (a patient's face in the hospital photo, and a photo that is not a maternity scene), so those two types
 * get their heading and chip but no banner and no credit. Switching one on later is one new file (scripts/optimize-type-banners.mjs) and one
 * entry here. The credit lives in the photo entry too, so another source can replace Magnific later. A replaced photo needs a NEW file name:
 * /images/* is cached for a year (netlify.toml). The credit text and link are the ones the owner confirmed on Magnific's page (2026-10-15).
 */
export type TypeSlug = "hospital" | "clinic" | "maternity" | "pharmacy" | "laboratory";

export type PhotoCredit = { text: string; href: string };

export type TypePhoto = {
  src: string; // a WebP of public/images/types
  width: number; // pixels, fixed: the browser keeps the room for the photo before it has loaded
  height: number;
  alt: string;
  // The part that stays when the banner is cropped to about 140 px from 768 px (owner, 2026-10-17), as a CSS object-position: only the
  // vertical part matters (the picture is as wide as its place). All three faces are in the upper half, so the crop keeps the top.
  focus: string;
  approved: boolean; // only an approved photo is shown, with its credit
  credit: PhotoCredit | null; // shown next to the photo, only while the photo shows
};

export type TypeChoice = {
  slug: TypeSlug;
  chipLabel: string; // singular: "Pharmacy" in the chip "Pharmacy ✕"
  plural: string; // the heading "Pharmacies near you"
  photo: TypePhoto | null; // null: no photo yet, so no banner
};

const MAGNIFIC_CREDIT: PhotoCredit = { text: "Designed by Magnific", href: "https://www.magnific.com" };
const BANNER_SIZE = { width: 960, height: 320 } as const; // 3:1, about 40 kB or less

export const TYPE_CHOICES: readonly TypeChoice[] = [
  { slug: "hospital", chipLabel: "Hospital", plural: "Hospitals", photo: null },
  {
    slug: "clinic",
    chipLabel: "Clinic",
    plural: "Clinics",
    photo: {
      src: "/images/types/banner-clinic-1.webp",
      ...BANNER_SIZE,
      alt: "A nurse in light blue scrubs, with a stethoscope and a face mask pulled down, standing in a clinic corridor.",
      focus: "50% 40%",
      approved: true,
      credit: MAGNIFIC_CREDIT,
    },
  },
  { slug: "maternity", chipLabel: "Maternity", plural: "Maternity homes", photo: null },
  {
    slug: "pharmacy",
    chipLabel: "Pharmacy",
    plural: "Pharmacies",
    photo: {
      src: "/images/types/banner-pharmacy-1.webp",
      ...BANNER_SIZE,
      alt: "A pharmacist in a white coat speaking with a customer, with shelves of medicine boxes and bottles behind.",
      focus: "50% 35%",
      approved: true,
      credit: MAGNIFIC_CREDIT,
    },
  },
  {
    slug: "laboratory",
    chipLabel: "Laboratory",
    plural: "Laboratories",
    photo: {
      src: "/images/types/banner-laboratory-1.webp",
      ...BANNER_SIZE,
      alt: "A laboratory worker in a white coat and blue gloves holds a test tube beside a microscope.",
      focus: "50% 30%",
      approved: true,
      credit: MAGNIFIC_CREDIT,
    },
  },
];

/** The type of a category slug, or nothing for another category (an emergency one from a shared link) or no category. */
export function findTypeChoice(slug: string | undefined): TypeChoice | undefined {
  return TYPE_CHOICES.find((choice) => choice.slug === slug);
}

/** The photo to show as the banner of a category: only an approved photo of one of the five types, else nothing. */
export function bannerFor(slug: string | undefined): TypePhoto | undefined {
  const photo = findTypeChoice(slug)?.photo;
  return photo?.approved ? photo : undefined;
}
