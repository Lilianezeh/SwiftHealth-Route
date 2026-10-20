/** The verification log `/admin/listings/<id>/checks`. Requirements: FR-32, US-10. UI spec 3.5. The page only turns the address into
 * a number; everything else is loaded in the browser with the staff token. */
import { StaffGate } from "@/components/admin/StaffGate";
import { VerificationLog } from "@/components/admin/VerificationLog";
import { ListingNotFound } from "@/components/listing/ListingNotFound";

export default async function AdminChecksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) return <ListingNotFound />;
  return (
    <StaffGate area="listings">
      <VerificationLog listingId={Number(id)} />
    </StaffGate>
  );
}
