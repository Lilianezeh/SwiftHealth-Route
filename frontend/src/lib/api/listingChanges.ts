/** Moving and closing a facility, and its address history, from the browser. Requirements: FR-53, US-20, NFR-06.
 * Contract: api-spec section 7, "Phase 8a". Every call carries the logged-in token (staff or provider) in the header. The API decides
 * who may do what (an editor or admin, or an approved owner; only an owner may close); a refusal reaches the caller as an ApiError.
 */
import { requestJson } from "@/lib/api/request";
import type { StaffListingDetail } from "@/types/staff";

export type AddressChange = { address: string; area: string; landmark: string | null };

export type MoveResult = {
  listing_id: number;
  status: string;
  changed: string[];
  pin_needs_setting: boolean;
  message: string;
};

export type CloseResult = { listing_id: number; status: string; closed_at: string };

export type AddressHistoryItem = {
  changed_at: string;
  field: "address" | "area" | "landmark";
  old_value: string | null;
  new_value: string | null;
  kind: "move" | "edit";
  by: string | null;
};

export function moveListingAddress(token: string, listingId: number, change: AddressChange): Promise<MoveResult> {
  return requestJson<MoveResult>(`/listings/${listingId}/move`, {
    token,
    body: { address: change.address.trim(), area: change.area, landmark: change.landmark?.trim() || null },
  });
}

export type BranchInput = { facility_name: string; area: string; address: string; phone: string; notes: string };
export type BranchItem = { id: number; name: string; area: string; status: string };

/** The branches of a facility the logged-in provider manages, of every status (FR-52). */
export async function listBranches(token: string, mainId: number): Promise<BranchItem[]> {
  const answer = await requestJson<{ items?: BranchItem[] }>(`/provider/facilities/${mainId}/branches`, { token });
  return Array.isArray(answer.items) ? answer.items : [];
}

/** Adds a branch: a draft for staff to verify. A 409 (already registered) and a 422 (a rule) carry the API's sentence. */
export function addBranch(token: string, mainId: number, branch: BranchInput): Promise<{ message: string; listing_id: number }> {
  const notes = branch.notes.trim();
  return requestJson(`/provider/facilities/${mainId}/branches`, {
    token,
    body: {
      facility_name: branch.facility_name.trim(),
      area: branch.area,
      address: branch.address.trim(),
      phone: branch.phone.trim(),
      ...(notes ? { notes } : {}),
    },
  });
}

/** Staff (editor, admin): make a listing a branch of another (a number) or a main facility again (null). */
export function setMainFacility(token: string, listingId: number, parentId: number | null): Promise<StaffListingDetail> {
  return requestJson<StaffListingDetail>(`/listings/${listingId}`, { token, method: "PATCH", body: { parent_id: parentId } });
}

export function closeListing(token: string, listingId: number, reason: string): Promise<CloseResult> {
  return requestJson<CloseResult>(`/listings/${listingId}/close`, { token, body: { reason: reason.trim() } });
}

export async function getAddressHistory(token: string, listingId: number): Promise<AddressHistoryItem[]> {
  const answer = await requestJson<{ items?: AddressHistoryItem[] }>(`/listings/${listingId}/address-history`, { token });
  return Array.isArray(answer.items) ? answer.items : []; // an answer of another shape shows as "No changes yet."
}
