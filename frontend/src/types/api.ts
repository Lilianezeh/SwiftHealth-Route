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
