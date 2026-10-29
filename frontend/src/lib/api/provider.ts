/** The provider and payment calls of the API, from the browser. Requirements: FR-43, FR-44, FR-46, NFR-06. Contract: api-spec,
 * sections 7 and 8 ("Phase 12 rules"). Every call carries the provider's token in the header (never in an address). Paystack is
 * never called from the browser: the API starts the payment, and Paystack's own page takes it (test mode only).
 */
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type {
  FeaturedStarted,
  LinkCancelled,
  ListingInput,
  MyFacilityList,
  OwnerFeePayment,
  OwnerFeeStarted,
  OwnerFeeVerified,
  PaymentVerified,
  ProviderListing,
} from "@/types/staff";

type Options = Omit<RequestOptions, "token" | "body" | "method">;

/** The only four fields a provider may change (FR-43): any other field is a 422. */
export type ProviderChanges = Partial<Pick<ListingInput, "description" | "services" | "opening_hours" | "phones">>;

/** The provider's listing. With a `listingId` it is that one (it needs an approved link, else 404); without, the first approved one. */
export function getProviderListing(token: string, options: Options = {}, listingId?: number): Promise<ProviderListing> {
  const path = listingId === undefined ? "/provider/listing" : `/provider/listings/${listingId}`;
  return requestJson<ProviderListing>(path, { ...options, token });
}

export function updateProviderListing(
  token: string,
  changes: ProviderChanges,
  options: Options = {},
  listingId?: number,
): Promise<ProviderListing> {
  const path = listingId === undefined ? "/provider/listing" : `/provider/listings/${listingId}`;
  return requestJson<ProviderListing>(path, { ...options, token, method: "PATCH", body: changes });
}

/** Every facility link of the provider, with its state and the owner fee (accounts phase 6; owner fee). */
export function listMyFacilities(token: string, options: Options = {}): Promise<MyFacilityList> {
  return requestJson<MyFacilityList>("/provider/listings", { ...options, token });
}

/** Starts the monthly owner fee of one of the provider's own links on Paystack (test mode). The amount is the API's setting. */
export function startOwnerFeePayment(token: string, linkId: number, options: Options = {}): Promise<OwnerFeeStarted> {
  return requestJson<OwnerFeeStarted>("/payments/owner-fee", { ...options, token, body: { link_id: linkId } });
}

/** `reference` comes from the address Paystack sends the provider back to; it is encoded, never trusted as a path. */
export function verifyOwnerFeePayment(token: string, reference: string, options: Options = {}): Promise<OwnerFeeVerified> {
  return requestJson<OwnerFeeVerified>(`/payments/owner-fee/${encodeURIComponent(reference)}`, { ...options, token });
}

/** Stops managing a facility (the listing stays public and free). */
export function cancelLink(token: string, linkId: number, options: Options = {}): Promise<LinkCancelled> {
  return requestJson<LinkCancelled>(`/provider/links/${linkId}/cancel`, { ...options, token, method: "POST" });
}

/** The provider's own owner-fee payments (receipts), newest first. */
export function listMyPayments(token: string, options: Options = {}): Promise<{ items: OwnerFeePayment[] }> {
  return requestJson<{ items: OwnerFeePayment[] }>("/provider/payments", { ...options, token });
}

export function startFeaturedPayment(token: string, options: Options = {}): Promise<FeaturedStarted> {
  return requestJson<FeaturedStarted>("/payments/featured", { ...options, token, body: { plan: "monthly" } });
}

/** `reference` comes from the address Paystack sends the provider back to; it is encoded, never trusted as a path. */
export function verifyPayment(token: string, reference: string, options: Options = {}): Promise<PaymentVerified> {
  return requestJson<PaymentVerified>(`/payments/verify/${encodeURIComponent(reference)}`, { ...options, token });
}
