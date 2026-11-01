/** The SwiftRescue call from the browser. Requirements: FR-14 to FR-16, NFR-07. Contract: api-spec, "GET /emergency" and "POST /emergency".
 *
 * The visitor's position is sent only here, only as `lat` and `lng` together, only to add distances, and in the BODY of a POST (never in a
 * page address and never in the address of the API call). Without a position it is the plain `GET /emergency` that the offline copy and
 * the service worker know.
 */
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type { Position } from "@/lib/api/search";
import type { EmergencyResponse } from "@/types/api";

export function getEmergency(position: Position | null, options: RequestOptions = {}): Promise<EmergencyResponse> {
  if (position) {
    return requestJson<EmergencyResponse>("/emergency", { ...options, body: { lat: position.latitude, lng: position.longitude } });
  }
  return requestJson<EmergencyResponse>("/emergency", options);
}
