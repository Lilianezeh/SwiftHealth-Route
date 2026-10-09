/** The search filters, and how they are written into and read from the page address.
 * Requirements: US-01, US-05, FR-05, NFR-07. Decisions 3 and 6 in specs/2026-10-09-search-frontend/requirements.md.
 *
 * The address holds every filter so results can be shared (`/search?category=pharmacy&open_now=true`), but never the
 * visitor's position: `lat` and `lng` are not written here and are ignored when read.
 */
import { MAX_RADIUS_KM } from "@/config/search";

export type SearchFilters = {
  q?: string;
  category?: string; // a category slug
  service?: string; // a name from the `services` list of GET /meta
  area?: string; // one of the `areas` of GET /meta
  open_now?: boolean;
  is_24_hours?: boolean;
  radius_km?: number;
};

const TEXT_KEYS = ["q", "category", "service", "area"] as const;

function isValidRadius(radius: number | undefined): radius is number {
  return radius !== undefined && Number.isFinite(radius) && radius > 0 && radius <= MAX_RADIUS_KM;
}

/** Filters to a query string without a leading "?". Empty text, switches that are off and no distance are left out. */
export function filtersToQuery(filters: SearchFilters): string {
  const parameters = new URLSearchParams();
  for (const key of TEXT_KEYS) {
    const text = filters[key]?.trim();
    if (text) parameters.set(key, text);
  }
  if (filters.open_now === true) parameters.set("open_now", "true");
  if (filters.is_24_hours === true) parameters.set("is_24_hours", "true");
  if (isValidRadius(filters.radius_km)) parameters.set("radius_km", String(filters.radius_km));
  return parameters.toString();
}

/** A query string (with or without "?") to filters. Anything that is not valid is ignored; lat and lng always are. */
export function queryToFilters(query: string | URLSearchParams): SearchFilters {
  const parameters = typeof query === "string" ? new URLSearchParams(query) : query;
  const filters: SearchFilters = {};
  for (const key of TEXT_KEYS) {
    const text = parameters.get(key)?.trim();
    if (text) filters[key] = text;
  }
  if (parameters.get("open_now") === "true") filters.open_now = true;
  if (parameters.get("is_24_hours") === "true") filters.is_24_hours = true;
  const radius = Number(parameters.get("radius_km"));
  if (parameters.has("radius_km") && isValidRadius(radius)) filters.radius_km = radius;
  return filters;
}
