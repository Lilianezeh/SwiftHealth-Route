/** The Security screen `/admin/security`: the authenticator app (FR-58). Every role may open it (the gate's "security" area); the API
 * checks the login of every call again. Not for search engines (the dashboards layout says so). */
import { StaffGate } from "@/components/admin/StaffGate";
import { TwoFactorSetup } from "@/components/admin/TwoFactorSetup";

export default function AdminSecurityPage() {
  return (
    <StaffGate area="security">
      <TwoFactorSetup />
    </StaffGate>
  );
}
