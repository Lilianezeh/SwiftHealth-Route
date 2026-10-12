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
  overview: {
    heading: "Overview",
    text: "SwiftHealth helps you find hospitals, clinics, pharmacies, labs and emergency contacts that are open right now. Every listing is checked by our team, so the number you call and the hours you see are ones you can trust.",
  },
  howItWorks: {
    heading: "How it works",
    steps: ["Search or share your location", "See who's open now", "Call, WhatsApp or get directions"],
  },
  browse: { heading: "Browse by type" },
  why: {
    heading: "Benefits",
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
