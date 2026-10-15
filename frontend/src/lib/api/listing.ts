/** GET /listings/{slug} from the browser. Requirements: FR-09, US-06, NFR-07. Contract: api-spec, "GET /listings/{slug}".
 * Spec: specs/2026-10-13-listing-page/requirements.md D8 and D9.
 *
 * The request has no query string at all: the visitor's position is never sent (so `distance_km` is null and the page shows no distance).
 */
import { ApiError, requestJson, type RequestOptions } from "@/lib/api/request";
import type { ListingDetail } from "@/types/api";

/** The listing, or null when the API says 404 (an unknown slug, or a listing that is not published). Other failures are thrown. */
export async function getListing(slug: string, options: RequestOptions = {}): Promise<ListingDetail | null> {
  try {
    return await requestJson<ListingDetail>(`/listings/${encodeURIComponent(slug)}`, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
