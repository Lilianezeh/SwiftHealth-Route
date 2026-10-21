/** Staff and provider accounts `/admin/staff` (admin only). Requirements: FR-41. UI spec 3.8. The gate lets only the admin role in;
 * the API checks the role again on every call. */
import { StaffAccounts } from "@/components/admin/StaffAccounts";
import { StaffGate } from "@/components/admin/StaffGate";

export default function AdminStaffPage() {
  return (
    <StaffGate area="staff">
      <StaffAccounts />
    </StaffGate>
  );
}
