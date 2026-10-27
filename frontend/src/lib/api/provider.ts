/** The provider and payment calls of the API, from the browser. Requirements: FR-43, FR-44, FR-46, NFR-06. Contract: api-spec,
 * sections 7 and 8 ("Phase 12 rules"). Every call carries the provider's token in the header (never in an address). Paystack is
 * never called from the browser: the API starts the payment, and Paystack's own page takes it (test mode only).
 */
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type { FeaturedStarted, ListingInput, MyFacility, PaymentVerified, ProviderListing } from "@/types/staff";

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

/** Every facility link of the provider, with its state (accounts phase 6). */
export function listMyFacilities(token: string, options: Options = {}): Promise<{ items: MyFacility[] }> {
  return requestJson<{ items: MyFacility[] }>("/provider/listings", { ...options, token });
}

export function startFeaturedPayment(token: string, options: Options = {}): Promise<FeaturedStarted> {
  return requestJson<FeaturedStarted>("/payments/featured", { ...options, token, body: { plan: "monthly" } });
}

/** `reference` comes from the address Paystack sends the provider back to; it is encoded, never trusted as a path. */
export function verifyPayment(token: string, reference: string, options: Options = {}): Promise<PaymentVerified> {
  return requestJson<PaymentVerified>(`/payments/verify/${encodeURIComponent(reference)}`, { ...options, token });
}
