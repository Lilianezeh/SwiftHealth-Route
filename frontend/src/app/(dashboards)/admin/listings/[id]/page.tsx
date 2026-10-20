/** One listing for staff `/admin/listings/<id>`. Requirements: FR-31, FR-32, FR-42. UI spec 3.4. The page only turns the address into a
 * number; the listing is loaded in the browser with the staff token. A value that is not a whole number is a not-found page. */
import { StaffGate } from "@/components/admin/StaffGate";
import { ListingEditor } from "@/components/admin/ListingEditor";
import { ListingNotFound } from "@/components/listing/ListingNotFound";

export default async function AdminEditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) return <ListingNotFound />;
  return (
    <StaffGate area="listings">
      <ListingEditor listingId={Number(id)} />
    </StaffGate>
  );
}
