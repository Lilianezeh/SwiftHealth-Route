/** Get featured `/provider/featured` (provider role only). Requirements: FR-44, FR-45. UI spec 4.3. Test mode only. */
import { StaffGate } from "@/components/admin/StaffGate";
import { GetFeatured } from "@/components/provider/GetFeatured";

export default function ProviderFeaturedPage() {
  return (
    <StaffGate area="provider">
      <GetFeatured />
    </StaffGate>
  );
}
