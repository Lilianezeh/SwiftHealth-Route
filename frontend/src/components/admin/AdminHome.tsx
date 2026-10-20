"use client";

/** `/admin`: sends each role to its own start (decision C11 in specs/2026-10-20-staff-screens/requirements.md), and a visitor with no
 * session to the login. It shows nothing of the staff area while it decides. Phase 11 replaces this with the dashboard. */
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { homeAddressFor } from "@/lib/staff/roles";
import { readStaffSession } from "@/lib/staff/session";

export function AdminHome() {
  const router = useRouter();

  useEffect(() => {
    const session = readStaffSession();
    router.replace(session === null ? "/admin/login" : homeAddressFor(session.user.role));
  }, [router]);

  return (
    <p role="status" className="mx-auto max-w-4xl px-4 py-10 text-base text-ink">
      Going to your page…
    </p>
  );
}
