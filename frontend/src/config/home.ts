import { siteConfig } from "@/config/site";

/** The photos and the words of the home page. Requirements: US-13, NFR-01, NFR-10. UI spec 2.1 (the words are the owner's).
 * Photos: one file, one fixed size, one alt text each.
 * Specs: specs/2026-10-11-home-redesign/ (decisions 7, 8, 15 and 19). The files are made by scripts/optimize-home-images.mjs
 * and tested by tests/unit/homeImages.test.ts, which checks that `width` and `height` are the real pixel size of each file.
 *
 * Alt text was written after looking at each converted photo: short, factual, no medical claim. The owner reviews it on the
 * preview.
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
    src: `${FOLDER}/hero.webp`,
    width: 1280,
    height: 853,
    alt: "A blue stethoscope and a blister pack of blue and white capsules on a clipboard.",
  },
  heroPhone: {
    src: `${FOLDER}/hero-phone.webp`,
    width: 640,
    height: 427,
    alt: "A blue stethoscope and a blister pack of blue and white capsules on a clipboard.",
  },
  // The second photo of the pair on tablets and desktops. It is never downloaded on a phone.
  hero2: {
    src: `${FOLDER}/hero2.webp`,
    width: 960,
    height: 640,
    alt: "Two health workers looking at a computer screen in front of shelves of medicine.",
  },
  // Browse by type: five cards, 4:3.
  hospital: {
    src: `${FOLDER}/hospital.webp`,
    width: 640,
    height: 480,
    alt: "A doctor talks with a patient sitting up in a hospital bed.",
  },
  clinic: {
    src: `${FOLDER}/clinic.webp`,
    width: 640,
    height: 480,
    alt: "A nurse in teal scrubs and gloves holds a clipboard in a bright clinic, with a colleague at a desk behind.",
  },
  maternity: {
    src: `${FOLDER}/maternity.webp`,
    width: 640,
    height: 480,
    alt: "A doctor in a white coat and a face mask talks with a patient across a desk.",
  },
  pharmacy: {
    src: `${FOLDER}/pharmacy.webp`,
    width: 640,
    height: 480,
    alt: "A health worker in a white coat serves a customer at a pharmacy counter, with shelves of medicine behind.",
  },
  laboratory: {
    src: `${FOLDER}/laboratory.webp`,
    width: 640,
    height: 480,
    alt: "A laboratory worker in a white coat and blue gloves holds a small test tube next to a microscope.",
  },
  // The SwiftRescue band.
  ambulance: {
    src: `${FOLDER}/ambulance.webp`,
    width: 640,
    height: 427,
    alt: "A health worker in a white coat and a face mask stands in front of an ambulance with its rear doors open.",
  },
  fire: {
    src: `${FOLDER}/fire.webp`,
    width: 640,
    height: 427,
    alt: "A firefighter in a red helmet and protective gear beside a fire engine, surrounded by smoke.",
  },
  // For facility owners.
  owner: {
    src: `${FOLDER}/owner.webp`,
    width: 800,
    height: 533,
    alt: "A smiling health worker in a white coat and a stethoscope works at a computer in a pharmacy.",
  },
} as const satisfies Record<string, HomePhoto>;

/** The five photo cards of "Browse by type": the label, the category slug of the seed (the search address), and the photo. */
export const HOME_CATEGORIES = [
  { label: "Hospital", slug: "hospital", photo: HOME_PHOTOS.hospital },
  { label: "Clinic", slug: "clinic", photo: HOME_PHOTOS.clinic },
  { label: "Maternity", slug: "maternity", photo: HOME_PHOTOS.maternity },
  { label: "Pharmacy", slug: "pharmacy", photo: HOME_PHOTOS.pharmacy },
  { label: "Laboratory", slug: "laboratory", photo: HOME_PHOTOS.laboratory },
] as const;

/** The words of the page. The first city is the only place that names a city, and it comes from siteConfig. */
export const HOME_WORDS = {
  hero: {
    heading: "Find open care near you, fast.",
    line: `Hospitals, pharmacies and emergency help, open near you. Now live in ${siteConfig.launchCity}, with more cities coming.`,
    findCare: "Find care near me",
    emergency: "Emergency help",
    note: "Free to use · No sign-up needed",
  },
  howItWorks: {
    heading: "How it works",
    steps: ["Search or share your location", "See who's open now", "Call, WhatsApp or get directions"],
  },
  browse: { heading: "Browse by type" },
  rescue: { heading: "In an emergency, every second counts.", button: "Open SwiftRescue" },
  owners: {
    heading: "Run a hospital, clinic or pharmacy?",
    text: "List your facility for free and help people find you when they need you. We verify every listing before it goes live.",
    button: "List your facility",
  },
  about: {
    heading: `Starting in ${siteConfig.launchCity}. Growing across Nigeria.`,
    text: `SwiftHealth makes it easier to find care that's actually open. We're starting in ${siteConfig.launchCity}, checking every listing ourselves, and adding new cities one at a time so every listing stays trustworthy.`,
  },
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
} as const;
