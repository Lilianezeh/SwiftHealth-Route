/** The report queue `/admin/reports` (editor and admin). Requirements: US-12, FR-35. UI spec 3.6. The gate lets only those roles
 * in; the API checks the role again on every call. */
import { ReportsQueue } from "@/components/admin/ReportsQueue";
import { StaffGate } from "@/components/admin/StaffGate";

export default function AdminReportsPage() {
  return (
    <StaffGate area="review">
      <ReportsQueue />
    </StaffGate>
  );
}
