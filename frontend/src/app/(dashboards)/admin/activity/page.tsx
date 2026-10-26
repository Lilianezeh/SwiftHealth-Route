/** The activity log `/admin/activity` (admin only). Requirements: FR-55. UI spec 3.8b. The gate lets only the admin role in; the
 * API checks the role again on every call. */
import { ActivityLog } from "@/components/admin/ActivityLog";
import { StaffGate } from "@/components/admin/StaffGate";

export default function AdminActivityPage() {
  return (
    <StaffGate area="staff">
      <ActivityLog />
    </StaffGate>
  );
}
