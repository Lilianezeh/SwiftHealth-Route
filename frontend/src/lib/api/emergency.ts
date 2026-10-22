/** GET /emergency from the browser. Requirements: FR-14 to FR-16. Contract: api-spec, "GET /emergency".
 *
 * The visitor's position is sent only here, only as `lat` and `lng` together, and only to add distances (never in a page address).
 */
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type { Position } from "@/lib/api/search";
import type { EmergencyResponse } from "@/types/api";

export function getEmergency(position: Position | null, options: RequestOptions = {}): Promise<EmergencyResponse> {
  const parameters = new URLSearchParams();
  if (position) {
    parameters.set("lat", String(position.latitude));
    parameters.set("lng", String(position.longitude));
  }
  const query = parameters.toString();
  return requestJson<EmergencyResponse>(query ? `/emergency?${query}` : "/emergency", options);
}
