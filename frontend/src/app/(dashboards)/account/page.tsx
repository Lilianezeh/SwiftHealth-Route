/** My account `/account` (every role). Requirements: FR-54, US-21. UI spec 3.1d. The gate lets any logged-in role in and sends a
 * visitor to the login; the API checks the login of every call again. Not for search engines (the dashboards layout says so). */
import type { Metadata } from "next";

import { AccountSettings } from "@/components/account/AccountSettings";
import { StaffGate } from "@/components/admin/StaffGate";

export const metadata: Metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <StaffGate area="account">
      <AccountSettings />
    </StaffGate>
  );
}
