/** My facility `/provider` (provider role only). Requirements: FR-43, FR-44. UI spec 4.1. The gate lets only a provider in; the API
 * checks the role again on every call. */
import { StaffGate } from "@/components/admin/StaffGate";
import { ProviderHome } from "@/components/provider/ProviderHome";

export default function ProviderDashboard() {
  return (
    <StaffGate area="provider">
      <ProviderHome />
    </StaffGate>
  );
}
