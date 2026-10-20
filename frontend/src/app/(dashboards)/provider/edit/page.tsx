/** Edit my facility `/provider/edit` (provider role only). Requirements: FR-43. UI spec 4.2. */
import { StaffGate } from "@/components/admin/StaffGate";
import { ProviderEdit } from "@/components/provider/ProviderEdit";

export default function ProviderEditPage() {
  return (
    <StaffGate area="provider">
      <ProviderEdit />
    </StaffGate>
  );
}
