/** The staff list of listings `/admin/listings`. Requirements: FR-31, FR-42, FR-34. UI spec 3.3. A verifier starts at `?mine=true`; the
 * dashboard cards link with `?status=published` or `?status=pending_review`. The page only reads those two from the address (a status
 * that does not exist is ignored); the list is loaded in the browser with the staff token (StaffListings). */
import { StaffGate } from "@/components/admin/StaffGate";
import { StaffListings } from "@/components/admin/StaffListings";
import { STATUS_LABELS } from "@/components/admin/StatusBadge";
import type { ListingStatus } from "@/types/staff";

type ListingsSearch = { mine?: string; status?: string };

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<ListingsSearch> }) {
  const { mine, status } = await searchParams;
  const initialStatus = status && status in STATUS_LABELS ? (status as ListingStatus) : "";
  return (
    <StaffGate area="listings">
      <StaffListings initialMine={mine === "true"} initialStatus={initialStatus} />
    </StaffGate>
  );
}
