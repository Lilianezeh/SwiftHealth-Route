/** Owner requests `/admin/owner-requests` (editor and admin). Requirements: FR-50, US-19. UI spec 3.10. The gate lets only an editor
 * or an admin in (the "review" area); the API checks the role again on every call. */
import { OwnerRequests } from "@/components/admin/OwnerRequests";
import { StaffGate } from "@/components/admin/StaffGate";

export default function OwnerRequestsPage() {
  return (
    <StaffGate area="review">
      <OwnerRequests />
    </StaffGate>
  );
}
