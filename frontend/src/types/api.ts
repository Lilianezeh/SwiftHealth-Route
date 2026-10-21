/** Types for data returned by the API. Must match specs/backend/api-spec.md. */

export type HealthResponse = { status: string };

export type CategorySummary = { slug: string; name: string };

/** One result in a list (api-spec, "ListingSummary"). `distance_km` is null when no position was sent. */
export type ListingSummary = {
  id: number;
  slug: string;
  name: string;
  category: CategorySummary;
  area: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_km: number | null;
  is_open_now: boolean;
  is_24_hours: boolean;
  primary_phone: string | null; // +234...
  last_verified_at: string | null; // ISO 8601, UTC
  verification_due: boolean;
  sponsored: boolean;
  // The next opening or closing time as English text from the API, in Lagos time ("Closes 9:00 PM", "Opens Monday 7:30 AM").
  // null for a 24-hour listing and for a listing with no hours recorded.
  hours_note: string | null;
};

/** One phone number of a listing page (api-spec, "ListingDetail"). `is_whatsapp` is only true when staff or the provider said so (FR-47). */
export type PhoneRead = { number: string; label: string | null; is_primary: boolean; is_whatsapp: boolean };

/** One day of the week. A day with no hours is closed, with null times. 0 = Monday ... 6 = Sunday. */
export type OpeningHoursRead = {
  day_of_week: number;
  opens_at: string | null; // "HH:MM", Lagos time
  closes_at: string | null; // earlier than opens_at means the shift runs past midnight
  is_closed: boolean;
};

/** One service with its fee range. Money is a string with 2 decimals ("1500.00"), never a number (api-spec, Conventions). */
export type ServiceRead = {
  name: string;
  fee_min_naira: string | null;
  fee_max_naira: string | null;
  fee_collected_at: string | null; // "YYYY-MM-DD"
};

/** The answer of GET /listings/{slug} (api-spec, "ListingDetail"): the summary plus everything the page shows (FR-09). */
export type ListingDetail = ListingSummary & {
  landmark: string | null;
  description: string | null;
  entrance_photo_url: string | null;
  phones: PhoneRead[]; // the primary number first
  opening_hours: OpeningHoursRead[]; // always 7, Monday first
  services: ServiceRead[];
  recently_reported_not_working: boolean; // the FR-22 rule: the listing is still shown, so the page can warn
  disclaimer: string; // FR-13
};

/** One group of GET /emergency (api-spec). `contacts` may be empty: the page hides an empty group. */
export type EmergencyGroup = { category: CategorySummary; contacts: ListingSummary[] };

/** The answer of GET /emergency (api-spec): 112 first, seven groups in order, the 24-hour pharmacies, and the FR-26 sentence. */
export type EmergencyResponse = {
  national_line: { name: string; number: string };
  groups: EmergencyGroup[];
  pharmacies_24h: ListingSummary[];
  disclaimer: string;
};

/** The answer of GET /search. */
export type SearchResponse = { items: ListingSummary[]; total: number };

export type MetaCategory = { slug: string; name: string; is_emergency: boolean };

/** The answer of GET /meta: the lists behind the filters and forms. */
export type MetaResponse = {
  areas: string[];
  categories: MetaCategory[];
  services: string[];
  blood_groups: string[];
  report_reasons: string[];
};
