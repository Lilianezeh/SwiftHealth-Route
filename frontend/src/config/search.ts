/** Constants for the Find page and the results page. Spec: specs/frontend/ui-spec.md, sections 2.2 and 2.3. */

// A sleeping free API takes up to a minute to wake: tell the visitor after 5 seconds, give up after 45 (decision 1).
export const WAKING_NOTICE_MS = 5_000;
export const REQUEST_TIMEOUT_MS = 45_000;

export const PAGE_SIZE = 20; // results per "Load more" step (the API default)
export const MAX_RADIUS_KM = 50; // the API's limit for radius_km
export const DISTANCE_CHOICES_KM = [5, 10, 20] as const; // the choices in the Filters dialog

// The five shortcuts of FR-01. The slugs are the category slugs of the seed; Blood goes to its own page (phase 8).
export const CATEGORY_SHORTCUTS = [
  { label: "Hospitals", slug: "hospital" },
  { label: "Clinics", slug: "clinic" },
  { label: "Pharmacies", slug: "pharmacy" },
  { label: "Maternity", slug: "maternity" },
  { label: "Labs", slug: "laboratory" },
] as const;
export const BLOOD_SHORTCUT = { label: "Blood", href: "/blood" } as const;
