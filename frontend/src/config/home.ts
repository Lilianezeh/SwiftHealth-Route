/** The photos and the words of the home page. Requirements: US-13, NFR-01, NFR-10. UI spec 2.1 (the words are the owner's).
 * Specs: specs/2026-10-11-home-redesign/ (decisions 7, 8, 15 and 19, and revisions R1 to R10 of 2026-10-12). The page has two
 * photos, the hero and the owner photo (Unsplash photos, from hero4.jpg and owner2.jpg), and a smaller version of the hero for
 * phones. The files are made by
 * scripts/optimize-home-images.mjs and tested by tests/unit/homeImages.test.ts, which checks that `width` and `height` are the
 * real pixel size of each file.
 *
 * Alt text was written after looking at each converted photo: short, factual, no medical claim. The owner reviews it on the
 * preview. No text of the home page names a city (R6): the first city stays in `siteConfig.launchCity` for other parts of the app.
 */
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
    src: `${FOLDER}/hero4.webp`,
    width: 1280,
    height: 960,
    alt: "A smiling health worker in glasses and a white coat, with a stethoscope around the neck, holds up a blister pack of pills.",
  },
  heroPhone: {
    src: `${FOLDER}/hero4-phone.webp`,
    width: 640,
    height: 480,
    alt: "A smiling health worker in glasses and a white coat, with a stethoscope around the neck, holds up a blister pack of pills.",
  },
  // For facility owners.
  owner: {
    src: `${FOLDER}/owner2.webp`,
    width: 800,
    height: 600,
    alt: "A smiling person in a black T-shirt sits at a pharmacy counter, with shelves of medicine boxes behind.",
  },
} as const satisfies Record<string, HomePhoto>;

/** The five tiles of "Browse by type": the label and the category slug of the seed (the search address). The icons are
 * chosen in BrowseByType.tsx. */
export const HOME_CATEGORIES = [
  { label: "Hospital", slug: "hospital" },
  { label: "Clinic", slug: "clinic" },
  { label: "Maternity", slug: "maternity" },
  { label: "Pharmacy", slug: "pharmacy" },
  { label: "Laboratory", slug: "laboratory" },
] as const;

/** The words of the page. */
export const HOME_WORDS = {
  hero: {
    heading: "Find open care near you, fast.",
    line: "Hospitals, pharmacies and emergency help, open near you.",
    findCare: "Find care near me",
    note: "Free to use · No sign-up needed",
  },
  howItWorks: {
    heading: "How it works",
    steps: ["Search or share your location", "See who's open now", "Call, WhatsApp or get directions"],
  },
  browse: { heading: "Browse by type" },
  why: {
    heading: "Why SwiftHealth",
    items: [
      { title: "Verified listings", text: "We check every listing before it goes live." },
      { title: "Open now means open now", text: "Hours follow local time, including late-night places." },
      { title: "Works on slow data", text: "Light pages that load on a weak connection." },
      {
        title: "Your location stays private",
        text: "Your position stays in your browser and is used only to find places near you.",
      },
    ],
  },
  owners: {
    heading: "Run a hospital, clinic or pharmacy?",
    text: "List your facility for free and help people find you when they need you. We verify every listing before it goes live.",
    button: "List your facility",
  },
} as const;
