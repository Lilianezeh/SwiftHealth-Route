/** GET /search from the browser. Requirements: US-01, US-05, FR-04 to FR-06. Contract: api-spec, "GET /search".
 *
 * The visitor's position is sent only here, only as `lat` and `lng` together, in the BODY of `POST /search` (never in a page address and
 * never in the address of the API call: api-spec, "POST /search"). Without a position it is a plain GET.
 */
import { PAGE_SIZE } from "@/config/search";
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type { SearchFilters } from "@/lib/search/searchQuery";
import type { SearchResponse } from "@/types/api";

export type Position = { latitude: number; longitude: number };
export type Page = { limit: number; offset: number };

const FIRST_PAGE: Page = { limit: PAGE_SIZE, offset: 0 };

export function searchListings(
  filters: SearchFilters,
  position: Position | null,
  page: Page = FIRST_PAGE,
  options: RequestOptions = {},
): Promise<SearchResponse> {
  const fields: Record<string, string | number | boolean> = {};
  for (const key of ["q", "category", "service", "area"] as const) {
    const text = filters[key]?.trim();
    if (text) fields[key] = text;
  }
  if (filters.open_now === true) fields.open_now = true;
  if (filters.is_24_hours === true) fields.is_24_hours = true;
  if (position) {
    fields.lat = position.latitude;
    fields.lng = position.longitude;
    if (filters.radius_km !== undefined) fields.radius_km = filters.radius_km; // only means something with a position
  }
  fields.limit = page.limit;
  fields.offset = page.offset;

  if (position) {
    // The position goes in the BODY of a POST, never in the address: a hosting platform may log an address (NFR-07).
    return requestJson<SearchResponse>("/search", { ...options, body: fields });
  }
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) parameters.set(name, String(value));
  return requestJson<SearchResponse>(`/search?${parameters.toString()}`, options);
}
