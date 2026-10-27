/** SwiftRescue contacts `/admin/emergency-contacts` (editor and admin). Requirements: FR-15, FR-31, FR-32. UI spec 3.13. The gate lets
 * only an editor or an admin in (the "review" area); the API checks the role again on every call. */
import { EmergencyContacts } from "@/components/admin/EmergencyContacts";
import { StaffGate } from "@/components/admin/StaffGate";

export default function EmergencyContactsPage() {
  return (
    <StaffGate area="review">
      <EmergencyContacts />
    </StaffGate>
  );
}
