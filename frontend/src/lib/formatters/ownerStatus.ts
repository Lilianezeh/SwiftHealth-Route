/** The state of an owner's request in the words the owner asked for: Draft, Waiting for payment, Waiting for review, Changes requested,
 * Published. Requirements: US-17, FR-50. Spec: specs/2026-11-01-owner-form-fields/.
 * It reads the state of the link and the state of the listing: once staff approved the owner, the request is "Published" as soon as
 * the listing is public, and an unpaid month later does not change that (the listing stays public and free).
 */
export function ownerStatusWords(linkStatus: string, listingStatus: string): string {
  switch (linkStatus) {
    case "draft":
      return "Draft";
    case "awaiting_payment":
      return "Waiting for payment";
    case "pending":
      return "Waiting for review";
    case "changes_requested":
      return "Changes requested";
    case "removed":
      return "Removed";
    default:
      return listingStatus === "published" ? "Published" : "Waiting for review";
  }
}
