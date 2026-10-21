/** A new listing `/admin/listings/new`. Requirements: FR-31, FR-42. UI spec 3.4. The editor loads nothing: it only needs the lists
 * of GET /meta, in the browser. */
import { ListingEditor } from "@/components/admin/ListingEditor";
import { StaffGate } from "@/components/admin/StaffGate";

export default function AdminNewListingPage() {
  return (
    <StaffGate area="listings">
      <ListingEditor listingId={null} />
    </StaffGate>
  );
}
