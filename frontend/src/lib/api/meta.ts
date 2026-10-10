/** GET /meta from the browser: the lists behind the filters (areas, categories, services). Requirements: FR-03, FR-05.
 *
 * The lists change rarely, so they are fetched once per page session and kept in memory. A failed call is not kept,
 * so the next call tries again.
 */
import { requestJson } from "@/lib/api/request";
import type { MetaResponse } from "@/types/api";

let metaRequest: Promise<MetaResponse> | null = null;

export function getMeta(): Promise<MetaResponse> {
  if (metaRequest === null) {
    metaRequest = requestJson<MetaResponse>("/meta").catch((error: unknown) => {
      metaRequest = null; // do not keep a failure
      throw error;
    });
  }
  return metaRequest;
}

/** For tests: forget the lists that were kept. */
export function resetMetaCache(): void {
  metaRequest = null;
}
