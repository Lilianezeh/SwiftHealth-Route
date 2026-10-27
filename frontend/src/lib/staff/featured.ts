/** Who can be featured. Requirements: FR-44, FR-45, FR-19; api-spec section 8, "Sponsored rules" (the owner's check of 2026-10-27).
 * Only a published listing that has been verified and is not overdue for its re-check can be featured: paying never buys
 * verification. The API refuses the others with these same sentences; the screens use this to say why before the person pays.
 */
import type { StaffListingDetail } from "@/types/staff";

export const ONLY_PUBLISHED = "Only a published listing can be featured.";
export const ONLY_VERIFIED = "Only a verified listing can be featured.";

type Featurable = Pick<StaffListingDetail, "status" | "last_verified_at" | "verification_due">;

/** The sentence that says why a listing cannot be featured, or null when it can. */
export function whyNotFeatured(listing: Featurable): string | null {
  if (listing.status !== "published") return ONLY_PUBLISHED;
  if (listing.last_verified_at === null || listing.verification_due) return ONLY_VERIFIED;
  return null;
}
