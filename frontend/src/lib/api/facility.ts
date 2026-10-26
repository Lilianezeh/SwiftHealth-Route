/** Registering a facility and asking to manage one, from the browser. Requirements: FR-50, FR-51, NFR-06, NFR-07.
 * Contract: api-spec section 7, "Phase 7". All three calls need a provider's token. Nothing about the visitor's position is sent.
 * A 409 reaches the caller as an ApiError whose `detail` is the API's sentence (and `listingId` when the facility may be claimed);
 * a 422 and a 429 reach it with that status.
 */
import { requestJson } from "@/lib/api/request";

export type FacilityRole = "owner" | "manager";

export type FacilityRegistration = {
  facility_name: string;
  category: string;
  area: string;
  address: string;
  phone: string;
  role: FacilityRole;
  notes: string;
};

export type ClaimableFacility = { id: number; name: string; area: string; category: { slug: string; name: string } };

export function registerFacility(token: string, registration: FacilityRegistration): Promise<{ message: string; listing_id: number; link_id: number }> {
  const notes = registration.notes.trim();
  return requestJson("/provider/facilities", {
    token,
    body: {
      facility_name: registration.facility_name.trim(),
      category: registration.category,
      area: registration.area,
      address: registration.address.trim(),
      phone: registration.phone.trim(),
      role: registration.role,
      ...(notes ? { notes } : {}),
    },
  });
}

export async function findClaimableFacilities(token: string, searchText: string, signal?: AbortSignal): Promise<ClaimableFacility[]> {
  const answer = await requestJson<{ items: ClaimableFacility[] }>(`/provider/claimable?q=${encodeURIComponent(searchText.trim())}`, { token, signal });
  return answer.items;
}

export function claimFacility(token: string, claim: { listing_id: number; role: FacilityRole; reason: string }): Promise<{ message: string; link_id: number }> {
  return requestJson("/provider/claims", { token, body: { ...claim, reason: claim.reason.trim() } });
}
