/** The photos and the words of the home page. Requirements: US-13, NFR-01, NFR-10. UI spec 2.1 (the words are the owner's).
 * Specs: specs/2026-10-11-home-redesign/ (decisions 7, 8, 15 and 19, and revisions R1 to R17 of 2026-10-12). The page has two
 * photos, the hero (hero3.jpg) and the owner photo (hero4.jpg), both Unsplash photos, and a smaller version of the hero for
 * phones. The files are made by
 * scripts/optimize-home-images.mjs and tested by tests/unit/homeImages.test.ts, which checks that `width` and `height` are the
 * real pixel size of each file.
 *
 * Alt text was written after looking at each converted photo: short, factual, no medical claim. The owner reviews it on the
 * preview. No text of the home page names a city (R6): the first city stays in `siteConfig.launchCity` for other parts of the app.
 */
import { brand } from "@/config/brand";

export type HomePhoto = {
  src: string; // a file of public/images/home, WebP
  width: number; // pixels, fixed: the browser keeps the room for the photo before it has loaded
  height: number;
  alt: string;
};

const FOLDER = "/images/home";

export const HOME_PHOTOS = {
  // The hero: one photo, in two sizes. A phone gets the small one (specs, decision 19), so both say the same thing.
  hero: {
    src: `${FOLDER}/hero3.webp`,
    width: 1200,
    height: 1200,
    alt: "A stethoscope and a blood pressure gauge lying on white sheets.",
  },
  heroPhone: {
    src: `${FOLDER}/hero3-phone.webp`,
    width: 640,
    height: 640,
    alt: "A stethoscope and a blood pressure gauge lying on white sheets.",
  },
  // For facility owners: a portrait photo, shown whole.
  owner: {
    src: `${FOLDER}/hero4-portrait.webp`,
    width: 800,
    height: 1200,
    alt: "A smiling health worker in glasses and a white coat, with a stethoscope around the neck, holds up a blister pack of pills.",
  },
} as const satisfies Record<string, HomePhoto>;

/** The five tiles of "Find by type": the label and the category slug of the seed (the search address). The icons are
 * chosen in FindByType.tsx. */
export const HOME_CATEGORIES = [
  { label: "Hospital", slug: "hospital", description: "Admission, surgery and emergency care" },
  { label: "Clinic", slug: "clinic", description: "Check-ups and everyday treatment" },
  { label: "Maternity", slug: "maternity", description: "Antenatal care and childbirth" },
  { label: "Pharmacy", slug: "pharmacy", description: "Medicines and advice" },
  { label: "Laboratory", slug: "laboratory", description: "Tests and results" },
] as const;

/** The words of the page: the owner's, as agreed on 2026-10-15 (D7 of specs/2026-10-15-find-by-type/requirements.md). The app's name always
 * comes from config/brand.ts. No text names a city. The Overview says "call or get directions in one tap" on purpose: the WhatsApp
 * wording waits until real listings have WhatsApp numbers (owner, 2026-10-15). */
export const HOME_WORDS = {
  hero: {
    heading: "Find care that's open now, near you.",
    line: "Verified hospitals, clinics, pharmacies and labs, with phone numbers, opening hours and directions.",
    findCare: "Find care near me",
    note: "Free to use · No sign-up needed",
  },
  overview: {
    heading: `What is ${brand.name}?`,
    text: `${brand.name} is a healthcare directory built for Nigeria. Find hospitals, clinics, maternity homes, pharmacies and laboratories near you, see which are open right now, and call or get directions in one tap. Our team checks every listing before it goes live and re-checks it regularly.`,
  },
  // The description of the home page (the page head): the Overview's first sentence and the first part of its second one.
  description: `${brand.name} is a healthcare directory built for Nigeria. Find hospitals, clinics, maternity homes, pharmacies and laboratories near you.`,
  findByType: { heading: "Find by type" },
  why: {
    heading: `Why ${brand.name}`,
    items: [
      { title: "Verified information", text: "Our team checks each listing before it goes live and re-checks it regularly." },
      { title: "See what's open now", text: "Find places open right now, including late-night and 24-hour services." },
      { title: "Built for mobile data", text: "Light pages built for a weak connection." },
      {
        title: "Your location stays private",
        text: "Your location is used only to show places near you. We don't store it.",
      },
    ],
  },
  owners: {
    heading: "Own or manage a healthcare facility?",
    text: `List your facility on ${brand.name} so people nearby can find you, call you and get directions. Listing is free during our launch, and every listing is checked by our team before it goes live.`,
    button: "List your facility",
  },
} as const;
