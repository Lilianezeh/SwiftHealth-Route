"use client";

/** `/admin`: the dashboard for an editor and an admin; every other role is sent to its own start (decision C11 in
 * specs/2026-10-20-staff-screens/requirements.md), and a visitor with no session to the login. It shows nothing of the staff area
 * while it decides. Requirements: FR-30, FR-34. UI spec 3.2.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Dashboard } from "@/components/admin/Dashboard";
import { StaffGate } from "@/components/admin/StaffGate";
import { canOpen, homeAddressFor } from "@/lib/staff/roles";
import { readStaffSession } from "@/lib/staff/session";

export function AdminHome() {
  const router = useRouter();
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    const session = readStaffSession();
    if (session === null) router.replace("/admin/login");
    else if (canOpen(session.user.role, "review")) setShowDashboard(true);
    else router.replace(homeAddressFor(session.user.role));
  }, [router]);

  if (showDashboard) {
    return (
      <StaffGate area="review">
        <Dashboard />
      </StaffGate>
    );
  }

  return (
    <p role="status" className="mx-auto max-w-4xl px-4 py-10 text-base text-ink">
      Going to your page…
    </p>
  );
}
