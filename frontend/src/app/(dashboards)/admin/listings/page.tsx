/** The staff list of listings `/admin/listings`. Requirements: FR-31, FR-42. UI spec 3.3. A verifier starts at `?mine=true`.
 * The page only reads that flag from the address; the list is loaded in the browser with the staff token (StaffListings). */
import { StaffGate } from "@/components/admin/StaffGate";
import { StaffListings } from "@/components/admin/StaffListings";

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const { mine } = await searchParams;
  return (
    <StaffGate area="listings">
      <StaffListings initialMine={mine === "true"} />
    </StaffGate>
  );
}
