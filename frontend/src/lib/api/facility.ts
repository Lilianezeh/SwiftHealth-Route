/** Registering a facility, editing the request, and asking to manage one, from the browser. Requirements: FR-50, FR-51, NFR-06, NFR-07.
 * Contract: api-spec section 7, "Phase 7" and "The full owner form and drafts". All calls need a provider's token. Nothing about the
 * visitor's position is sent. A 409 reaches the caller as an ApiError whose `detail` is the API's sentence (and `listingId` when the
 * facility may be claimed); a 422 and a 429 reach it with that status.
 */
import { requestJson } from "@/lib/api/request";

export type FacilityRole = "owner" | "manager";

export type HoursEntry =
  | { day_of_week: number; opens_at: string; closes_at: string; is_closed: false }
  | { day_of_week: number; is_closed: true };

export type OtherPhone = { number: string; label?: string; is_whatsapp: boolean };

/** The body of `POST /provider/facilities` and `PUT /provider/requests/{link_id}`. Empty optional fields are left out. */
export type FacilityRegistration = {
  facility_name: string;
  category: string;
  area: string;
  address: string;
  landmark?: string;
  description?: string;
  email?: string; // staff only
  phone: string; // the main number
  phone_has_whatsapp: boolean;
  other_phones?: OtherPhone[];
  is_24_hours: boolean;
  opening_hours?: HoursEntry[];
  services?: string[];
  role: FacilityRole;
  notes?: string;
  save_as_draft: boolean;
};

/** A request as saved (`GET /provider/requests/{link_id}`): the numbers come back as stored (+234...). */
export type SavedRequest = {
  link_id: number;
  listing_id: number;
  status: string;
  role: FacilityRole;
  notes: string | null;
  facility_name: string;
  category: string;
  area: string;
  address: string;
  landmark: string | null;
  description: string | null;
  email: string | null;
  phone: string;
  phone_has_whatsapp: boolean;
  other_phones: { number: string; label: string | null; is_whatsapp: boolean }[];
  is_24_hours: boolean;
  opening_hours: { day_of_week: number; opens_at: string | null; closes_at: string | null; is_closed: boolean }[];
  services: string[];
};

export type ClaimableFacility = { id: number; name: string; area: string; category: { slug: string; name: string } };

/** What registering, saving or claiming answers: `status` is "draft" (saved, not sent), "awaiting_payment" (sent; the first month of
 * `fee_naira` is not paid), "pending" (sent again after changes) or "changes_requested" (saved only). */
export type RequestSaved = { message: string; link_id: number; status: string; fee_naira: string };

export function registerFacility(token: string, registration: FacilityRegistration): Promise<RequestSaved & { listing_id: number }> {
  return requestJson("/provider/facilities", { token, body: registration });
}

export function getFacilityRequest(token: string, linkId: number): Promise<SavedRequest> {
  return requestJson<SavedRequest>(`/provider/requests/${linkId}`, { token });
}

/** Saves the request, and sends it unless `save_as_draft` is true. Only a draft or a request that needs changes can be saved (else 409). */
export function saveFacilityRequest(token: string, linkId: number, registration: FacilityRegistration): Promise<RequestSaved & { listing_id: number }> {
  return requestJson(`/provider/requests/${linkId}`, { token, method: "PUT", body: registration });
}

export async function findClaimableFacilities(token: string, searchText: string, signal?: AbortSignal): Promise<ClaimableFacility[]> {
  const answer = await requestJson<{ items: ClaimableFacility[] }>(`/provider/claimable?q=${encodeURIComponent(searchText.trim())}`, { token, signal });
  return answer.items;
}

export function claimFacility(token: string, claim: { listing_id: number; role: FacilityRole; reason: string }): Promise<RequestSaved> {
  return requestJson("/provider/claims", { token, body: { ...claim, reason: claim.reason.trim() } });
}
