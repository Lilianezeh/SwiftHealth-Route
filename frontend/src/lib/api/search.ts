/** GET /search from the browser. Requirements: US-01, US-05, FR-04 to FR-06. Contract: api-spec, "GET /search".
 *
 * The visitor's position is sent only here, only as `lat` and `lng` together (never in a page address).
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
  const parameters = new URLSearchParams();
  for (const key of ["q", "category", "service", "area"] as const) {
    const text = filters[key]?.trim();
    if (text) parameters.set(key, text);
  }
  if (filters.open_now === true) parameters.set("open_now", "true");
  if (filters.is_24_hours === true) parameters.set("is_24_hours", "true");
  if (position) {
    parameters.set("lat", String(position.latitude));
    parameters.set("lng", String(position.longitude));
    if (filters.radius_km !== undefined) parameters.set("radius_km", String(filters.radius_km)); // only means something with a position
  }
  parameters.set("limit", String(page.limit));
  parameters.set("offset", String(page.offset));
  return requestJson<SearchResponse>(`/search?${parameters.toString()}`, options);
}
