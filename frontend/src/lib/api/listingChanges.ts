/** Moving and closing a facility, and its address history, from the browser. Requirements: FR-53, US-20, NFR-06.
 * Contract: api-spec section 7, "Phase 8a". Every call carries the logged-in token (staff or provider) in the header. The API decides
 * who may do what (an editor or admin, or an approved owner; only an owner may close); a refusal reaches the caller as an ApiError.
 */
import { requestJson } from "@/lib/api/request";

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

export function closeListing(token: string, listingId: number, reason: string): Promise<CloseResult> {
  return requestJson<CloseResult>(`/listings/${listingId}/close`, { token, body: { reason: reason.trim() } });
}

export async function getAddressHistory(token: string, listingId: number): Promise<AddressHistoryItem[]> {
  const answer = await requestJson<{ items?: AddressHistoryItem[] }>(`/listings/${listingId}/address-history`, { token });
  return Array.isArray(answer.items) ? answer.items : []; // an answer of another shape shows as "No changes yet."
}
